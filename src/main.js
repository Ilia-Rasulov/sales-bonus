/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, product) {
  // Защищаемся от отсутствующего товара
   if (!product) {
    console.error('Ошибка: товар не передан в calculateSimpleRevenue');
    return 0;
  }

  // Берём цену из purchase, если указана, иначе из product
  const salePrice = typeof purchase.sale_price === 'number'
    ? purchase.sale_price
    : (typeof product.sale_price === 'number' ? product.sale_price : 0);

  if (salePrice < 0 || isNaN(salePrice)) {
    console.error('Ошибка: некорректный sale_price', { salePrice, purchase, product });
    return 0;
  }

  const quantity = Math.max(0, purchase.quantity || 0);
  const discount = Math.max(0, Math.min(100, purchase.discount || 0));
  const discountFactor = 1 - (discount / 100);

  return salePrice * quantity * discountFactor;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  // @TODO: Расчет бонуса от позиции в рейтинге
  const profit = seller.profit;

  if (index === 0) {
    return profit * 0.15; // 15% для первого места
  } else if (index === 1 || index === 2) {
    return profit * 0.10; // 10% для второго и третьего места
  } else if (index === total - 1) {
    return 0; // 0% для последнего места
  } else {
    return profit * 0.05; // 5% для остальных
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // @TODO: Проверка входных данных
  // 1. Базовая валидация данных
  if (!data || typeof data !== 'object') {
    throw new Error('Data must be a valid object');
  }

  const requiredArrays = ['purchase_records', 'products', 'sellers'];
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      throw new Error(`data.${key} must be an array`);
    }
    if (data[key].length === 0) {
      throw new Error(`data.${key} array is empty`);
    }
  }
  
   // @TODO: Подготовка промежуточных данных для сбора статистики
   //2. Валидация опций

  let profitMargin = 0.2;
  let calculateRevenue = calculateSimpleRevenue;
  let calculateBonus = calculateBonusByProfit;

  if (options != null) {
    // Проверяем, что options — это объект (не null и не примитив)
    if (typeof options !== 'object' || options === null) {
      throw new Error('Options must be a non-null object');
    }

    const { profitMargin: optProfitMargin, calculateRevenue: optCalcRev, calculateBonus: optCalcBonus } = options;

    // Валидация profitMargin
    if (optProfitMargin !== undefined) { // явно передано
      if (typeof optProfitMargin !== 'number' || optProfitMargin < 0 || optProfitMargin > 1) {
        throw new Error('profitMargin must be a number between 0 and 1');
      }
      profitMargin = optProfitMargin;
    }

    // Валидация calculateRevenue
    if (optCalcRev !== undefined) { // явно передано
      if (typeof optCalcRev !== 'function') {
        throw new Error('calculateRevenue must be a function');
      }
      calculateRevenue = optCalcRev;
    }

    // Валидация calculateBonus
    if (optCalcBonus !== undefined) { // явно передано
      if (typeof optCalcBonus !== 'function') {
        throw new Error('calculateBonus must be a function');
      }
      calculateBonus = optCalcBonus;
    }
  }

 
  // @TODO: Подготовка промежуточных данных для сбора статистики
   // 3. Подготовка промежуточных данных
  const sellerStats = data.sellers.map(seller => ({
    seller_id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
    top_products: []
  }));

  // @TODO: Индексация продавцов и товаров для быстрого доступа
  // 4. Создание индексов для быстрого доступа
  const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.seller_id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // @TODO: Расчет выручки и прибыли для каждого продавца
  // 5. Обработка чеков (по позициям)
data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) {
      console.warn(`Продавец с ID "${record.seller_id}" не найден. Пропускаем чек.`);
      return;
    }

    seller.sales_count += 1;

    let recordRevenue = 0;
    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) {
        console.warn(`Товар с SKU "${item.sku}" не найден в каталоге. Пропускаем позицию.`);
        return;
      }

      // Расчёт выручки по позиции с округлением
      const itemRevenue = Math.round(calculateRevenue(item, product) * 100) / 100;
      recordRevenue = Math.round((recordRevenue + itemRevenue) * 100) / 100;

      // Себестоимость с округлением
      const cost = Math.round(product.purchase_price * item.quantity * 100) / 100;
      const profit = Math.round((itemRevenue - cost) * 100) / 100;

      seller.profit = Math.round((seller.profit + profit) * 100) / 100;

      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });

    // Округление итоговой выручки продавца
    seller.revenue = Math.round((seller.revenue + recordRevenue) * 100) / 100;
  });

  // @TODO: Сортировка продавцов по прибыли
  // 6. Сортировка продавцов по прибыли (убывание)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // @TODO: Назначение премий на основе ранжирования
  // 7. Назначение бонусов и формирование топ-10 продуктов
   const totalSellers = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    // Бонус с округлением до 2 знаков
    seller.bonus = Math.round(calculateBonus(index, totalSellers, seller) * 100) / 100;

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });


  // @TODO: Подготовка итоговой коллекции с нужными полями
  // 8. Формирование итогового отчёта
  return sellerStats.map(seller => ({
    seller_id: seller.seller_id,
    name: seller.name,
    revenue: Math.round(seller.revenue * 100) / 100,
    profit: Math.round(seller.profit * 100) / 100,
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: Math.round(seller.bonus * 100) / 100
  }));
}
