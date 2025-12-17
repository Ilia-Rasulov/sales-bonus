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

  if (typeof product.sale_price !== 'number' || isNaN(product.sale_price) || product.sale_price < 0) {
    console.error('Ошибка: у товара нет корректного sale_price', product);
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
  // 1. Базовая валидация данных
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

  // 2. Проверка на пустые массивы (новые проверки!)
  if (data.sellers.length === 0) {
    throw new Error('data.sellers array is empty');
  }
  if (data.products.length === 0) {
    throw new Error('data.products array is empty');
  }
  // Можно добавить проверку для purchase_records, если требуется:
   if (data.purchase_records.length === 0) {
     throw new Error('data.purchase_records array is empty');
 }

  let profitMargin = 0.2;
  let calculateRevenue = calculateSimpleRevenue;
  let calculateBonus = calculateBonusByProfit;

  if (options && typeof options === 'object') {
    const { profitMargin: optProfitMargin, calculateRevenue: optCalcRev, calculateBonus: optCalcBonus } = options;

    // Проверка profitMargin
    if (optProfitMargin !== undefined) {
      if (typeof optProfitMargin !== 'number' || optProfitMargin < 0 || optProfitMargin > 1) {
        throw new Error('profitMargin must be a number between 0 and 1');
      }
      profitMargin = optProfitMargin;
    }

    // Проверка calculateRevenue
    if (optCalcRev !== undefined) {
      if (typeof optCalcRev !== 'function') {
        throw new Error('calculateRevenue must be a function');
      }
      calculateRevenue = optCalcRev;
    }

    // Проверка calculateBonus
    if (optCalcBonus !== undefined) {
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
  // 5. Двойной цикл: чеки → товары в чеке
data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.sales_count += 1;
    
    // Накопление выручки по чеку
    let recordRevenue = 0;
    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;

      // Точные значения из чека
      const salePrice = typeof item.sale_price === 'number' ? item.sale_price : product.sale_price;
      const quantity = Math.max(0, item.quantity || 0);
      const discount = Math.max(0, Math.min(100, item.discount || 0));

      // Расчёт выручки с учётом скидки
      const itemRevenue = salePrice * quantity * (1 - discount / 100);
      recordRevenue += itemRevenue;

      // Себестоимость (без скидок)
      const cost = product.purchase_price * quantity;
      const profit = itemRevenue - cost;

      seller.profit += profit;

      if (!seller.products_sold[item.sku]) seller.products_sold[item.sku] = 0;
      seller.products_sold[item.sku] += quantity;
    });

    seller.revenue += recordRevenue;
  });

  // @TODO: Сортировка продавцов по прибыли
  // 6. Сортировка продавцов по прибыли (убывание)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // @TODO: Назначение премий на основе ранжирования
  // 7. Назначение бонусов и формирование топ-10 продуктов
  const totalSellers = sellerStats.length;
  sellerStats.forEach((seller, idx) => {
    seller.bonus = calculateBonus(idx, totalSellers, seller);
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, qty]) => ({ sku, quantity: qty }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  });


  // @TODO: Подготовка итоговой коллекции с нужными полями
  // 8. Формирование итогового отчёта
  return sellerStats.map(s => ({
    seller_id: s.seller_id,
    name: s.name,
    revenue: +s.revenue.toFixed(2),
    profit: +s.profit.toFixed(2),
    sales_count: s.sales_count,
    top_products: s.top_products,
    bonus: +s.bonus.toFixed(2)
  }));
}
