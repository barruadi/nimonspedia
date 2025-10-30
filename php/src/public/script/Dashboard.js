import { api } from '../utils/api.js';

function initDashboardPage() {
    // Dashboard Data
    let store = null;
    let stats = null;
    let recent_orders = [];
    let low_stock_products = [];

    // DOM Elements
    const loadingState = document.getElementById('loadingState');
    const storeHeader = document.getElementById('storeHeader');
    const storeLogo = document.getElementById('storeLogo');
    const storeName = document.getElementById('storeName');
    const storeDescription = document.getElementById('storeDescription');
    const changeLogoBtn = document.getElementById('changeLogoBtn');
    const logoInput = document.getElementById('logoInput');
    const editStoreBtn = document.getElementById('editStoreBtn');
    const editStoreForm = document.getElementById('editStoreForm');
    const storeInfoForm = document.getElementById('storeInfoForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    
    const totalProductsCard = document.getElementById('totalProductsCard');
    const pendingOrdersCard = document.getElementById('pendingOrdersCard');
    const lowStockProductsCard = document.getElementById('lowStockProductsCard');
    const totalRevenueCard = document.getElementById('totalRevenueCard');
    
    // Button Elements
    const productManagementBtn = document.getElementById('productManagementBtn');
    const orderManagementBtn = document.getElementById('orderManagementBtn');
    const addProductBtn = document.getElementById('addProductBtn');

    async function initPage() {
        try {
            showLoading();
            console.log('Fetching dashboard info...');
            const result = await api.get('/seller/dashboard');
            console.log('Dashboard info response:', result);

            if (!result || !result.ok) {
                console.warn('Dashboard request failed:', result);
                showToast(result?.error || 'Unauthorized - Please login as seller', 'error');
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }

            const data = result.data;
            
            if (!data) {
                throw new Error('No data returned from API');
            }

            // Save dashboard info
            store = data.store;
            stats = data.stats;
            recent_orders = data.recent_orders || [];
            low_stock_products = data.low_stock_items || [];
            
            console.log('Dashboard data loaded:', { store, stats });
            
            // Initialize UI
            initStoreHeader();
            initStatCards();
            initButtons();
            initEditForm();

        } catch (error) {
            console.error('Error initializing Dashboard Page:', error);
            showToast('Gagal memuat data dashboard.', 'error');
            hideLoading();
        }
    }

    function initStoreHeader() {
        if (!store) return;

        // Set store info
        storeName.textContent = store.store_name || 'Nama Toko';
        storeDescription.textContent = store.description || 'Belum ada deskripsi';
        
        // Set logo
        if (store.logo_path) {
            storeLogo.src = store.logo_path;
        }

        // Show header
        storeHeader.style.display = 'flex';
    }

    function initStatCards() {
        if (!stats) {
            console.error('Stats is null/undefined');
            hideLoading();
            return;
        }

        totalProductsCard.textContent = stats.total_products || 0;
        pendingOrdersCard.textContent = stats.pending_orders || 0;
        lowStockProductsCard.textContent = stats.low_stock_products || 0;
        
        const revenue = stats.total_revenue || 0;
        totalRevenueCard.textContent = `Rp ${revenue.toLocaleString('id-ID')}`;
        
        hideLoading();
    }

    function initButtons() {
        if (productManagementBtn) {
            productManagementBtn.addEventListener('click', () => {
                window.location.href = 'products';
            });
        }

        if (orderManagementBtn) {
            orderManagementBtn.addEventListener('click', () => {
                window.location.href = 'orders';
            });
        }

        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                window.location.href = 'products/add';
            });
        }
    }

    function initEditForm() {
        // Edit button - show form
        editStoreBtn?.addEventListener('click', () => {
            document.getElementById('editStoreName').value = store.store_name || '';
            document.getElementById('editStoreDescription').value = store.description || '';
            editStoreForm.style.display = 'block';
            storeHeader.style.display = 'none';
        });

        // Cancel button - hide form
        cancelEditBtn?.addEventListener('click', () => {
            editStoreForm.style.display = 'none';
            storeHeader.style.display = 'flex';
        });

        // Change logo button
        changeLogoBtn?.addEventListener('click', () => {
            logoInput.click();
        });

        // Logo upload
        logoInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            await handleLogoUpload(file);
        });

        // Submit form
        storeInfoForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleStoreUpdate();
        });
    }

    async function handleLogoUpload(file) {
        try {
            const formData = new FormData();
            formData.append('logo', file);
            formData.append('store_name', store.store_name);
            formData.append('description', store.description || '');

            const result = await api.put('/seller/store', formData);

            if (result && result.ok) {
                showToast('Logo berhasil diperbarui', 'info');
                // Reload page to get new logo
                window.location.reload();
            } else {
                throw new Error(result?.error || 'Gagal mengupload logo');
            }
        } catch (error) {
            console.error('Logo upload error:', error);
            showToast(error.message, 'error');
        }
    }

    async function handleStoreUpdate() {
        try {
            const formData = new FormData(storeInfoForm);

            const result = await api.put('/seller/store', formData);

            if (result && result.ok) {
                showToast('Informasi toko berhasil diperbarui', 'info');
                
                // Update local data
                store.store_name = formData.get('store_name');
                store.description = formData.get('description');
                
                // Update UI
                storeName.textContent = store.store_name;
                storeDescription.textContent = store.description || 'Belum ada deskripsi';
                
                // Hide form, show header
                editStoreForm.style.display = 'none';
                storeHeader.style.display = 'flex';
            } else {
                throw new Error(result?.error || 'Gagal memperbarui informasi toko');
            }
        } catch (error) {
            console.error('Store update error:', error);
            showToast(error.message, 'error');
        }
    }

    // Helper functions
    function showLoading() {
        if (loadingState) {
            loadingState.style.display = 'block';
        }
    }

    function hideLoading() {
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    console.log('Initializing Dashboard page...');
    initPage();
}

if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initDashboardPage);
} else {
    console.log('DOM already loaded, running immediately');
    setTimeout(initDashboardPage, 100);
}