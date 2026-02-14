// ============================================
// MANDUCÁ - MENÚ DIGITAL
// Sistema de gestion de menú y carrito
// ============================================

// CONFIGURACION DE LA API
// ============================================

const API_CONFIG = {
    baseURL: 'https://manduca-backend-production.up.railway.app/api',

    endpoints: {
        menu: '/menu'
    }
};

// Estado global de la aplicaciÃ³n
const AppState = {
    categories: [],
    products: [],
    dailyDishes: [],
    filteredProducts: [],
    cart: [],
    selectedCategory: 'all',
    searchQuery: '',
    isLoading: false
};

// ============================================
// UTILIDADES
// ============================================

class Utils {
    // Formatear precio
    static formatPrice(price) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2
        }).format(price);
    }

    // Formatear nÃºmero
    static formatNumber(number) {
        return new Intl.NumberFormat('es-AR').format(number);
    }

    // Debounce para búsqueda
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Generar ID nico
    static generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    

    // Sanitizar HTML
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Normalizar texto para comparaciones flexibles
    static normalizeText(text) {
        return String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    // Obtener icono segÃºn categorÃ­a
    static getCategoryIcon(categoryName) {
        const normalized = this.normalizeText(categoryName);

        if (/cafe|cafeteria|te|infusion/.test(normalized)) return '';
        if (/bebida|jugo|smoothie|batido/.test(normalized)) return '🥤';
        if (/desayuno|brunch/.test(normalized)) return '🍳';
        if (/almuerzo|cena|comida|menu|plato/.test(normalized)) return '🍽️';
        if (/ensalada|veg|vegetar/.test(normalized)) return '🥗';
        if (/hamburg|sandwich|lomito/.test(normalized)) return '🍔';
        if (/pizza|fugazza|empanad/.test(normalized)) return '🍕';
        if (/pasta|fideo|raviol|noqui|ñoqui/.test(normalized)) return '🍝';
        if (/carne|asado|parrill|pollo|milanes/.test(normalized)) return '🥩';
        if (/pescado|marisco|atun|atun|salmon/.test(normalized)) return '🐟';
        if (/postre|dulce|helado|torta|budin/.test(normalized)) return '🍰';
        if (/snack|picada|papa/.test(normalized)) return '🍟';
        if (/fruta/.test(normalized)) return '🍎';
        if (/vino|cerveza|coctel|tragos|licor/.test(normalized)) return '🍷';
        if (/promo|promocion|especial|recomend/.test(normalized)) return '⭐';

        return '';
    }
}

// ============================================
// API SERVICE
// ============================================

class ApiService {
    static async request(endpoint, options = {}) {
        const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            ...options
        });

        if (!response.ok) {
    let errorData;
    try {
        errorData = await response.json();
    } catch {
        errorData = { message: 'Error desconocido del servidor' };
    }

    console.error('API ERROR:', errorData);
    throw errorData;
}


        return response.json();
    }

    static async getMenu() {
        return this.request(API_CONFIG.endpoints.menu);
    }
}


// ============================================
// CART MANAGER
// ============================================

class CartManager {
    constructor() {
        this.checkoutModal = document.getElementById('checkoutModal');
        this.checkoutOverlay = document.getElementById('checkoutOverlay');
        this.checkoutForm = document.getElementById('checkoutForm');
        this.checkoutCustomerName = document.getElementById('checkoutCustomerName');
        this.checkoutDeliveryType = document.getElementById('checkoutDeliveryType');
        this.checkoutAddressGroup = document.getElementById('checkoutAddressGroup');
        this.checkoutAddress = document.getElementById('checkoutAddress');
        this.checkoutNotes = document.getElementById('checkoutNotes');

        this.attachCheckoutEvents();
        this.loadFromStorage();
    }

    static buildItemKey(type, id) {
        return `${type}:${id}`;
    }

    attachCheckoutEvents() {
        document.getElementById('btnCloseCheckout').addEventListener('click', () => this.closeCheckoutModal());
        document.getElementById('btnCancelCheckout').addEventListener('click', () => this.closeCheckoutModal());
        this.checkoutOverlay.addEventListener('click', () => this.closeCheckoutModal());

        this.checkoutDeliveryType.addEventListener('change', () => {
            const isDelivery = this.checkoutDeliveryType.value === 'delivery';
            this.checkoutAddressGroup.classList.toggle('hidden', !isDelivery);
            this.checkoutAddress.required = isDelivery;
        });

        this.checkoutForm.addEventListener('submit', (event) => {
            event.preventDefault();
            this.submitCheckout();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.checkoutModal.classList.contains('active')) {
                this.closeCheckoutModal();
            }
        });
    }

    // Cargar carrito del localStorage
    loadFromStorage() {
        const stored = localStorage.getItem('manduca_cart');
        if (stored) {
            try {
                const parsedCart = JSON.parse(stored);
                AppState.cart = Array.isArray(parsedCart)
                    ? parsedCart.map(item => ({
                        ...item,
                        key: item.key || CartManager.buildItemKey(item.type || 'product', item.id),
                        max_stock: Number(item.max_stock ?? item.stock ?? 999)
                    }))
                    : [];
                this.updateUI();
            } catch (e) {
                console.error('Error loading cart:', e);
                AppState.cart = [];
            }
        }
    }

    // Guardar carrito en localStorage
    saveToStorage() {
        localStorage.setItem('manduca_cart', JSON.stringify(AppState.cart));
    }

    // Agregar producto al carrito
    addItem(product, quantity = 1) {
        const itemType = product.type || 'product';
        const itemKey = CartManager.buildItemKey(itemType, product.id);
        const existingItem = AppState.cart.find(item => item.key === itemKey);
        const maxStock = Number(product.stock ?? 999);

        if (existingItem) {
            if (existingItem.quantity + quantity > existingItem.max_stock) {
                this.showToast('warning', 'Stock limitado', `Solo hay ${existingItem.max_stock} unidades disponibles`);
                return;
            }
            existingItem.quantity += quantity;
        } else {
            AppState.cart.push({
                key: itemKey,
                id: product.id,
                type: itemType,
                name: product.name,
                price: product.price,
                category: product.category_name,
                quantity: quantity,
                max_stock: maxStock
            });
        }

        this.saveToStorage();
        this.updateUI();
        this.showToast('success', 'Producto agregado', `${product.name} agregado al carrito`);
    }

    // Actualizar cantidad
    updateQuantity(itemKey, newQuantity) {
        const item = AppState.cart.find(cartItem => cartItem.key === itemKey);
        
        if (!item) return;

        if (newQuantity <= 0) {
            this.removeItem(itemKey);
            return;
        }

        if (newQuantity > item.max_stock) {
            this.showToast('warning', 'Stock limitado', `Solo hay ${item.max_stock} unidades disponibles`);
            return;
        }

        item.quantity = newQuantity;
        this.saveToStorage();
        this.updateUI();
    }

    

    // Incrementar cantidad
    incrementItem(itemKey) {
        const item = AppState.cart.find(cartItem => cartItem.key === itemKey);
        if (item) {
            this.updateQuantity(itemKey, item.quantity + 1);
        }
    }

    // Decrementar cantidad
    decrementItem(itemKey) {
        const item = AppState.cart.find(cartItem => cartItem.key === itemKey);
        if (item) {
            this.updateQuantity(itemKey, item.quantity - 1);
        }
    }
    // Remover producto
    removeItem(itemKey) {
        const item = AppState.cart.find(cartItem => cartItem.key === itemKey);
        AppState.cart = AppState.cart.filter(cartItem => cartItem.key !== itemKey);
        this.saveToStorage();
        this.updateUI();
        
        if (item) {
            this.showToast('info', 'Producto eliminado', `${item.name} eliminado del carrito`);
        }
    }

    // Vaciar carrito
    clear() {
        if (AppState.cart.length === 0) return;

        if (confirm('Estás seguro de vaciar el carrito?')) {
            AppState.cart = [];
            this.saveToStorage();
            this.updateUI();
            this.showToast('info', 'Carrito vaciado', 'Todos los productos fueron eliminados');
        }
    }

    // Calcular totales
    getSubtotal() {
        return AppState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    getTotalItems() {
        return AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Actualizar UI del carrito
    updateUI() {
        this.updateBadge();
        this.renderCartItems();
        this.updateTotals();
    }

    // Actualizar badge del carrito
    updateBadge() {
        const badge = document.getElementById('cartBadge');
        const totalItems = this.getTotalItems();
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    // Renderizar items del carrito
    renderCartItems() {
        const cartItems = document.getElementById('cartItems');
        const cartEmpty = document.getElementById('cartEmpty');

        if (AppState.cart.length === 0) {
            cartItems.style.display = 'none';
            cartEmpty.style.display = 'flex';
            return;
        }

        cartItems.style.display = 'flex';
        cartEmpty.style.display = 'none';

        cartItems.innerHTML = AppState.cart.map(item => `
            <div class="cart-item" data-key="${item.key}">
                <div class="cart-item-details">
                    <div class="cart-item-name">${Utils.escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${Utils.formatPrice(item.price)}</div>
                    <div class="cart-item-controls">
                        <div class="quantity-control">
                            <button class="btn-quantity" onclick="cart.decrementItem('${item.key}')" 
                                    ${item.quantity <= 1 ? 'disabled' : ''}>
                                âˆ’
                            </button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="btn-quantity" onclick="cart.incrementItem('${item.key}')"
                                    ${item.quantity >= item.max_stock ? 'disabled' : ''}>
                                +
                            </button>
                        </div>
                        <button class="btn-remove-item" onclick="cart.removeItem('${item.key}')">
                            Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Actualizar totales
    updateTotals() {
        const subtotal = this.getSubtotal();
        document.getElementById('cartSubtotal').textContent = Utils.formatPrice(subtotal);
        document.getElementById('cartTotal').textContent = Utils.formatPrice(subtotal);
    }
    

    // Mostrar toast
    showToast(type, title, message) {
        const container = document.getElementById('toastContainer');
        const toastId = Utils.generateId();
        
        const icons = {
            success: `<svg class="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>`,
            error: `<svg class="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>`,
            warning: `<svg class="toast-icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>`,
            info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                     <circle cx="12" cy="12" r="10"></circle>
                     <line x1="12" y1="16" x2="12" y2="12"></line>
                     <line x1="12" y1="8" x2="12.01" y2="8"></line>
                   </svg>`
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.id = toastId;
        toast.innerHTML = `
            ${icons[type] || icons.info}
            <div class="toast-content">
                <div class="toast-title">${Utils.escapeHtml(title)}</div>
                ${message ? `<div class="toast-message">${Utils.escapeHtml(message)}</div>` : ''}
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                toastElement.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => toastElement.remove(), 300);
            }
        }, 3000);
    }

    // Procesar checkout
    async checkout() {
        if (AppState.cart.length === 0) {
            this.showToast('warning', 'Carrito vacío', 'Agrega productos antes de realizar el pedido');
            return;
        }

        this.openCheckoutModal();
    }

    openCheckoutModal() {
        const savedName = localStorage.getItem('manduca_customer_name') || '';
        const savedAddress = localStorage.getItem('manduca_delivery_address') || '';
        const hasSavedAddress = savedAddress.trim().length > 0;

        this.checkoutCustomerName.value = savedName;
        this.checkoutDeliveryType.value = hasSavedAddress ? 'delivery' : 'local';
        this.checkoutAddress.value = savedAddress;
        this.checkoutAddress.required = hasSavedAddress;
        this.checkoutAddressGroup.classList.toggle('hidden', !hasSavedAddress);
        this.checkoutNotes.value = '';

        const summary = document.getElementById('checkoutSummary');
        if (summary) {
            summary.textContent = `${this.getTotalItems()} productos - Total ${Utils.formatPrice(this.getSubtotal())}`;
        }

        this.checkoutModal.classList.add('active');
    }

    closeCheckoutModal() {
        this.checkoutModal.classList.remove('active');
    }

    async submitCheckout() {
        const customerName = this.checkoutCustomerName.value.trim();
        const deliveryType = this.checkoutDeliveryType.value;
        const deliveryAddress = this.checkoutAddress.value.trim();
        const notes = this.checkoutNotes.value.trim();

        if (!customerName) {
            this.showToast('warning', 'Nombre requerido', 'Ingresa tu nombre para continuar');
            return;
        }

        if (deliveryType === 'delivery' && !deliveryAddress) {
            this.showToast('warning', 'Dirección requerida', 'Ingresa una dirección para el envío');
            return;
        }

        const orderData = {
    customer_name: customerName,
    delivery_type: deliveryType,
    delivery_address: deliveryType === 'delivery' ? deliveryAddress : null,
    notes,
    items: AppState.cart.map(item => ({
        type: item.type === 'daily' ? 'daily' : 'product',
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price
    }))
};
;

        const submitBtn = this.checkoutForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.textContent : '';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';
            }
            
            console.log("ORDER DATA REAL:", JSON.stringify(orderData, null, 2));

            await ApiService.request('/menu/orders', {
                method: 'POST',
                body: JSON.stringify(orderData)
            });

            localStorage.setItem('manduca_customer_name', customerName);
            if (deliveryType === 'delivery') {
                localStorage.setItem('manduca_delivery_address', deliveryAddress);
            }

            this.showToast('success', 'Pedido enviado', 'Tu pedido fue enviado al local');

            AppState.cart = [];
            this.saveToStorage();
            this.updateUI();
            this.closeCheckoutModal();
            this.closeCart();
        } catch (error) {
            console.error('Checkout error:', error);
            this.showToast('error', 'Error', error?.message || 'No se pudo procesar el pedido.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText || 'Enviar pedido';
            }
        }
    }


    // Abrir carrito
    openCart() {
        document.getElementById('cartSidebar').classList.add('active');
        document.getElementById('cartOverlay').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Cerrar carrito
    closeCart() {
        document.getElementById('cartSidebar').classList.remove('active');
        document.getElementById('cartOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ============================================
// PRODUCTS MANAGER
// ============================================

class ProductsManager {
    constructor() {
        this.loadingState = document.getElementById('loadingState');
        this.emptyState = document.getElementById('emptyState');
        this.productsGrid = document.getElementById('productsGrid');
    }

    // Cargar productos desde la API
    async loadProducts() {
    try {
        this.showLoading();

        const response = await ApiService.getMenu();

        // ---- SITE ----
        const siteLogo = document.querySelector('.logo-image');
        if (siteLogo) {
            siteLogo.alt = response.site.name;
            siteLogo.title = response.site.name;
        }

        if (!response.site.is_open) {
            cart.showToast(
                'warning',
                'Local cerrado',
                'No se están tomando pedidos en este momento'
            );
        }

        // ---- CATEGORIES ----
        AppState.categories = response.categories.map(cat => ({
            id: cat.id,
            name: cat.name
        }));

        // ---- PRODUCTS (aplanar categorí­as) ----
        AppState.products = response.categories.flatMap(cat =>
        cat.products.map(p => ({
            id: p.id,
            type: 'product', //  CLAVE
            name: p.name,
            description: p.description,
            price: parseFloat(p.price_retail),
            stock: p.stock,
            unit: 'unidad',
            category_id: cat.id,
            category_name: cat.name,
            low_stock_threshold: p.low_stock_threshold
        }))
);

        // ---- PLATOS DEL DíA ----
AppState.dailyDishes = [];

if (response.daily_dishes && response.daily_dishes.length > 0) {
    response.daily_dishes.forEach(dish => {

        const dailyProduct = {
            id: dish.id,
            type: 'daily',
            name: dish.name,
            description: dish.description,
            price: parseFloat(dish.price),
            stock: dish.stock,
            unit: 'unidad',
            category_id: null,
            category_name: 'Plato del día',
            is_daily: true
        };

        // Guardar en dailyDishes para render especial
        AppState.dailyDishes.push(dailyProduct);
        
        // Agregar a products para carrito, modal y bÃºsquedas
        AppState.products.push(dailyProduct);
    });
}
        // Inicializar productos filtrados

        AppState.filteredProducts = [...AppState.products];

        categories.render();
        this.render();

        this.hideLoading();
    } catch (error) {
        console.error(error);
        this.showError();
    }
}


    // Buscar productos
    search(query) {
        AppState.searchQuery = query.toLowerCase().trim();
        
        if (!AppState.searchQuery) {
            AppState.filteredProducts = [...AppState.products];
        } else {
            AppState.filteredProducts = AppState.products.filter(product => 
                product.name.toLowerCase().includes(AppState.searchQuery) ||
                product.description.toLowerCase().includes(AppState.searchQuery) ||
                product.category_name.toLowerCase().includes(AppState.searchQuery)
            );
        }
        
        this.render();
    }

    // Renderizar productos
    render() {
    let html = '';

    // ⭐ PLATO DEL DÍA - SOLO EN "TODOS"
    if (AppState.dailyDishes.length > 0 && AppState.selectedCategory === 'all') {
        html += `
            <div class="daily-dishes">
                <h2 class="section-title">⭐ Plato del día</h2>
                <div class="products-grid">
                    ${AppState.dailyDishes.map(p =>
                        this.createProductCard({
                            ...p,
                            category_name: 'Plato del día'
                        })
                    ).join('')}
                </div>
            </div>
        `;
    }

    const hasProducts = AppState.filteredProducts.length > 0;

    if (!hasProducts && AppState.dailyDishes.length === 0) {
        this.showEmpty();
        return;
    }

    if (hasProducts) {
        let productsToShow = AppState.filteredProducts;

        // Si estamos en "Todos", no duplicar platos del día que ya se muestran arriba
        if (AppState.selectedCategory === 'all' && AppState.dailyDishes.length > 0) {
            productsToShow = productsToShow.filter(p => p.type !== 'daily');
        }

        html += productsToShow
            .map(product => this.createProductCard(product))
            .join('');
    }

        this.productsGrid.innerHTML = html;
    this.productsGrid.style.display = 'grid';
    this.emptyState.style.display = 'none';

    this.updateCount();
}


    

    // Crear tarjeta de producto
    createProductCard(product) {
        const hasDiscount = product.discount_price && product.discount_price < product.price;
        const isNew = product.is_new;
        const stockStatus = this.getStockStatus(product.stock);
        
        return `
            <div class="product-card" 
     data-id="${product.id}" 
     data-type="${product.type}">

                <div class="product-content">
                    <div class="product-category">${Utils.escapeHtml(product.category_name)}</div>
                    <h3 class="product-name">${Utils.escapeHtml(product.name)}</h3>
                    <p class="product-description">${Utils.escapeHtml(product.description)}</p>
                    
                    <div class="product-footer">
                        <div class="product-price-container">
                            ${hasDiscount ? `<div class="product-price-old">${Utils.formatPrice(product.price)}</div>` : ''}
                            <div class="product-price">${Utils.formatPrice(hasDiscount ? product.discount_price : product.price)}</div>
                            ${product.unit ? `<div class="product-unit">por ${product.unit}</div>` : ''}
                        </div>
                        ${stockStatus.available ? `
                            <button class="btn-add-to-cart" onclick="handleAddToCart(${product.id}, '${product.type}')">

                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                                Agregar
                            </button>
                        ` : `
                            <button class="btn-add-to-cart" disabled style="opacity: 0.5; cursor: not-allowed;">
                                No disponible
                            </button>
                        `}
                    </div>
                    
                    <div class="stock-status ${stockStatus.class}">
                        <span class="stock-dot"></span>
                        <span>${stockStatus.text}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Determinar estado del stock
    getStockStatus(stock) {
        if (!stock || stock === 0) {
            return { available: false, class: 'out-of-stock', text: 'Sin stock', isLow: false };
        } else if (stock < 10) {
            return { available: true, class: 'low-stock', text: `Solo ${stock} unidades`, isLow: true };
        } else {
            return { available: true, class: 'in-stock', text: 'Disponible', isLow: false };
        }
    }

    // Actualizar contador de productos
    updateCount() {
        const count = AppState.filteredProducts.length;
        const categoryName = this.getCategoryName();
        
        document.getElementById('categoryTitle').textContent = categoryName;
        document.getElementById('productsCount').textContent = 
            `${count} ${count === 1 ? 'producto' : 'productos'} ${AppState.searchQuery ? 'encontrados' : 'disponibles'}`;
    }

    // Obtener nombre de categorÃ­a actual
    getCategoryName() {
        if (AppState.searchQuery) {
            return `Resultados para "${AppState.searchQuery}"`;
        }
        
        if (AppState.selectedCategory === 'all') {
            return 'Todos los Productos';
        }
        
        const category = AppState.categories.find(c => c.id === AppState.selectedCategory);
        return category ? category.name : 'Productos';
    }

    // Mostrar loading
    showLoading() {
        this.loadingState.style.display = 'flex';
        this.emptyState.style.display = 'none';
        this.productsGrid.style.display = 'none';
    }

    // Ocultar loading
    hideLoading() {
        this.loadingState.style.display = 'none';
    }

    // Mostrar estado vacÃ­o
    showEmpty() {
        this.loadingState.style.display = 'none';
        this.productsGrid.style.display = 'none';
        this.emptyState.style.display = 'flex';
    }

    // Mostrar error
    showError() {
        this.hideLoading();
        cart.showToast('error', 'Error', 'No se pudieron cargar los productos');
    }

    
}

// ============================================
// CATEGORIES MANAGER
// ============================================

class CategoriesManager {
    // Las categorÃ­as YA VIENEN desde ProductsManager.loadProducts()
    // que consume /api/menu y carga los datos en AppState.categories
    // Por lo tanto, este manager solo necesita renderizar
    async loadCategories() {
        // No hacemos fetch aquÃ­ - las categorÃ­as ya estÃ¡n en AppState
        // cargadas por ProductsManager
        this.render();
    }

    render() {
        const container = document.getElementById('categoriesNav').querySelector('.categories-container');
        
        const categoriesHTML = AppState.categories.map(category => `
            <button class="category-btn" data-category="${category.id}">
                <span class="category-icon" aria-hidden="true">${Utils.getCategoryIcon(category.name)}</span>
                <span>${Utils.escapeHtml(category.name)}</span>
            </button>
        `).join('');
        
        // Limpiar categorÃ­as previas y agregar las nuevas
        const existingCategories = container.querySelectorAll('.category-btn:not([data-category="all"])');
        existingCategories.forEach(btn => btn.remove());
        
        // Insertar nuevas categorÃ­as despuÃ©s del botÃ³n "Todos"
        const allButton = container.querySelector('[data-category="all"]');
        allButton.insertAdjacentHTML('afterend', categoriesHTML);
        
        this.attachEvents();
    }

    attachEvents() {
        const buttons = document.querySelectorAll('.category-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoryId = e.currentTarget.dataset.category;
                this.selectCategory(categoryId);
            });
        });
    }

    selectCategory(categoryId) {
        // Actualizar estado
        AppState.selectedCategory = categoryId === 'all' ? 'all' : parseInt(categoryId);
        
        // Actualizar UI
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${categoryId}"]`).classList.add('active');
        
        // Limpiar bÃºsqueda
        document.getElementById('searchInput').value = '';
        AppState.searchQuery = '';
        
        // Cargar productos
        if (categoryId === 'all') {
            AppState.filteredProducts = [...AppState.products];
        } else {
            AppState.filteredProducts = AppState.products.filter(
                p => p.category_id == categoryId
            );
        }

        products.render();

            }
}

// ============================================
// MODAL MANAGER
// ============================================

class ModalManager {
    constructor() {
        this.modal = document.getElementById('productModal');
        this.modalBody = document.getElementById('modalBody');
        this.modalOverlay = document.getElementById('modalOverlay');
        this.btnClose = document.getElementById('btnCloseModal');
        
        this.attachEvents();
    }

    attachEvents() {
        this.btnClose.addEventListener('click', () => this.close());
        this.modalOverlay.addEventListener('click', () => this.close());
        
        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    }

    open(product) {
    if (!product) {
        cart.showToast('error', 'Error', 'Producto no encontrado');
        return;
    }

    this.render(product);
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}


    render(product) {
        const hasDiscount = product.discount_price && product.discount_price < product.price;
        const price = hasDiscount ? product.discount_price : product.price;
        
        this.modalBody.innerHTML = `
            <div class="modal-header">
                <div class="modal-category">${Utils.escapeHtml(product.category_name)}</div>
                <h2 class="modal-title">${Utils.escapeHtml(product.name)}</h2>
                <p class="modal-description">${Utils.escapeHtml(product.description)}</p>
            </div>
            
            <div class="modal-price">
                ${hasDiscount ? `<span style="text-decoration: line-through; color: #9E9E9E; font-size: 1.25rem; margin-right: 1rem;">${Utils.formatPrice(product.price)}</span>` : ''}
                ${Utils.formatPrice(price)}
                ${product.unit ? `<span style="font-size: 1rem; color: #757575; margin-left: 0.5rem;">/ ${product.unit}</span>` : ''}
            </div>
            
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="modal.close()">
                    Cerrar
                </button>
                <button class="btn btn-primary" onclick="handleAddToCart(${product.id}, '${product.type}'); modal.close();">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    Agregar al Carrito
                </button>
            </div>
        `;
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ============================================
// INSTANCIAS GLOBALES
// ============================================

let cart, products, categories, modal;

// ============================================
// EVENT HANDLERS GLOBALES
// ============================================

function handleAddToCart(id, type) {
    let item;

    if (type === 'daily') {
        item = AppState.dailyDishes.find(d => d.id === id);
    } else {
        item = AppState.products.find(
            p => p.id === id && p.type === 'product'
        );
    }

    if (!item) {
        cart.showToast('error', 'Error', 'Producto no encontrado');
        return;
    }

    cart.addItem(item, 1);
}

function handleProductClick(id, type) {
    let item;

    if (type === 'daily') {
        item = AppState.dailyDishes.find(d => d.id === id);
    } else {
        item = AppState.products.find(
            p => p.id === id && p.type === 'product'
        );
    }

    if (!item) {
        cart.showToast('error', 'Error', 'Producto no encontrado');
        return;
    }

    modal.open(item);
}

// ============================================
// INICIALIZACIÃ“N
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar managers
    cart = new CartManager();
    products = new ProductsManager();
    categories = new CategoriesManager();
    modal = new ModalManager();

    // Event Listeners del Header
    document.getElementById('btnSearch').addEventListener('click', () => {
        const searchBar = document.getElementById('searchBar');
        searchBar.classList.toggle('active');
        if (searchBar.classList.contains('active')) {
            document.getElementById('searchInput').focus();
        }
    });
    

    document.getElementById('btnSearchClose').addEventListener('click', () => {
        document.getElementById('searchBar').classList.remove('active');
        document.getElementById('searchInput').value = '';
        AppState.searchQuery = '';
        products.search('');
    });

    // BÃºsqueda con debounce
    const debouncedSearch = Utils.debounce((query) => {
        products.search(query);
    }, 300);

    document.getElementById('searchInput').addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });

    // Event Listeners del Carrito
    document.getElementById('btnCart').addEventListener('click', () => {
        cart.openCart();
    });

    document.getElementById('btnCloseCart').addEventListener('click', () => {
        cart.closeCart();
    });

    document.getElementById('cartOverlay').addEventListener('click', () => {
        cart.closeCart();
    });

    document.getElementById('btnClearCart').addEventListener('click', () => {
        cart.clear();
    });

    document.getElementById('btnCheckout').addEventListener('click', () => {
        cart.checkout();
    });

    // Click en productos para abrir modal
    document.getElementById('productsGrid').addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (card && !e.target.closest('.btn-add-to-cart')) {
            const productId = parseInt(card.dataset.id);
            const productType = card.dataset.type;
            handleProductClick(productId, productType);
        }
    });

    // Cargar datos iniciales
    // IMPORTANTE: cargar productos PRIMERO porque allÃ­ se llenan las categorÃ­as desde /api/menu
    try {
        await products.loadProducts();
        await categories.loadCategories();
    } catch (error) {
        console.error('Initialization error:', error);
        cart.showToast('error', 'Error', 'Error al cargar el menÃº');
    }
    
});


// Agregar animaciÃ³n para slideOut
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
