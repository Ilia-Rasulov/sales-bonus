/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  // @TODO: Расчёт прибыли от операции
      const {discount, sale_price, quantity} = purchase;
       return sale_price * quantity * (1 - discount / 100);
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

   if(index === 0){
        return seller.profit * 0.15;
    } else if (index === 1 || index === 2){
        return seller.profit * 0.10;
    } else if(index === total -1){
        return 0;
    } else {
        return seller.profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  if(!data
        || !Array.isArray(data.customers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.purchase_records)
        || data.customers.length === 0
        || data.products.length === 0 
        || data.sellers.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // @TODO: Проверка наличия опций
        if(typeof options !== "object" || options === null){ //Проверка, что опции — это объект
        throw new Error('Опции должны быть объектом');
     }

     const { calculateRevenue, calculateBonus } = options;
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Данных не хватает');
    }
    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error('Некорректные переменные: требуется функция');
    }

    // @TODO: Подготовка промежуточных данных для сбора статистики
          const sellerStats = data.sellers.map(seller => ({
        sellerId: seller.id,
        firstName: seller.first_name,
        lastName: seller.last_name,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {},
        bonus: 0,
        top_products: []
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
     const sellerIndex = Object.fromEntries(
        sellerStats.map(s => [s.sellerId, s])
    );
    const productIndex = Object.fromEntries(
        data.products.map(p => [p.sku, p])
    );

    // @TODO: Расчёт выручки и прибыли для каждого продавца
     data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];

        if (seller){
            seller.sales_count += 1;
            seller.revenue += record.total_amount - record.total_discount;;
        }
        record.items.forEach(item => {
            const product = productIndex[item.sku];// Проходимся по товарам

            
            const cost = product.purchase_price * item.quantity;// Корректный расчет себестоимости
            const revenue = calculateRevenue(item, product);
            const profit = revenue - cost;
            seller.profit += profit;

        if (!seller.products_sold[item.sku]) {
            seller.products_sold[item.sku] = 0;
}
            seller.products_sold[item.sku] += item.quantity;

     });
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10); // Расчет бонусов и топ-10 продуктов
    });

   

    // @TODO: Подготовка итоговой коллекции с нужными полями
  return sellerStats.map(seller => ({
        seller_id: seller.sellerId,
        name: `${seller.firstName} ${seller.lastName}`,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2),
    }));
}
