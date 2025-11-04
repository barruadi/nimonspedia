import { api } from '../utils/api.js';
import { checkSellerAuth } from '../utils/sellerAuth.js';
import { showLoading, hideLoading } from '../utils/loading.js';

function initProductManagementPage() {
    // Products Data
    let store = null;
    let products = [];
    let allCategories = [];

    // DOM Elements
    const mainContent = document.getElementById('mainContent');
    const emptyState = document.getElementById('emptyState');
    const productGridContainer = document.getElementById('productGridContainer');
    const addProductBtn = document.getElementById('addProductBtn');
    const addFirstProductBtn = document.getElementById('addFirstProductBtn');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortOrder = document.getElementById('sortOrder');
    const searchInput = document.getElementById('searchInput');
    let searchTerm = '';

    // Toast Notification
    const Toast = {
        backdrop: null,
        toast: null,
        primaryEl: null,
        secondaryEl: null,
        closeBtn: null,
        autoHideTimer: null,
        isShowing: false,
        queue: [],

        init() {
            this.backdrop = document.getElementById('toastBackdrop');
            this.toast = document.getElementById('toast');
            this.primaryEl = document.getElementById('toastPrimaryMessage');
            this.secondaryEl = document.getElementById('toastSecondaryMessage');
            this.closeBtn = document.getElementById('toastCloseBtn');

            if (!this.backdrop || !this.toast || !this.closeBtn) {
                console.error('Toast elements not found in DOM');
                return;
            }

            this.closeBtn.addEventListener('click', () => this.hide());
            this.backdrop.addEventListener('click', () => this.hide());

            console.log('Toast initialized');
        },

        show(primary, secondary = '', type = 'success') {
            if (!this.toast) {
                console.error('Toast not initialized');
                return;
            }

            // Check for duplicate in queue
            const isDuplicate = this.queue.some(item => 
                item.primary === primary && 
                item.secondary === secondary && 
                item.type === type
            );
            
            if (isDuplicate) {
                console.warn('Duplicate toast ignored:', primary);
                return;
            }

            // If toast is currently showing, queue this one
            if (this.isShowing) {
                console.log('Toast busy, queueing:', primary);
                this.queue.push({ primary, secondary, type });
                return;
            }

            this.isShowing = true;

            // Clear any existing timer
            if (this.autoHideTimer) {
                clearTimeout(this.autoHideTimer);
            }

            // Set content
            this.primaryEl.textContent = primary;
            this.secondaryEl.textContent = secondary;
            this.toast.className = 'toast ' + type;

            // Show toast
            this.backdrop.classList.add('is-open');
            this.toast.classList.add('is-open');

            console.log('Toast shown:', primary);

            // Auto hide after 5 seconds
            this.autoHideTimer = setTimeout(() => {
                this.hide();

                // Show next queued toast if any
                if (this.queue.length > 0) {
                    const next = this.queue.shift();
                    setTimeout(() => {
                        this.show(next.primary, next.secondary, next.type);
                    }, 300);
                }
            }, 5000);
        },

        hide() {
            if (this.autoHideTimer) {
                clearTimeout(this.autoHideTimer);
                this.autoHideTimer = null;
            }

            this.backdrop.classList.remove('is-open');
            this.toast.classList.remove('is-open');

            setTimeout(() => {
                this.isShowing = false;
            }, 300);

            console.log('Toast hidden');
        }
    };

    // Helper function for toast calls
    const showToast = (primary, secondary = '', type = 'success') => {
        Toast.show(primary, secondary, type);
    };

    // Initialize Toast
    Toast.init();

    async function initPage() {
        const isAuthorized = await checkSellerAuth();
        if (!isAuthorized) return;

        try {
            showLoading('Memuat Produk...', 'Mengambil data produk');
            console.log('Fetching products info...');
            const result = await api.get('/seller/products');
            console.log('Store products info response:', result);

            if (!result || !result.ok) {
                console.warn('Store info request failed:', result);
                hideLoading();
                showToast('Gagal memuat data', 'Terjadi kesalahan saat mengambil data', 'error');
                return;
            }

            const data = result.data;

            if (!data) {
                throw new Error('No data returned from API');
            }

            // Save dashboard info
            store = data.store;
            products = data.products;
            console.log('Products loaded:', products.length);

            await loadCategoriesFilter();
            renderProducts();

        } catch (error) {
            console.error('Error initializing Product Management Page:', error);
            showToast('Gagal memuat data produk', error.message, 'error');
            hideLoading();
            showEmptyState();
        }
    }

    async function loadCategoriesFilter() {
        try {
            const result = await api.get('/categories');
            
            if (result && result.ok && result.data) {
                allCategories = result.data;
                populateCategoryFilter(allCategories);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    function populateCategoryFilter(categories) {
        if (!categoryFilter) return;
        
        categoryFilter.innerHTML = '<option value="">Semua Produk</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.textContent = cat.name;
            categoryFilter.appendChild(option);
        });
    }

    function getFilteredAndSortedProducts() {
        let filtered = [...products];

        const q = (searchTerm || '').trim().toLowerCase();
        if (q) {
            filtered = filtered.filter(p => {
                const name = (p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                const cat = (p.category_name || '').toLowerCase();
                return name.includes(q) || desc.includes(q) || cat.includes(q);
            });
        }

        const selectedCategory = categoryFilter?.value;
        if (selectedCategory) {
            filtered = filtered.filter(p => p.category_id == selectedCategory);
        }
        
        const sortValue = sortOrder?.value || 'name-asc';
        const [field, direction] = sortValue.split('-');
        
        filtered.sort((a, b) => {
            let valueA, valueB;
            
            switch(field) {
                case 'name':
                    valueA = (a.name || '').toLowerCase();
                    valueB = (b.name || '').toLowerCase();
                    break;
                case 'price':
                    valueA = parseInt(a.price) || 0;
                    valueB = parseInt(b.price) || 0;
                    break;
                case 'stock':
                    valueA = parseInt(a.stock) || 0;
                    valueB = parseInt(b.stock) || 0;
                    break;
                case 'category':
                    valueA = (a.category_name || '').toLowerCase();
                    valueB = (b.category_name || '').toLowerCase();
                    break;
                default:
                    return 0;
            }
            
            if (direction === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });
        
        return filtered;
    }

    function renderProducts() {
        const filteredProducts = getFilteredAndSortedProducts();
        
        console.log('Rendering products...', filteredProducts);
        
        if (!filteredProducts || filteredProducts.length === 0) {
            if (products.length === 0) {
                showEmptyState();
            } else {
                hideLoading();
                showMainContent();
                hideEmptyState();
                productGridContainer.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #6b7280;">
                        Tidak ada produk yang sesuai dengan filter
                    </div>
                `;
            }
            return;
        }

        hideLoading();
        showMainContent();
        hideEmptyState();
        
        productGridContainer.innerHTML = '';
        
        filteredProducts.forEach(product => {
            const card = createProductCard(product);
            productGridContainer.appendChild(card);
        });
        
        console.log(`Rendered ${filteredProducts.length} products`);
    }

    function createProductCard(product) {
        const card = document.createElement('div');
        card.className = 'product-card';

        const availabilityStatus = product.stock > 0
            ? { text: 'Active', class: 'status-active' }
            : { text: 'Inactive', class: 'status-inactive' };

        const formattedPrice = `Rp ${parseInt(product.price).toLocaleString('id-ID')}`;

        card.innerHTML = `
            <div class="product-card-image">
                <img 
                    src="${product.image_path || '/images/placeholder.png'}" 
                    alt="${escapeHtml(product.name)}"
                    loading="lazy"
                >
            </div>
            <div class="product-card-content">
                <h3 class="product-card-title">${escapeHtml(product.name)}</h3>
                <div class="product-card-price">${formattedPrice}</div>
                <div class="product-card-meta">
                    <span class="product-card-category">Kategori: ${escapeHtml(product.category_name || 'Tidak ada kategori')}</span>
                    <span class="product-card-stock">Stok: ${product.stock}</span>
                    <span class="product-card-status ${availabilityStatus.class}">${availabilityStatus.text}</span>
                </div>
            </div>
            <div class="product-card-actions">
                <button class="btn-card-edit" data-product-id="${product.product_id}" title="Edit produk">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="btn-card-delete" data-product-id="${product.product_id}" title="Hapus produk">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `;

        const editBtn = card.querySelector('.btn-card-edit');
        const deleteBtn = card.querySelector('.btn-card-delete');

        editBtn.addEventListener('click', () => handleEdit(product.product_id));
        deleteBtn.addEventListener('click', () => handleDelete(product.product_id, product.name));

        return card;
    }

    function showMainContent() {
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }

    function hideMainContent() {
        if (mainContent) mainContent.style.display = 'none';
    }

    function showEmptyState() {
        hideLoading();
        hideMainContent();
        if (emptyState) emptyState.style.display = 'flex';
    }

    function hideEmptyState() {
        if (emptyState) emptyState.style.display = 'none';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function handleEdit(productId) {
        console.log('Edit product:', productId);
        window.location.href = `/seller/products/edit/${productId}`;
    }

    function handleDelete(productId, productName) {
        const modal = document.getElementById('deleteModalBackdrop');
        const confirmText = document.getElementById('deleteConfirmationText');
        const confirmBtn = document.getElementById('deleteModalConfirmBtn');
        const cancelBtn = document.getElementById('deleteModalCancelBtn');

        confirmText.textContent = `Apakah anda yakin ingin menghapus produk "${productName}"?`;
        modal.style.display = 'flex';

        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        newConfirmBtn.addEventListener('click', async () => {
            modal.style.display = 'none';
            
            try {
                console.log('Deleting product:', productId);
                const result = await api.del(`/seller/products/${productId}`);

                if (result && result.ok) {
                    showToast('Produk berhasil dihapus!', 'Produk telah dihapus dari toko', 'success');
                    products = products.filter(p => p.product_id !== productId);
                    renderProducts();
                } else {
                    throw new Error(result?.error || 'Gagal menghapus produk');
                }
            } catch (error) {
                console.error('Error deleting product:', error);
                showToast('Gagal menghapus produk!', error.message, 'error');
            }
        });
    }

    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            window.location.href = '/seller/products/add';
        });
    }

    if (addFirstProductBtn) {
        addFirstProductBtn.addEventListener('click', () => {
            window.location.href = '/seller/products/add';
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            console.log('Category filter changed:', categoryFilter.value);
            renderProducts();
        });
    }

    if (sortOrder) {
        sortOrder.addEventListener('change', () => {
            console.log('Sort order changed:', sortOrder.value);
            renderProducts();
        });
    }

    if (searchInput) {
        const onSearch = debounce((ev) => {
            searchTerm = ev.target.value || '';
            console.log('Search term:', searchTerm);
            renderProducts();
        }, 300);
        searchInput.addEventListener('input', onSearch);
    }

    function debounce(fn, wait = 300) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), wait);
        };
    }

    console.log('Initializing ProductManagement page...');
    initPage();
}

if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initProductManagementPage);
} else {
    console.log('DOM already loaded, running immediately');
    setTimeout(initProductManagementPage, 100);
}