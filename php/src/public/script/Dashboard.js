import { api } from '../utils/api.js';

function initDashboardPage() {
    // Dashboard Data
    let store = null;
    let stats = null;

    // DOM Elements
    const loadingState = document.getElementById('loadingState');
    const storeInfoBanner = document.getElementById('storeInfoBanner');
    const bannerStoreName = document.getElementById('bannerStoreName');
    const bannerStoreDescription = document.getElementById('bannerStoreDescription');
    const storeLogo = document.getElementById('storeLogo');
    const changeLogoBtn = document.getElementById('changeLogoBtn');
    const logoInput = document.getElementById('logoInput');
    const editStoreBtn = document.getElementById('editStoreBtn');
    const editStoreForm = document.getElementById('editStoreForm');
    const storeInfoForm = document.getElementById('storeInfoForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const cancelEditBtn2 = document.getElementById('cancelEditBtn2');
    
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
                showToast('Unauthorized - Please login as seller', 'Silakan login sebagai seller', 'error');
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
            
            console.log('Dashboard data loaded:', { store, stats });
            
            // Initialize UI
            initStoreBanner();
            initStatCards();
            initButtons();
            initEditForm();

        } catch (error) {
            console.error('Error initializing Dashboard Page:', error);
            showToast('Gagal memuat data dashboard', error.message, 'error');
            hideLoading();
        }
    }

    function initStoreBanner() {
        if (!store) return;

        // Set store info in banner
        bannerStoreName.textContent = store.store_name || 'Nama Toko';
        bannerStoreDescription.textContent = store.description || 'Belum ada deskripsi';
        
        // Set logo
        if (store.logo_path) {
            storeLogo.src = store.logo_path;
        }

        // Show banner
        storeInfoBanner.style.display = 'flex';
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
            storeInfoBanner.style.display = 'none';
        });

        // Cancel buttons - hide form
        cancelEditBtn?.addEventListener('click', hideEditForm);
        cancelEditBtn2?.addEventListener('click', hideEditForm);

        // Change logo button
        changeLogoBtn?.addEventListener('click', () => {
            logoInput.click();
        });

        // Logo upload
        logoInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                showToast('Format file tidak valid', 'Gunakan JPG, PNG, atau WEBP', 'error');
                e.target.value = '';
                return;
            }
            
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (file.size > maxSize) {
                showToast('Ukuran file terlalu besar', 'Maksimal 2MB', 'error');
                e.target.value = '';
                return;
            }

            // Preview logo
            const reader = new FileReader();
            reader.onload = function(event) {
                storeLogo.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Submit form
        storeInfoForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleStoreUpdate();
        });
    }

    function hideEditForm() {
        editStoreForm.style.display = 'none';
        storeInfoBanner.style.display = 'flex';
        
        // Reset logo if not saved
        if (store.logo_path) {
            storeLogo.src = store.logo_path;
        }
    }

    async function handleStoreUpdate() {
        try {
            const formData = new FormData(storeInfoForm);
            
            // Add logo if selected
            const logoFile = logoInput.files[0];
            if (logoFile) {
                formData.append('logo', logoFile);
            }

            const result = await api.put('/seller/store/update', formData);

            if (result && result.ok) {
                showToast('Informasi toko berhasil diperbarui', 'Data telah disimpan', 'success');
                
                // Update local data
                store.store_name = formData.get('store_name');
                store.description = formData.get('description');
                
                // Update banner
                bannerStoreName.textContent = store.store_name;
                bannerStoreDescription.textContent = store.description || 'Belum ada deskripsi';
                
                // Hide form, show banner
                hideEditForm();
                
                // If logo changed, reload to get new path
                if (logoFile) {
                    setTimeout(() => window.location.reload(), 1500);
                }
            } else {
                throw new Error(result?.error || 'Gagal memperbarui informasi toko');
            }
        } catch (error) {
            console.error('Store update error:', error);
            showToast('Gagal memperbarui toko', error.message, 'error');
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

    function showToast(primaryMessage, secondaryMessage = '', type = 'success') {
        const toast = document.getElementById('toast');
        const backdrop = document.getElementById('toastBackdrop');
        const primaryEl = document.getElementById('toastPrimaryMessage');
        const secondaryEl = document.getElementById('toastSecondaryMessage');
        const closeBtn = document.getElementById('toastCloseBtn');
        
        if (!toast || !primaryEl || !secondaryEl) {
            console.error('Toast elements not found!');
            return;
        }
        
        // Set messages and type
        primaryEl.textContent = primaryMessage;
        secondaryEl.textContent = secondaryMessage;
        toast.className = 'toast ' + type;
        
        // Show backdrop + toast
        if (backdrop) backdrop.style.display = 'block';
        toast.style.display = 'flex';
        
        // Auto hide after 5s
        let autoHideTimer = setTimeout(hideToast, 5000);
        
        // Close handlers (button and backdrop click)
        if (closeBtn) {
            closeBtn.onclick = () => {
                clearTimeout(autoHideTimer);
                hideToast();
            };
        }
        if (backdrop) {
            backdrop.onclick = () => {
                clearTimeout(autoHideTimer);
                hideToast();
            };
        }

        function hideToast() {
            if (toast) toast.style.display = 'none';
            if (backdrop) backdrop.style.display = 'none';
        }
    }

    console.log('Initializing Dashboard page...');
    initPage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboardPage);
} else {
    setTimeout(initDashboardPage, 100);
}