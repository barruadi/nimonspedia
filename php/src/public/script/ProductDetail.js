import { api } from '../utils/api.js';

function initProductDetailPage() {
    const loadingState = document.getElementById('loadingState');
    const contentWrapper = document.getElementById('contentWrapper');
    
    const productImage = document.getElementById('productImage');
    const productCategory = document.getElementById('productCategory');
    const productName = document.getElementById('productName');
    const productPrice = document.getElementById('productPrice');
    const productDescription = document.getElementById('productDescription');
    const productStock = document.getElementById('productStock');
    
    const storeLogo = document.getElementById('storeLogo');
    const storeName = document.getElementById('storeName');
    const storeDescription = document.getElementById('storeDescription');

    const qtyDecrement = document.getElementById('qtyDecrement');
    const qtyIncrement = document.getElementById('qtyIncrement');
    const qtyInput = document.getElementById('qtyInput');
    const subtotalPrice = document.getElementById('subtotalPrice');
    const addToCartBtn = document.getElementById('addToCartBtn');

    let currentProduct = null;
    
    async function loadProductData() {
        const productId = window.routeParams?.id;
        
        if (!productId) {
            showError('Halaman produk tidak ditemukan.');
            return;
        }
        
        try {
            showLoading();
            const result = await api.get(`/product/${productId}`);
            
            if (result && result.ok) {
                currentProduct = result.data.product;
                const store = result.data.store;
                
                renderProduct(currentProduct, store);
                setupPurchaseBox(currentProduct);
                
                hideLoading();
            } else {
                showError(result?.error || 'Gagal memuat data produk.');
            }
        } catch (error) {
            showError('Terjadi kesalahan. Coba muat ulang halaman.');
        }
    }
    
    function renderProduct(product, store) {
        productImage.src = product.image_path || '/images/placeholder.png';
        productImage.alt = product.name;
        productCategory.textContent = product.category_name || 'Kategori';
        productName.textContent = product.name;
        productPrice.textContent = formatCurrency(product.price);
        productDescription.textContent = product.description;

        if (store) {
            storeName.textContent = store.store_name;
            storeDescription.textContent = store.description;
            if (storeLogo && store.logo_path) {
                storeLogo.src = store.logo_path;
            }
        }
    }

    function setupPurchaseBox(product) {
        const stock = parseInt(product.stock, 10);
        productStock.textContent = stock;
        qtyInput.max = stock;
        
        updateSubtotal();

        qtyDecrement.addEventListener('click', () => {
            let qty = parseInt(qtyInput.value, 10);
            if (qty > 1) {
                qtyInput.value = qty - 1;
                updateSubtotal();
            }
        });

        qtyIncrement.addEventListener('click', () => {
            let qty = parseInt(qtyInput.value, 10);
            if (qty < stock) {
                qtyInput.value = qty + 1;
                updateSubtotal();
            }
        });
        
        qtyInput.addEventListener('input', () => {
            let qty = parseInt(qtyInput.value, 10);
            if (isNaN(qty) || qty < 1) {
                qtyInput.value = 1;
            } else if (qty > stock) {
                qtyInput.value = stock;
            }
            updateSubtotal();
        });
        
        if (stock === 0) {
            qtyInput.value = 0;
            qtyInput.disabled = true;
            qtyDecrement.disabled = true;
            qtyIncrement.disabled = true;
            addToCartBtn.textContent = 'Stok Habis';
            addToCartBtn.disabled = true;
            subtotalPrice.textContent = '-';
        }
    }
    
    function updateSubtotal() {
        const qty = parseInt(qtyInput.value, 10);
        if (currentProduct && qty > 0) {
            const subtotal = currentProduct.price * qty;
            subtotalPrice.textContent = formatCurrency(subtotal);
        } else if (currentProduct && currentProduct.stock === 0) {
             subtotalPrice.textContent = '-';
        } else {
            subtotalPrice.textContent = formatCurrency(0);
        }
    }

    async function handleAddToCart() {
        if (!currentProduct) return;
        
        const qty = parseInt(qtyInput.value, 10);
        if (qty <= 0) return;
        
        addToCartBtn.disabled = true;
        addToCartBtn.textContent = 'Menambahkan...';
        
        try {
            const result = await api.post('/cart/add', {
                product_id: currentProduct.product_id,
                qty: qty
            });
            
            if (result && result.ok) {
                showToast(
                    'Produk berhasil ditambahkan ke keranjang!',
                    'Yuk, lanjut belanja atau langsung ke checkout~',
                    'success'
                );
                
                addToCartBtn.textContent = 'Berhasil!';
                document.dispatchEvent(new CustomEvent('cart-updated'));

                setTimeout(() => {
                    addToCartBtn.textContent = 'Tambahkan ke Keranjang';
                    addToCartBtn.disabled = false;
                }, 2000);
            } else {
                let errorMsg = 'Gagal menambahkan ke keranjang';
                if (result && result.error) {
                    if (typeof result.error === 'string') {
                        errorMsg = result.error;
                    } else if (result.error.message) {
                        errorMsg = result.error.message;
                    }
                }
                throw new Error(errorMsg);
            }

        } catch (error) {
            showToast(error.message, 'Gagal menambahkan produk', 'error');
            addToCartBtn.disabled = false;
            addToCartBtn.textContent = 'Tambahkan ke Keranjang';
        }
    }
    
    addToCartBtn.addEventListener('click', handleAddToCart);

    function showLoading() {
        loadingState.style.display = 'block';
        contentWrapper.style.display = 'none';
    }
    function hideLoading() {
        loadingState.style.display = 'none';
        contentWrapper.style.display = 'flex';
    }
    function showError(message) {
        loadingState.innerHTML = `<p style="color: #BE2124;">${message}</p>`;
        loadingState.style.display = 'block';
        contentWrapper.style.display = 'none';
    }
    function formatCurrency(number) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number);
    }
    
    function showToast(primaryMessage, secondaryMessage = '', type = 'success') {
        const toast = document.getElementById('toast');
        const backdrop = document.getElementById('toastBackdrop');
        const primaryEl = document.getElementById('toastPrimaryMessage');
        const secondaryEl = document.getElementById('toastSecondaryMessage');
        const closeBtn = document.getElementById('toastCloseBtn');
        
        if (!toast || !primaryEl || !secondaryEl || !backdrop || !closeBtn) {
            console.error('Toast elements not found!');
            return;
        }
        
        primaryEl.textContent = primaryMessage;
        secondaryEl.textContent = secondaryMessage;
        toast.className = 'toast ' + type;
        
        backdrop.style.display = 'block';
        toast.style.display = 'flex';
        
        let autoHideTimer = setTimeout(hideToast, 5000);
        
        const closeHandler = () => {
            clearTimeout(autoHideTimer);
            hideToast();
        };

        closeBtn.onclick = closeHandler;
        backdrop.onclick = closeHandler;

        function hideToast() {
            if (toast) toast.style.display = 'none';
            if (backdrop) backdrop.style.display = 'none';
            
            closeBtn.onclick = null;
            backdrop.onclick = null;
        }
    }

    loadProductData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductDetailPage);
} else {
    setTimeout(initProductDetailPage, 50);
}