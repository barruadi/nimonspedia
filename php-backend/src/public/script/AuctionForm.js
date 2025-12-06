import { api } from '../utils/api.js';
import { checkSellerAuth } from '../utils/sellerAuth.js';
import { showToast } from '../utils/toast.js';
import { showLoading, hideLoading } from '../utils/loading.js';

console.log('AuctionForm.js loaded');

async function initAuctionFormPage() {
    const isAuthorized = await checkSellerAuth();
    if (!isAuthorized) return;

    console.log('DOM ready, initializing auction form...');

    // Get product ID from route params (SPA routing)
    const productId = window.routeParams?.id;

    if (!productId) {
        showToast('Product ID tidak ditemukan!', 'Kembali ke halaman produk...', 'error');
        setTimeout(() => window.location.href = '/seller/products', 1500);
        return;
    }

    console.log('Product ID:', productId);

    // Form elements
    const form = document.getElementById('auctionForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const cancelModalBackdrop = document.getElementById('cancelModalBackdrop');
    const cancelModalCancelBtn = document.getElementById('cancelModalCancelBtn');
    const cancelModalConfirmBtn = document.getElementById('cancelModalConfirmBtn');

    // Product preview elements
    const productPreviewImage = document.getElementById('productPreviewImage');
    const productPreviewName = document.getElementById('productPreviewName');
    const productPreviewPrice = document.getElementById('productPreviewPrice');
    const productPreviewStock = document.getElementById('productPreviewStock');
    const mainContent = document.getElementById('mainContent');

    // Form inputs
    const productIdInput = document.getElementById('product_id');
    const startingPriceInput = document.getElementById('startingPrice');
    const quantityInput = document.getElementById('quantity');
    const minIncrementInput = document.getElementById('minIncrement');
    const startTimeInput = document.getElementById('startTime');

    // Validation error elements
    const errorElements = {
        startingPrice: document.getElementById('startingPriceError'),
        quantity: document.getElementById('quantityError'),
        minIncrement: document.getElementById('minIncrementError'),
        startTime: document.getElementById('startTimeError')
    };

    let productData = null;

    // Load Product Data
    async function loadProductData() {
        try {
            showLoading('Memuat Produk...', 'Mengambil data produk');
            console.log('Loading product data for auction, product_id:', productId);

            const result = await api.get(`/seller/products/auction/${productId}`);

            console.log('Product data response:', result);

            if (!result || !result.ok || !result.data) {
                hideLoading();
                throw new Error(result?.error || 'Failed to load product data');
            }

            const { product } = result.data;
            productData = product;

            // Set form values
            productIdInput.value = product.product_id;
            productPreviewImage.src = product.image_path || '/images/placeholder.png';
            productPreviewName.textContent = product.name;
            productPreviewPrice.textContent = `Rp ${parseInt(product.price).toLocaleString('id-ID')}`;
            productPreviewStock.textContent = `${product.stock} Unit`;

            // Set input constraints
            quantityInput.max = product.stock;

            // Set minimum start time to 5 minutes from now
            const now = new Date();
            const minStartTime = new Date(now.getTime() + 5 * 60000);
            startTimeInput.min = minStartTime.toISOString().slice(0, 16);
            startTimeInput.value = minStartTime.toISOString().slice(0, 16);

            console.log('Product data loaded successfully');
            hideLoading();
            if (mainContent) mainContent.style.display = 'block';

        } catch (error) {
            console.error('Error loading product:', error);
            hideLoading();
            showToast('Gagal memuat data produk!', error.message, 'error');
            setTimeout(() => window.location.href = '/seller/products', 2000);
        }
    }

    // Form Validation
    function validateForm() {
        let isValid = true;

        // Clear previous errors
        Object.values(errorElements).forEach(el => {
            if (el) el.textContent = '';
        });

        // Validate starting price
        const startingPrice = parseFloat(startingPriceInput?.value || 0);
        if (!startingPriceInput?.value || isNaN(startingPrice) || startingPrice < 1000) {
            if (errorElements.startingPrice) {
                errorElements.startingPrice.textContent = 'Harga awal minimal Rp 1.000';
            }
            isValid = false;
        } 

        // Validate quantity
        const quantity = parseInt(quantityInput?.value || 0);
        if (!quantityInput?.value || isNaN(quantity) || quantity < 1) {
            if (errorElements.quantity) {
                errorElements.quantity.textContent = 'Jumlah minimal 1 unit';
            }
            isValid = false;
        } else if (productData && quantity > productData.stock) {
            if (errorElements.quantity) {
                errorElements.quantity.textContent = `Tidak boleh melebihi stok (${productData.stock} unit)`;
            }
            isValid = false;
        }

        // Validate min increment
        const minIncrement = parseFloat(minIncrementInput?.value || 0);
        if (!minIncrementInput?.value || isNaN(minIncrement) || minIncrement < 1000) {
            if (errorElements.minIncrement) {
                errorElements.minIncrement.textContent = 'Minimum kenaikan minimal Rp 1.000';
            }
            isValid = false;
        }

        // Validate start time
        if (!startTimeInput?.value) {
            if (errorElements.startTime) {
                errorElements.startTime.textContent = 'Waktu mulai wajib diisi';
            }
            isValid = false;
        } else {
            const startTime = new Date(startTimeInput.value);
            const now = new Date();
            const minStartTime = new Date(now.getTime() + 5 * 60000);

            if (startTime < minStartTime) {
                if (errorElements.startTime) {
                    errorElements.startTime.textContent = 'Waktu mulai harus minimal 5 menit dari sekarang';
                }
                isValid = false;
            }
        }

        return isValid;
    }

    // Modal Functions
    function showAuctionModal() {
        if (cancelModalBackdrop) {
            cancelModalBackdrop.style.display = 'flex';
            console.log('Auction modal shown');
        }
    }

    function hideAuctionModal() {
        if (cancelModalBackdrop) {
            cancelModalBackdrop.style.display = 'none';
        }
    }

    // Handle form submission
    async function submitAuction(formData) {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Membuat Lelang...';
        }

        try {
            // Prepare auction data
            // NOTE: end_time is NOT set here - it will be set automatically when first bid arrives (15s timer)
            const startTime = new Date(startTimeInput.value);

            const auctionData = {
                product_id: parseInt(productIdInput.value),
                starting_price: parseFloat(startingPriceInput.value),
                current_price: parseFloat(startingPriceInput.value),
                min_increment: parseFloat(minIncrementInput.value),
                quantity: parseInt(quantityInput.value),
                start_time: startTime.toISOString(),
                // end_time: NULL (will be set when first bid comes)
                status: 'scheduled'
            };

            console.log('✅ Submitting auction data (end_time will be NULL until first bid):', auctionData);

            showLoading('Mengidentifikasi Penjual...', 'Mempersiapkan data lelang');

            // Get current user ID from PHP backend
            let currentUser = null;
            try {
                console.log('Fetching /api/me...');
                const userResponse = await fetch('/api/me', {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                console.log('/api/me response status:', userResponse.status);

                const userData = await userResponse.json();
                console.log('User data received:', JSON.stringify(userData, null, 2));

                if (userData.authenticated && userData.user) {
                    currentUser = userData.user;
                    
                    // Validate user is a seller
                    if (currentUser.role !== 'seller') {
                        throw new Error('Hanya penjual yang dapat membuat lelang');
                    }
                    
                    auctionData.user_id = currentUser.id;
                    console.log('Added user_id to auctionData:', auctionData.user_id, 'Role:', currentUser.role);
                    console.log('Full auctionData now:', JSON.stringify(auctionData, null, 2));
                } else {
                    console.log('/api/me returned authenticated=false or no user:', userData);
                    throw new Error('Gagal mendapatkan informasi penjual');
                }
            } catch (err) {
                console.error('Error in /api/me fetch:', err);
                hideLoading();
                throw new Error('Gagal mengidentifikasi penjual: ' + err.message);
            }

            showLoading('Memeriksa Jadwal Lelang...', 'Memastikan tidak ada tumpang tindih');

            // NOTE: No overlap checking needed since end_time is now determined dynamically by bids
            // Seller can create multiple scheduled auctions - they only block each other when active (bidding started)

            showLoading('Membuat Lelang...', 'Mohon tunggu sebentar');

            // Submit to Node.js API
            const response = await fetch('http://localhost:3000/api/node/auction', {
                method: 'POST',
                credentials: 'include', // Include cookies (PHPSESSID)
                headers: {
                    'Content-Type': 'application/json',
                    ...(localStorage.getItem('token') && {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    })
                },
                body: JSON.stringify(auctionData)
            });

            const result = await response.json();
            console.log('Auction creation response:', result);

            if (result && result.ok) {
                hideLoading();
                showToast('Lelang berhasil dibuat!', 'Redirecting ke detail lelang...', 'success');
                setTimeout(() => {
                    window.location.href = `/auction/${result.data.auction_id}`;
                }, 1500);
            } else {
                throw new Error(result?.error || 'Gagal membuat lelang');
            }

        } catch (error) {
            console.error('Error submitting auction:', error);
            hideLoading();
            
            // Provide more specific error messages
            let errorMessage = error.message;
            if (error.message === 'Failed to fetch') {
                errorMessage = 'Tidak dapat terhubung ke server. Pastikan Node.js server running di localhost:3000';
            }
            
            showToast('Gagal membuat lelang!', errorMessage, 'error');

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Mulai Lelang';
            }
        }
    }

    // Form submit handler
    if (form) {
        console.log('Form found, attaching submit handler');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Form submitted');

            const formData = new FormData(e.target);

            // Validate first
            if (!validateForm()) {
                console.log('Validation failed');
                return;
            }

            console.log('Validation passed, showing modal');

            // Show confirmation modal
            showAuctionModal();

            // Set up modal buttons
            const confirmBtn = cancelModalConfirmBtn;
            const cancelBtn = cancelModalCancelBtn;

            if (!confirmBtn || !cancelBtn) {
                console.error('Modal buttons not found!');
                return;
            }

            // Clone buttons to remove old listeners
            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            // Add new listeners
            newCancelBtn.addEventListener('click', () => {
                console.log('Modal cancel clicked');
                hideAuctionModal();
            });

            newConfirmBtn.addEventListener('click', () => {
                console.log('Modal confirm clicked');
                hideAuctionModal();
                submitAuction(formData);
            });
        });
    } else {
        console.error('Form auctionForm not found!');
    }

    // Cancel button - Go back to products page directly
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            console.log('Cancel button clicked, going back to products');
            window.location.href = '/seller/products';
        });
    }

    // Close modal when clicking backdrop
    if (cancelModalBackdrop) {
        cancelModalBackdrop.addEventListener('click', (e) => {
            if (e.target === cancelModalBackdrop) {
                hideAuctionModal();
            }
        });
    }

    // Load product data
    console.log('Starting initialization...');
    await loadProductData();

    console.log('Auction form initialization complete.');
}

if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initAuctionFormPage);
} else {
    console.log('DOM already loaded, running immediately');
    setTimeout(initAuctionFormPage, 100);
}
