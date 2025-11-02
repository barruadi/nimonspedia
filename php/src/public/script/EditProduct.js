import { api } from '../utils/api.js';

console.log('EditProduct.js loaded');

function initEditProductPage() {
    console.log('DOM ready, initializing edit page...');

    // Get product ID from route params
    const productId = window.routeParams?.id;
    
    if (!productId) {
        showToast('Product ID tidak ditemukan!', 'Kembali ke halaman produk...', 'error');
        setTimeout(() => window.location.href = '/seller/products', 1500);
        return;
    }

    console.log('Product ID:', productId);

    // Image Upload
    const uploadBtn = document.getElementById('uploadBtn');
    const productImageInput = document.getElementById('productImage');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    // Quill variables
    let quill = null;
    const MAX_DESCRIPTION_LENGTH = 1000;

    let currentImagePath = null;
    let imageChanged = false;

    // Click upload button -> trigger file input
    uploadBtn?.addEventListener('click', () => {
        productImageInput?.click();
    });

    // Also make container clickable
    document.querySelector('.image-upload-container')?.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            productImageInput?.click();
        }
    });

    // Handle file selection
    productImageInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showToast('Format file tidak valid!', 'Gunakan JPG, PNG, atau WEBP', 'error');
            e.target.value = '';
            return;
        }
        
        // Validate file size (max 2MB)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast('Ukuran file terlalu besar!', 'Maksimal 2MB', 'error');
            e.target.value = '';
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePlaceholder.style.display = 'none';
            imagePreviewContainer.style.display = 'flex';
            uploadBtn.textContent = 'Ganti Foto';
            imageChanged = true;
        };
        reader.readAsDataURL(file);
    });

    // Fetch Categories
    async function fetchCategories() {
        try {
            console.log('Fetching categories...');
            const result = await api.get('/categories');
            
            if (result && result.ok && result.data) {
                console.log('Categories received:', result.data.length);
                return result.data;
            } else {
                console.error('Invalid categories response');
                return [];
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    }

    function populateCategories(categories, selectedId = null) {
        const select = document.getElementById('productCategory');
        
        if (!select) {
            console.error('Category select not found');
            return;
        }
        
        select.innerHTML = '<option value="">Pilih kategori produk</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.textContent = cat.name;
            
            if (selectedId && cat.category_id == selectedId) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        console.log('Categories populated, selected:', selectedId);
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
                placeholder: 'Masukkan deskripsi produk (maksimal 1000 karakter)...'
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
                const hiddenTextarea = document.getElementById('productDescription');
                if (hiddenTextarea) {
                    hiddenTextarea.value = quill.root.innerHTML;
                }
            });

        } catch (error) {
            console.error('Error initializing Quill:', error);
        }
    }

    // Load Product Data
    async function loadProductData() {
        try {
            console.log('Loading product data...');
            
            const result = await api.get(`/seller/products/edit/${productId}`);
            
            console.log('Product data response:', result);
            
            if (!result || !result.ok) {
                throw new Error(result?.error || 'Failed to load product data');
            }

            const { product, store, categories } = result.data;

            // Set form values
            document.getElementById('product_id').value = product.product_id;
            document.getElementById('store_id').value = store.store_id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productPrice').value = parseInt(product.price);
            document.getElementById('productStock').value = parseInt(product.stock);

            // Set description to Quill editor (wait for init)
            if (quill) {
                quill.root.innerHTML = product.description;
                // Trigger text-change to update counter
                const text = quill.getText();
                const charCountEl = document.getElementById('charCount');
                if (charCountEl) {
                    charCountEl.textContent = text.trim().length;
                }
            } else {
                console.warn('Quill not initialized yet, setting hidden textarea');
                document.getElementById('productDescription').value = product.description;
            }

            // Set image preview
            if (product.image_path) {
                currentImagePath = product.image_path;
                imagePreview.src = product.image_path;
                imagePreviewContainer.style.display = 'flex';
                imagePlaceholder.style.display = 'none';
            }

            // Populate and select category
            populateCategories(categories, product.category_id);

            console.log('Product data loaded successfully');

        } catch (error) {
            console.error('Error loading product:', error);
            showToast('Gagal memuat data produk!', error.message, 'error');
            setTimeout(() => window.location.href = '/seller/products', 2000);
        }
    }

    // Form Validation
    function validateForm(formData) {
        let isValid = true;
        
        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        
        // Name
        const name = formData.get('name');
        if (!name || name.trim().length === 0) {
            document.getElementById('nameError').textContent = 'Nama produk wajib diisi';
            isValid = false;
        } else if (name.length > 200) {
            document.getElementById('nameError').textContent = 'Maksimal 200 karakter';
            isValid = false;
        }
        
        // Description - Get from Quill
        if (!quill) {
            document.getElementById('descError').textContent = 'Editor belum siap';
            isValid = false;
        } else {
            const descText = quill.getText().trim();
            
            if (descText.length === 0) {
                document.getElementById('descError').textContent = 'Deskripsi wajib diisi';
                isValid = false;
            } else if (descText.length > MAX_DESCRIPTION_LENGTH) {
                document.getElementById('descError').textContent = `Maksimal ${MAX_DESCRIPTION_LENGTH} karakter`;
                isValid = false;
            }
        }
        
        // Category
        const category = formData.get('category_id');
        if (!category) {
            document.getElementById('categoryError').textContent = 'Kategori wajib dipilih';
            isValid = false;
        }
        
        // Price
        const price = parseInt(formData.get('price'));
        if (!price || price < 1000) {
            document.getElementById('priceError').textContent = 'Harga minimal Rp 1.000';
            isValid = false;
        }
        
        // Stock
        const stock = parseInt(formData.get('stock'));
        if (isNaN(stock) || stock < 0) {
            document.getElementById('stockError').textContent = 'Stok minimal 0';
            isValid = false;
        }
        
        return isValid;
    }

    // Modal Functions
    function showEditModal() {
        const modalBackdrop = document.getElementById('editModalBackdrop');
        if (modalBackdrop) {
            modalBackdrop.style.display = 'flex';
            console.log('Edit modal shown');
        } else {
            console.error('Edit modal backdrop not found!');
        }
    }

    function hideEditModal() {
        const modalBackdrop = document.getElementById('editModalBackdrop');
        if (modalBackdrop) {
            modalBackdrop.style.display = 'none';
        }
    }

    // Handle form submission
    async function submitProductUpdate(formData) {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan...';
        
        console.log('Submitting to API...');
        console.log('Image changed:', imageChanged);
        
        try {
            // Only add image if changed
            if (imageChanged && productImageInput?.files[0]) {
                formData.set('image', productImageInput.files[0]);
                console.log('Image file added:', productImageInput.files[0].name);
            }
            
            // Log FormData contents
            console.log('FormData contents:');
            for (let [key, value] of formData.entries()) {
                if (value instanceof File) {
                    console.log(`${key}: File(${value.name}, ${value.size} bytes)`);
                } else {
                    console.log(`${key}: ${value}`);
                }
            }
            
            const result = await api.post(`/seller/products/edit/${productId}`, formData);
            
            console.log('API response:', result);
            
            if (result && result.ok) {
                showToast('Produk berhasil diperbarui!', 'Kembali ke halaman produk...', 'success');
                setTimeout(() => {
                    window.location.href = '/seller/products';
                }, 1500);
            } else {
                throw new Error(result?.error || 'Gagal memperbarui produk');
            }
            
        } catch (error) {
            console.error('Error submitting form:', error);
            showToast('Gagal memperbarui produk!', error.message, 'error');
            
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan Perubahan';
        }
    }

    // Form submit handler
    const form = document.getElementById('editProductForm');
    if (form) {
        console.log('Form found, attaching submit handler');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Form submitted');
            
            const formData = new FormData(e.target);
            
            // Validate first
            if (!validateForm(formData)) {
                console.log('Validation failed');
                return;
            }
            
            console.log('Validation passed, showing modal');
            
            // Show confirmation modal
            showEditModal();
            
            // Set up modal confirm button
            const confirmBtn = document.getElementById('editModalConfirmBtn');
            const cancelBtn = document.getElementById('editModalCancelBtn');
            
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
                hideEditModal();
            });
            
            newConfirmBtn.addEventListener('click', () => {
                console.log('Modal confirm clicked');
                hideEditModal();
                submitProductUpdate(formData);
            });
        });
    } else {
        console.error('Form editProductForm not found!');
    }

    // Cancel button - Go back to products page directly
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            console.log('Cancel button clicked, going back to products');
            window.location.href = '/seller/products';
        });
    }

    // Toast Notification
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
        
        primaryEl.textContent = primaryMessage;
        secondaryEl.textContent = secondaryMessage;
        toast.className = 'toast ' + type;
        
        if (backdrop) backdrop.style.display = 'block';
        toast.style.display = 'flex';
        
        let autoHideTimer = setTimeout(hideToast, 5000);
        
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

    // Initialize everything
    console.log('Starting initialization...');
    
    // Init Quill first, then load product data
    initQuillEditor().then(() => {
        loadProductData();
    });
}

if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initEditProductPage);
} else {
    console.log('DOM already loaded, running immediately');
    setTimeout(initEditProductPage, 100);
}