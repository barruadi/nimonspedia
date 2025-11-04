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
    const cartMessage = document.getElementById('cartMessage');

    let currentProduct = null;
    let isUserLoggedIn = false;

    async function checkAuthStatus() {
        try {
            const result = await api.get('/me');
            isUserLoggedIn = result && result.authenticated === true;
        } catch (error) {
            isUserLoggedIn = false;
        }
    }

    async function loadProductData() {
        const productId = window.routeParams?.id;

        if (!productId) {
            showError('Halaman produk tidak ditemukan.');
            return;
        }

        try {
            showLoading();

            // Check auth status first
            await checkAuthStatus();

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
        productDescription.innerHTML = product.description;

        if (store) {
            storeName.textContent = store.store_name;
            if (storeDescription) {
                storeDescription.innerHTML = store.description;
            }
            if (storeLogo && store.logo_path) {
                storeLogo.src = store.logo_path;
            }
        }
    }

function setupPurchaseBox(product) {
        const stock = parseInt(product.stock, 10);
        productStock.textContent = stock;
        qtyInput.max = stock;

        // If user is not logged in, disable all purchase controls
        if (!isUserLoggedIn) {
            qtyInput.value = 0;
            qtyInput.disabled = true;
            qtyDecrement.disabled = true;
            qtyIncrement.disabled = true;
            updateSubtotal();
            return; // Don't add event listeners for guests
        }

        if (stock === 0) {
            qtyInput.value = 0;
            qtyInput.disabled = true;
        } else {
            qtyInput.value = 1;
            qtyInput.disabled = false;
        }

        updateSubtotal();

        qtyDecrement.addEventListener('click', () => {
            let qty = parseInt(qtyInput.value, 10);
            if (qty > 0) {
                qtyInput.value = qty - 1;
                updateSubtotal();
            }
        });

        qtyIncrement.addEventListener('click', () => {
            let qty = parseInt(qtyInput.value, 10);
            const stock = parseInt(currentProduct.stock, 10);
            if (qty < stock) {
                qtyInput.value = qty + 1;
                updateSubtotal();
            }
        });

        qtyInput.addEventListener('input', () => {
            let qty = parseInt(qtyInput.value, 10);
            const stock = parseInt(currentProduct.stock, 10);

            if (isNaN(qty) || qty < 0) {
                qtyInput.value = 0;
            } else if (qty > stock) {
                qtyInput.value = stock;
            }
            updateSubtotal();
        });
    }
    
    function updateSubtotal() {
        const qty = parseInt(qtyInput.value, 10);
        const stock = parseInt(currentProduct.stock, 10);

        if (isNaN(qty)) return;

        if (currentProduct && qty > 0) {
            const subtotal = currentProduct.price * qty;
            subtotalPrice.textContent = formatCurrency(subtotal);
        } else {
            subtotalPrice.textContent = formatCurrency(0);
        }

        qtyDecrement.disabled = (qty <= 0);
        qtyIncrement.disabled = (qty >= stock);

        // If user is not logged in, show "Login to buy" button
        if (!isUserLoggedIn) {
            addToCartBtn.textContent = 'Login to buy';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.add('btn-disabled-guest');
        } else if (stock === 0) {
            addToCartBtn.textContent = 'Stok Habis';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.remove('btn-disabled-guest');
        } else if (qty <= 0) {
            addToCartBtn.textContent = 'Tambahkan ke Keranjang';
            addToCartBtn.disabled = true;
            addToCartBtn.classList.remove('btn-disabled-guest');
        } else {
            addToCartBtn.textContent = 'Tambahkan ke Keranjang';
            addToCartBtn.disabled = false;
            addToCartBtn.classList.remove('btn-disabled-guest');
        }
    }

async function handleAddToCart() {
        if (!currentProduct) return;
        
        if (cartMessage) {
            cartMessage.style.display = 'none';
        }

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

                // Refresh navbar to update cart badge count
                if (window.notifyAuthChanged) {
                    window.notifyAuthChanged();
                }

                setTimeout(() => {
                    addToCartBtn.textContent = 'Tambahkan ke Keranjang';
                    updateSubtotal();
                }, 2000);
            } else {
                let errorMsg = 'Melewati batas stok, silahkan periksa keranjang Anda';
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
            showToast('Gagal menambahkan ke keranjang', 'Silakan cek pesan error di kartu', 'error');
            
            if (cartMessage) {
                cartMessage.textContent = error.message;
                cartMessage.className = 'cart-message error'; 
                cartMessage.style.display = 'block';
            }
            
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