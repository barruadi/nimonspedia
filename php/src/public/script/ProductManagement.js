import { api } from '../utils/api.js';

function initProductManagementPage() {
    // Products Data
    let store = null;
    let products = [];
    let allCategories = [];

    // DOM Elements
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const productTableContainer = document.getElementById('productTableContainer');
    const productTableBody = document.getElementById('productTableBody');
    const addProductBtn = document.getElementById('addProductBtn');
    const addFirstProductBtn = document.getElementById('addFirstProductBtn');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortOrder = document.getElementById('sortOrder');

    async function initPage() {
        try {
            // Show loading state
            showLoading();

            console.log('Fetching products info...');
            const result = await api.get('/seller/products');

            console.log('Store products info response:', result);

            if (!result || !result.ok) {
                console.warn('Store info request failed:', result);
                showToast('Unauthorized - Please login as seller', 'error');
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            } else {
                // Save store and products data
                store = result.data.store;
                products = result.data.products;
                
                console.log('Products loaded:', products.length);
                
                // Load categories for filter
                await loadCategoriesFilter();
                
                renderProducts();
            }

        }
        catch (error) {
            console.error('Error initializing Product Management Page:', error);
            showToast('Gagal memuat data produk.', 'error');
            showEmptyState();
        }
    }

    // Load categories for filter dropdown
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
        
        // Keep "Semua Kategori" option
        categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.textContent = cat.name;
            categoryFilter.appendChild(option);
        });
    }

    // Filter & Sort Logic
    function getFilteredAndSortedProducts() {
        let filtered = [...products];
        
        // Apply category filter
        const selectedCategory = categoryFilter?.value;
        if (selectedCategory) {
            filtered = filtered.filter(p => p.category_id == selectedCategory);
        }
        
        // Apply sorting
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
                    valueA = parseFloat(a.price) || 0;
                    valueB = parseFloat(b.price) || 0;
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
        
        // Empty state case
        if (!filteredProducts || filteredProducts.length == 0) {
            if (products.length === 0) {
                // No products at all
                showEmptyState();
            } else {
                // Products exist but filtered out
                productTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px;">
                            Tidak ada produk yang sesuai dengan filter
                        </td>
                    </tr>
                `;
                productTableContainer.style.display = 'block';
                hideLoading();
                hideEmptyState();
            }
            return;
        }

        // Hide loading and empty states
        hideLoading();
        hideEmptyState();
        
        // Show products table
        productTableContainer.style.display = 'block';

        // Clear existing table rows
        productTableBody.innerHTML = '';

        // Loop through every product and render each product
        filteredProducts.forEach(product => {
            const row = createProductRow(product);
            productTableBody.appendChild(row);
        });
        
        console.log(`Rendered ${filteredProducts.length} products`);
    }

    // Create row for each product
    function createProductRow(product) {
        const tr = document.createElement('tr');

        const stockStatus = product.stock > 10 
            ? 'In Stock' 
            : product.stock > 0 
            ? 'Low Stock' 
            : 'Out of Stock';

        const stockClass = product.stock > 10 
            ? 'status-in-stock' 
            : product.stock > 0 
            ? 'status-low-stock' 
            : 'status-out-of-stock';

        const formattedPrice = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(product.price);

        tr.innerHTML = `
            <td>
                <img 
                    src="${product.image_path || '/images/placeholder.png'}" 
                    alt="${product.name}"
                    width="50"
                    height="50"
                    style="object-fit: cover; border-radius: 4px;"
                >
            </td>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category_name || '-')}</td>
            <td>${formattedPrice}</td>
            <td>${product.stock}</td>
            <td>
                <span class="status-badge ${stockClass}">
                    ${stockStatus}
                </span>
            </td>
            <td>
                <button 
                    class="btn btn-edit" 
                    data-product-id="${product.product_id}"
                >
                    Edit
                </button>
                <button 
                    class="btn btn-delete" 
                    data-product-id="${product.product_id}"
                >
                    Delete
                </button>
            </td>
        `;

        const editBtn = tr.querySelector('.btn-edit');
        const deleteBtn = tr.querySelector('.btn-delete');

        editBtn.addEventListener('click', () => handleEdit(product.product_id));
        deleteBtn.addEventListener('click', () => handleDelete(product.product_id, product.name));

        return tr;
    }

    // Helper functions

    function showLoading() {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        productTableContainer.style.display = 'none';
    }

    function hideLoading() {
        loadingState.style.display = 'none';
    }

    function showEmptyState() {
        hideLoading();
        emptyState.style.display = 'block';
        productTableContainer.style.display = 'none';
    }

    function hideEmptyState() {
        emptyState.style.display = 'none';
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function handleEdit(productId) {
        console.log('Edit product:', productId);
        window.location.href = `/products/edit/${productId}`;
    }

    async function handleDelete(productId, productName) {
        const confirmed = confirm(
            `Apakah Anda yakin ingin menghapus produk "${productName}"?\n\n` +
            `Produk yang dihapus tidak dapat dikembalikan.`
        );

        if (!confirmed) {
            return;
        }

        try {
            console.log('Deleting product:', productId);

            const result = await api.del(`/seller/products/${productId}`);

            if (result && result.ok) {
                showToast('Produk berhasil dihapus', 'success');
                
                products = products.filter(p => p.product_id !== productId);
                
                renderProducts();
            } else {
                throw new Error(result?.error || 'Gagal menghapus produk');
            }

        } catch (error) {
            console.error('Error deleting product:', error);
            showToast(error.message, 'error');
        }
    }

    // Event Listeners

    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            window.location.href = '/products/add';
        })
    }

    if (addFirstProductBtn) {
        addFirstProductBtn.addEventListener('click', () => {
            window.location.href = '/products/add';
        });
    }

    // Filter & Sort change listeners
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

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.error('Toast element not found!');
            return;
        }
        
        toast.textContent = message;
        toast.className = `toast ${type === 'error' ? 'error' : ''}`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
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