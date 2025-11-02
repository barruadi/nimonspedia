import { api } from '../utils/api.js';

function initAddProductPage() {
    console.log('DOM ready, initializing page...');

    // Image Upload Handler
    const uploadBtn = document.getElementById('uploadBtn');
    const productImageInput = document.getElementById('productImage');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    // Quill variables
    let quill = null;
    const MAX_DESCRIPTION_LENGTH = 1000;

    uploadBtn?.addEventListener('click', () => {
        productImageInput?.click();
    });

    document.querySelector('.image-upload-container')?.addEventListener('click', () => {
        productImageInput?.click();
    });

    productImageInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (!file) return;
        
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showToast('Format file tidak valid!', 'Gunakan JPG, PNG, atau WEBP', 'error');
            e.target.value = '';
            return;
        }
        
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast('Ukuran file terlalu besar!', 'Maksimal 2MB', 'error');
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePlaceholder.style.display = 'none';
            imagePreviewContainer.style.display = 'flex';
            uploadBtn.textContent = 'Ganti Foto';
        };
        reader.readAsDataURL(file);
    });

    // Fetch Categories
    async function fetchCategories() {
        try {
            console.log('Fetching categories...');
            const result = await api.get('/categories');
            
            if (result && result.ok && result.data) {
                console.log('Categories data received:', result.data.length, 'items');
                populateCategories(result.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    function populateCategories(categories) {
        const select = document.getElementById('productCategory');
        
        if (!select) return;
        
        select.innerHTML = '<option value="">Pilih kategori produk</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    }

    // Load Quill
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

    // Init Form
    async function initForm() {
        try {
            console.log('Fetching store info...');
            const result = await api.get('/seller/products/add');
            
            if (!result || !result.ok) {
                showToast('Unauthorized user!', 'Tolong login sebagai seller...', 'error');
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }

            const storeIdInput = document.getElementById('store_id');
            if (storeIdInput) {
                storeIdInput.value = result.data.store_id;
            }
            
            await fetchCategories();
            
        } catch (error) {
            console.error('Error in initForm:', error);
            showToast('Gagal memuat informasi toko!', 'Tolong kembali sesaat lagi...', 'error');
        }
    }

    // Form Validation
    function validateForm(formData) {
        let isValid = true;
        
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        
        const name = formData.get('name');
        if (!name || name.trim().length === 0) {
            document.getElementById('nameError').textContent = 'Nama produk wajib diisi';
            isValid = false;
        } else if (name.length > 200) {
            document.getElementById('nameError').textContent = 'Maksimal 200 karakter';
            isValid = false;
        }
        
        if (!quill) {
            document.getElementById('descError').textContent = 'Editor belum siap';
            isValid = false;
        } else {
            const descText = quill.getText().trim();
            
            if (descText.length === 0) {
                document.getElementById('descError').textContent = 'Deskripsi wajib diisi';
                isValid = false;
            } else if (descText.length > 1000) {
                document.getElementById('descError').textContent = `Maksimal ${1000} karakter`;
                isValid = false;
            }
        }
        
        const category = formData.get('category_id');
        if (!category) {
            document.getElementById('categoryError').textContent = 'Kategori wajib dipilih';
            isValid = false;
        }
        
        const price = parseFloat(formData.get('price'));
        if (!price || price < 1000) {
            document.getElementById('priceError').textContent = 'Harga minimal Rp 1.000';
            isValid = false;
        }
        
        const stock = parseInt(formData.get('stock'));
        if (isNaN(stock) || stock < 0) {
            document.getElementById('stockError').textContent = 'Stok minimal 0';
            isValid = false;
        }
        
        const image = formData.get('image');
        if (!image || image.size === 0) {
            showToast('Foto produk wajib diunggah!', 'Supaya pembeli tertarik dengan produkmu!', 'error');
            isValid = false;
        }
        
        return isValid;
    }

    // Form Submission
    const form = document.getElementById('addProductForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            const imageFile = productImageInput?.files[0];
            if (imageFile) {
                formData.set('image', imageFile);
            }
            
            if (!validateForm(formData)) {
                return;
            }
            
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menyimpan...';
            
            try {
                const result = await api.post('/seller/products/add', formData);
                
                if (result && result.ok) {
                    showToast('Produk berhasil ditambahkan!', 'Yuk kembali ke toko!', 'success');
                    setTimeout(() => {
                        window.location.href = '/seller/products';
                    }, 1500);
                } else {
                    throw new Error(result?.error || 'Gagal menambahkan produk');
                }
                
            } catch (error) {
                console.error('Error submitting form:', error);
                showToast('Gagal menambahkan produk!', error.message, 'error');
                
                submitBtn.disabled = false;
                submitBtn.textContent = 'Simpan';
            }
        });
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const modalBackdrop = document.getElementById('cancelModalBackdrop');
            if (modalBackdrop) {
                modalBackdrop.style.display = 'flex';
            }

            const confirmBtn = document.getElementById('cancelModalConfirmBtn');
            const cancelModalBtn = document.getElementById('cancelModalCancelBtn');

            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelModalBtn.cloneNode(true);
            
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelModalBtn.parentNode.replaceChild(newCancelBtn, cancelModalBtn);

            newCancelBtn.addEventListener('click', () => {
                modalBackdrop.style.display = 'none';
            });

            newConfirmBtn.addEventListener('click', () => {
                window.location.href = '/seller/products';
            });
        });
    }

    // Toast Notification
    function showToast(primaryMessage, secondaryMessage = '', type = 'success') {
        const toast = document.getElementById('toast');
        const backdrop = document.getElementById('toastBackdrop');
        const primaryEl = document.getElementById('toastPrimaryMessage');
        const secondaryEl = document.getElementById('toastSecondaryMessage');
        
        if (!toast || !primaryEl || !secondaryEl) return;
        
        primaryEl.textContent = primaryMessage;
        secondaryEl.textContent = secondaryMessage;
        toast.className = 'toast ' + type;
        
        if (backdrop) backdrop.style.display = 'block';
        toast.style.display = 'flex';
        
        const autoHideTimer = setTimeout(() => {
            toast.style.display = 'none';
            if (backdrop) backdrop.style.display = 'none';
        }, 5000);
        
        const closeBtn = document.getElementById('toastCloseBtn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                clearTimeout(autoHideTimer);
                toast.style.display = 'none';
                if (backdrop) backdrop.style.display = 'none';
            };
        }
    }

    // Initialize everything
    console.log('Starting initialization...');
    initQuillEditor();
    initForm();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAddProductPage);
} else {
    setTimeout(initAddProductPage, 100);
}