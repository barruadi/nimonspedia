import { api } from '../utils/api.js';

function initDashboardPage() {
    // Dashboard Data
    let store = null;
    let stats = null;

    // Quill Editor
    let quill = null;
    const MAX_DESCRIPTION_LENGTH = 500;

    // DOM Elements
    const loadingState = document.getElementById('loadingState');
    const mainContent = document.getElementById('mainContent');
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
    const exportDataBtn = document.getElementById('exportDataBtn');

    async function initPage() {
        try {
            showLoading();
            console.log('Fetching dashboard info...');
            const result = await api.get('/seller/dashboard');
            console.log('Dashboard info response:', result);

            if (!result || !result.ok) {
                console.warn('Dashboard request failed:', result);
                showToast('Unauthorized user!', 'Tolong login sebagai seller...', 'error');
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }

            const data = result.data;
            
            if (!data) {
                throw new Error('No data returned from API');
            }

            store = data.store;
            stats = data.stats;
            
            console.log('Dashboard data loaded:', { store, stats });
            
            await initQuillEditor();
            
            initStoreBanner();
            initStatCards();
            initButtons();
            initEditForm();

            hideLoading();
            showMainContent();

        } catch (error) {
            console.error('Error initializing Dashboard Page:', error);
            showToast('Gagal memuat data dashboard', error.message, 'error');
            hideLoading();
        }
    }

    function initStoreBanner() {
        if (!store) return;

        bannerStoreName.textContent = store.store_name || 'Nama Toko';
        
        if (store.description) {
            bannerStoreDescription.innerHTML = store.description;
        } else {
            bannerStoreDescription.textContent = 'Belum ada deskripsi';
        }
        
        if (store.logo_path) {
            storeLogo.src = store.logo_path;
        }
    }

    function initStatCards() {
        if (!stats) {
            console.error('Stats is null/undefined');
            return;
        }

        totalProductsCard.textContent = stats.total_products || 0;
        pendingOrdersCard.textContent = stats.pending_orders || 0;
        lowStockProductsCard.textContent = stats.low_stock_products || 0;
        
        const revenue = stats.total_revenue || 0;
        totalRevenueCard.textContent = `Rp ${revenue.toLocaleString('id-ID')}`;
    }

    function initButtons() {
        if (productManagementBtn) {
            productManagementBtn.addEventListener('click', () => {
                window.location.href = '/seller/products';
            });
        }

        if (orderManagementBtn) {
            orderManagementBtn.addEventListener('click', () => {
                window.location.href = '/seller/orders';
            });
        }

        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => {
                window.location.href = '/seller/products/add';
            });
        }

        // Export Button Handler
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', async () => {
                try {
                    exportDataBtn.disabled = true;
                    exportDataBtn.textContent = 'Memproses...';
                    
                    showToast('Memproses export...', 'Tunggu sebentar', 'success');

                    // Call API to get CSV data
                    const result = await api.get('/seller/export');
                    
                    console.log('Export result:', result);

                    if (!result || !result.ok) {
                        throw new Error(result?.error || 'Export gagal');
                    }

                    // Decode base64 CSV
                    const csvData = atob(result.data.csv);
                    const filename = result.data.filename;

                    // Create blob and download
                    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    
                    if (navigator.msSaveBlob) { // IE 10+
                        navigator.msSaveBlob(blob, filename);
                    } else {
                        const url = URL.createObjectURL(blob);
                        link.href = url;
                        link.download = filename;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                    }

                    showToast('Export berhasil!', `File ${filename} telah diunduh`, 'success');

                } catch (error) {
                    console.error('Export error:', error);
                    showToast('Export gagal', error.message, 'error');
                } finally {
                    exportDataBtn.disabled = false;
                    exportDataBtn.textContent = 'Export Data Toko';
                }
            });
        }
    }

    // Load Quill Script
    function loadQuillScript() {
        return new Promise((resolve, reject) => {
            // Check if Quill already exists
            if (window.Quill) {
                console.log('Quill already loaded');
                resolve();
                return;
            }

            // Check if script is already being loaded
            if (document.querySelector('script[src*="quill.js"]')) {
                console.log('Quill script already in DOM, waiting...');
                const checkQuill = setInterval(() => {
                    if (window.Quill) {
                        clearInterval(checkQuill);
                        resolve();
                    }
                }, 100);
                return;
            }

            console.log('Loading Quill script...');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';
            script.onload = () => {
                console.log('Quill script loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load Quill script');
                reject(new Error('Failed to load Quill'));
            };
            document.head.appendChild(script);
        });
    }

    // Initialize Quill Editor
    async function initQuillEditor() {
        try {
            await loadQuillScript();

            const editorElement = document.getElementById('editor');
            
            if (!editorElement) {
                console.error('Editor element not found');
                return;
            }

            console.log('Initializing Quill editor...');

            quill = new Quill('#editor', {
                theme: 'snow',
                placeholder: 'Ceritakan tentang toko Anda (maksimal 500 karakter)...'
            });

            console.log('Quill editor initialized!');

            // Character counter
            quill.on('text-change', function() {
                const text = quill.getText();
                const length = text.trim().length;
                
                const charCountEl = document.getElementById('charCount');
                if (charCountEl) {
                    charCountEl.textContent = length;
                }
                
                // Update hidden textarea
                const hiddenTextarea = document.getElementById('editStoreDescription');
                if (hiddenTextarea) {
                    hiddenTextarea.value = quill.root.innerHTML;
                }
            });

        } catch (error) {
            console.error('Error initializing Quill:', error);
        }
    }

    function initEditForm() {
        // Edit button - show form
        editStoreBtn?.addEventListener('click', () => {
            document.getElementById('editStoreName').value = store.store_name || '';
            
            // Set description to Quill editor
            if (quill) {
                quill.root.innerHTML = store.description || '';
                // Trigger text-change to update counter
                const text = quill.getText();
                const charCountEl = document.getElementById('charCount');
                if (charCountEl) {
                    charCountEl.textContent = text.trim().length;
                }
            }
            
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
            
            // Validate description from Quill
            if (quill) {
                const descText = quill.getText().trim();
                
                if (descText.length > MAX_DESCRIPTION_LENGTH) {
                    showToast('Deskripsi terlalu panjang', `Maksimal ${MAX_DESCRIPTION_LENGTH} karakter`, 'error');
                    return;
                }
                
                // Set description from Quill
                formData.set('description', quill.root.innerHTML);
            }
            
            // Add logo if selected
            const logoFile = logoInput.files[0];
            if (logoFile) {
                formData.append('logo', logoFile);
                console.log('Logo file added:', logoFile.name, logoFile.size, 'bytes');
            }

            console.log('Submitting store update...');
            console.log('Store name:', formData.get('store_name'));
            console.log('Description length:', quill ? quill.getText().trim().length : 0);
            console.log('Has logo:', !!logoFile);

            const result = await api.post('/seller/store/update', formData);

            console.log('Update result:', result);

            if (result && result.ok) {
                showToast('Informasi toko berhasil diperbarui', 'Data telah disimpan', 'success');
                
                // Update local data
                store.store_name = formData.get('store_name');
                store.description = formData.get('description');
                
                // Update banner
                bannerStoreName.textContent = store.store_name;
                
                // Update banner description
                if (store.description) {
                    bannerStoreDescription.innerHTML = store.description;
                } else {
                    bannerStoreDescription.textContent = 'Belum ada deskripsi';
                }
                
                // If logo changed, update preview
                if (result.data && result.data.logo_path) {
                    store.logo_path = result.data.logo_path;
                    storeLogo.src = result.data.logo_path;
                }
                
                // Hide form, show banner
                hideEditForm();
                
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
            loadingState.style.display = 'flex';
        }
        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    function hideLoading() {
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }

    function showMainContent() {
        if (mainContent) {
            mainContent.style.display = 'block';
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