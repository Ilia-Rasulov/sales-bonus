/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  // Защищаемся от отсутствующего товара
  if (!_product) {
    console.error('Ошибка: товар не передан в calculateSimpleRevenue');
    return 0;
  }

  // Берём цену из purchase, если указана, иначе из product
  const salePrice = typeof purchase.sale_price === 'number'
    ? purchase.sale_price
    : (typeof _product.sale_price === 'number' ? _product.sale_price : 0);

  if (salePrice < 0 || isNaN(salePrice)) {
    console.error('Ошибка: некорректный sale_price', { salePrice, purchase, _product });
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

  const DEFAULT_PROFIT_MARGIN = 0.2;
  const DEFAULT_REVENUE_FN = calculateSimpleRevenue;
  const DEFAULT_BONUS_FN = calculateBonusByProfit;

  //  Извлекаем и валидируем опции, если они есть
  if (options != null) {
    // Проверяем, что options — объект
    if (typeof options !== 'object') {
      throw new Error('Options must be an object or null/undefined');
    }

    // profitMargin
    if (options.profitMargin !== undefined) {
      if (typeof options.profitMargin !== 'number' || options.profitMargin < 0 || options.profitMargin > 1) {
        throw new Error('profitMargin must be a number between 0 and 1');
      }
      // Переопределяем константу через новое объявление (в своей области видимости)
      const profitMargin = options.profitMargin;
    }

    // calculateRevenue
    if (options.calculateRevenue !== undefined) {
      if (typeof options.calculateRevenue !== 'function') {
        throw new Error('calculateRevenue must be a function');
      }
      const calculateRevenue = options.calculateRevenue;
    }

    // calculateBonus
    if (options.calculateBonus !== undefined) {
      if (typeof options.calculateBonus !== 'function') {
        throw new Error('calculateBonus must be a function');
      }
      const calculateBonus = options.calculateBonus;
    }
  }

  //  Используем либо дефолтные, либо переопределённые значения
  // (в реальной логике функции — обращаемся к const, определённым выше или по умолчанию)
  
  const profitMargin = options?.profitMargin ?? DEFAULT_PROFIT_MARGIN;
  const calculateRevenue = options?.calculateRevenue ?? DEFAULT_REVENUE_FN;
  const calculateBonus = options?.calculateBonus ?? DEFAULT_BONUS_FN;

 
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

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) {
        console.warn(`Товар с SKU "${item.sku}" не найден в каталоге. Пропускаем позицию.`);
        return;
      }

      // Расчёт выручки по позиции
      const revenue = calculateRevenue(item, product);
      
      // Себестоимость
      const cost = product.purchase_price * item.quantity;
      
      // Прибыль
      const profit = revenue - cost;

      // Округление до 2 знаков после запятой
      seller.revenue = parseFloat((seller.revenue + revenue).toFixed(2));
      seller.profit = parseFloat((seller.profit + profit).toFixed(2));

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
    // Бонус с округлением до 2 знаков
    seller.bonus = parseFloat(calculateBonus(index, totalSellers, seller).toFixed(2));


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
    revenue: parseFloat(seller.revenue.toFixed(2)),
    profit: parseFloat(seller.profit.toFixed(2)),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: parseFloat(seller.bonus.toFixed(2))
  }));
}
