<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>العروبة أونلاين - سوبرماركت</title>
    <style>
        :root {
            --primary-green: #68a633;
            --primary-green-hover: #588e2b;
            --price-orange: #f35b04;
            --bg-color: #f7f9fa;
            --card-bg: #ffffff;
            --text-dark: #222222;
            --text-muted: #888888;
            --radius-lg: 18px;
            --radius-md: 12px;
            --radius-pill: 50px;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-dark);
            padding-bottom: 90px;
        }

        .container {
            max-width: 480px;
            margin: 0 auto;
            background-color: var(--bg-color);
            min-height: 100vh;
        }

        /* 1. الهيدر */
        .header {
            background: #ffffff;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 10px rgba(0,0,0,0.03);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .logo-title {
            font-size: 1.3rem;
            font-weight: 900;
        }

        .logo-subtitle {
            font-size: 0.72rem;
            color: var(--text-muted);
        }

        .cart-badge {
            background-color: var(--primary-green);
            color: white;
            padding: 6px 14px;
            border-radius: var(--radius-pill);
            font-weight: bold;
            cursor: pointer;
        }

        .btn-admin {
            background-color: #2196f3;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: var(--radius-pill);
            font-weight: bold;
            font-size: 0.8rem;
            cursor: pointer;
        }

        /* 2. لوحة إضافة أغراض جديدة (لوحة التحكم) */
        .admin-panel {
            background: #ffffff;
            margin: 15px 16px;
            padding: 15px;
            border-radius: var(--radius-lg);
            border: 2px dashed #2196f3;
            display: none; /* مخفية وتظهر عند الضغط على زر الإدارة */
        }

        .admin-panel h3 {
            margin-bottom: 10px;
            font-size: 1rem;
            color: #1976d2;
        }

        .form-group {
            margin-bottom: 10px;
        }

        .form-group input, .form-group select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #ccc;
            border-radius: var(--radius-md);
            font-size: 0.9rem;
        }

        .btn-save {
            background-color: #2196f3;
            color: white;
            border: none;
            width: 100%;
            padding: 10px;
            border-radius: var(--radius-md);
            font-weight: bold;
            cursor: pointer;
        }

        /* 3. شبكة المنتجات */
        .products-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            padding: 16px;
        }

        .product-card {
            background: var(--card-bg);
            border-radius: var(--radius-lg);
            padding: 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-shadow: 0 3px 10px rgba(0,0,0,0.03);
            border: 1px solid #f0f0f0;
            position: relative;
        }

        .product-image-wrap {
            width: 100%;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
        }

        .product-image-wrap img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .product-title {
            font-size: 0.9rem;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .product-stock {
            font-size: 0.75rem;
            color: #666;
            margin-bottom: 4px;
        }

        .product-price {
            font-size: 1.15rem;
            font-weight: 900;
            color: var(--price-orange);
            margin-bottom: 8px;
        }

        .add-to-cart-btn {
            background-color: var(--primary-green);
            color: white;
            border: none;
            width: 100%;
            padding: 8px;
            border-radius: var(--radius-md);
            font-weight: 700;
            font-size: 0.85rem;
            cursor: pointer;
        }

        .add-to-cart-btn:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }

        .delete-btn {
            position: absolute;
            top: 5px;
            left: 5px;
            background: #ff5252;
            color: white;
            border: none;
            border-radius: 50%;
            width: 22px;
            height: 22px;
            cursor: pointer;
            font-size: 0.7rem;
            display: none; /* يظهر فقط في وضع الإدارة */
        }
    </style>
</head>
<body>

    <div class="container">

        <!-- الهيدر -->
        <header class="header">
            <div class="cart-badge">
                🛒 <span id="cart-count">0</span>
            </div>

            <button class="btn-admin" onclick="toggleAdminPanel()">⚙️ إضافة/إدارة الأغراض</button>

            <div>
                <div class="logo-title">العروبة</div>
                <div class="logo-subtitle">توصيل حتى البيت • رهط</div>
            </div>
        </header>

        <!-- لوحة التحكم لإضافة المنتجات والكميات -->
        <div class="admin-panel" id="admin-panel">
            <h3>➕ إضافة غرض جديد للمحل</h3>
            <div class="form-group">
                <input type="text" id="p-name" placeholder="اسم الغرض (مثال: سانو منظف)">
            </div>
            <div class="form-group">
                <input type="number" id="p-price" step="0.10" placeholder="السعر بالشيكل ₪">
            </div>
            <div class="form-group">
                <input type="number" id="p-stock" placeholder="الكمية المتوفرة عندك">
            </div>
            <div class="form-group">
                <input type="text" id="p-img" placeholder="رابط صورة الغرض (اختياري)">
            </div>
            <button class="btn-save" onclick="addNewProduct()">حفظ ونشر الغرض</button>
        </div>

        <!-- قائمة المنتجات -->
        <div class="products-grid" id="products-grid"></div>

    </div>

    <script>
        // تحميل الأغراض المخزنة سابقتً من الـ localStorage أو استخدام قائمة افتراضية
        let defaultProducts = [
            { id: 1, title: "سانو 00 منظف مرحاض", price: 11.90, stock: 15, img: "https://via.placeholder.com/150" },
            { id: 2, title: "سانو ليفه سلكه", price: 11.90, stock: 5, img: "https://via.placeholder.com/150" }
        ];

        let products = JSON.parse(localStorage.getItem('aloroba_products')) || defaultProducts;
        let cartCount = 0;
        let isAdminOpen = false;

        // حفظ القائمة في ذاكرة المتصفح
        function saveToStorage() {
            localStorage.setItem('aloroba_products', JSON.stringify(products));
        }

        // إظهار/إخفاء لوحة الإضافة
        function toggleAdminPanel() {
            isAdminOpen = !isAdminOpen;
            document.getElementById('admin-panel').style.display = isAdminOpen ? 'block' : 'none';
            renderProducts();
        }

        // عرض الأغراض في الصفحة
        function renderProducts() {
            const grid = document.getElementById('products-grid');
            grid.innerHTML = products.map(p => `
                <div class="product-card">
                    ${isAdminOpen ? `<button class="delete-btn" style="display:block" onclick="deleteProduct(${p.id})">✕</button>` : ''}
                    <div class="product-image-wrap">
                        <img src="${p.img || 'https://via.placeholder.com/150'}" alt="${p.title}">
                    </div>
                    <div>
                        <div class="product-title">${p.title}</div>
                        <div class="product-stock">الكمية بالمخزن: <strong>${p.stock}</strong></div>
                        <div class="product-price">₪${p.price.toFixed(2)}</div>
                    </div>
                    <button class="add-to-cart-btn" 
                            onclick="addToCart(${p.id})" 
                            ${p.stock <= 0 ? 'disabled' : ''}>
                        ${p.stock > 0 ? '+ أضف للسلة' : 'نفدت الكمية'}
                    </button>
                </div>
            `).join('');
        }

        // إضافة غرض جديد
        function addNewProduct() {
            const name = document.getElementById('p-name').value;
            const price = parseFloat(document.getElementById('p-price').value);
            const stock = parseInt(document.getElementById('p-stock').value);
            const img = document.getElementById('p-img').value;

            if (!name || isNaN(price) || isNaN(stock)) {
                alert("يرجى تعبئة اسم الغرض، السعر، والكمية بالشكل الصحيح!");
                return;
            }

            const newProduct = {
                id: Date.now(),
                title: name,
                price: price,
                stock: stock,
                img: img || 'https://via.placeholder.com/150'
            };

            products.push(newProduct);
            saveToStorage();
            renderProducts();

            // تفريغ الحقول
            document.getElementById('p-name').value = '';
            document.getElementById('p-price').value = '';
            document.getElementById('p-stock').value = '';
            document.getElementById('p-img').value = '';
        }

        // خصم الكمية عند الشراء
        function addToCart(id) {
            const product = products.find(p => p.id === id);
            if (product && product.stock > 0) {
                product.stock--;
                cartCount++;
                document.getElementById('cart-count').innerText = cartCount;
                saveToStorage();
                renderProducts();
            }
        }

        // حذف غرض (في وضع الإدارة)
        function deleteProduct(id) {
            products = products.filter(p => p.id !== id);
            saveToStorage();
            renderProducts();
        }

        // التشغيل المبدئي
        renderProducts();
    </script>
</body>
</html>
