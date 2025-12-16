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

  // Проверяем наличие и тип sale_price
  if (typeof product.sale_price !== 'number' || isNaN(product.sale_price)) {
    console.error(
      'Ошибка: у товара нет корректного sale_price. Товар:', 
      product
    );
    return 0;
  }

  const discountFactor = 1 - (purchase.discount / 100);
  return product.sale_price * purchase.quantity * discountFactor;
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
   // 1. Валидация входных данных
  if (!data || typeof data !== 'object') {
    throw new Error('Data must be a valid object');
  }
  if (!Array.isArray(data.purchase_records)) {
    throw new Error('data.purchase_records must be an array');
  }
  if (!Array.isArray(data.products)) {
    throw new Error('data.products must be an array');
  }
  if (!Array.isArray(data.sellers)) {
    throw new Error('data.sellers must be an array');
  }
  
  // @TODO: Проверка наличия опций
  // 2. Обработка опций
  let profitMargin = 0.2;
  let calculateRevenue = calculateSimpleRevenue;
  let calculateBonus = calculateBonusByProfit;

  if (options != null && typeof options === 'object') {
    const { profitMargin: optProfitMargin, calculateRevenue: optCalcRev, calculateBonus: optCalcBonus } = options;

    if (optProfitMargin != null) {
      if (typeof optProfitMargin !== 'number' || optProfitMargin < 0 || optProfitMargin > 1) {
        throw new Error('profitMargin must be a number between 0 and 1');
      }
      profitMargin = optProfitMargin;
    }

    if (optCalcRev != null && typeof optCalcRev === 'function') {
      calculateRevenue = optCalcRev;
    }

    if (optCalcBonus != null && typeof optCalcBonus === 'function') {
      calculateBonus = optCalcBonus;
    }
  } else if (options != null) {
    throw new Error('Options must be an object or null/undefined');
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
   const sellerIndex = Object.fromEntries(sellerStats.map(stat => [stat.seller_id, stat]));
  const productIndex = Object.fromEntries(data.products.map(product => [product.sku, product]));

  // @TODO: Расчет выручки и прибыли для каждого продавца
  // 5. Двойной цикл: чеки → товары в чеке
data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    
    if (!seller) {
      console.warn(`Продавец с ID "${record.seller_id}" не найден. Пропускаем чек.`);
      return;
    }

    // Увеличиваем счётчики продаж
    seller.sales_count += 1;
    seller.revenue += record.total_amount;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      
      if (!product) {
        console.warn(`Товар с SKU "${item.sku}" не найден в каталоге. Пропускаем позицию.`);
        return;
      }

      // Расчёт себестоимости
      const cost = product.purchase_price * item.quantity;
      
      // Расчёт выручки с учётом скидки
      const revenue = calculateRevenue(item, product);
      
      // Прибыль: выручка минус себестоимость
      const profit = revenue - cost;
      
      seller.profit += profit;

      // Учёт количества проданных товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });
  // @TODO: Сортировка продавцов по прибыли
  // 6. Сортировка продавцов по прибыли (убывание)
  sellerStats.sort((a, b) => b.profit - a.profit);
  // @TODO: Назначение премий на основе ранжирования
  // 7. Назначение бонусов и формирование топ-10 продуктов
  const totalSellers = sellerStats.length;
  
  sellerStats.forEach((seller, index) => {
    // Назначение бонуса
    seller.bonus = calculateBonus(index, totalSellers, seller);

    // Формирование топ-10 продуктов
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
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2)
  }));
}
