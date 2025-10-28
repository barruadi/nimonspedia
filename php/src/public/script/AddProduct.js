import { api } from '../utils/api.js';

function initAddProductPage() {
    console.log('DOM ready, initializing page...');

    // Image Upload Handler

    const uploadBtn = document.getElementById('uploadBtn');
    const productImageInput = document.getElementById('productImage');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

    // Debug: Check if elements exist
    console.log('Elements found:', {
        uploadBtn: !!uploadBtn,
        productImageInput: !!productImageInput,
        imagePlaceholder: !!imagePlaceholder,
        imagePreviewContainer: !!imagePreviewContainer,
        imagePreview: !!imagePreview
    });

    // Click upload button -> trigger file input
    uploadBtn?.addEventListener('click', () => {
        productImageInput?.click();
    });

    // Also make container clickable
    document.querySelector('.image-upload-container')?.addEventListener('click', () => {
        productImageInput?.click();
    });

    // Handle file selection
    productImageInput?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showToast('Format file harus JPG, PNG, atau WEBP', 'error');
            e.target.value = '';
            return;
        }
        
        // Validate file size (max 2MB)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            showToast('Ukuran file maksimal 2MB', 'error');
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
        };
        reader.readAsDataURL(file);
    });

    // Fetch Categories (using api/categories)

    async function fetchCategories() {
        try {
            console.log('Fetching categories...');
            const result = await api.get('/categories');
            
            console.log('Categories response:', result);
            
            if (result && result.ok && result.data) {
                console.log('Categories data received:', result.data.length, 'items');
                populateCategories(result.data);
            } else {
                console.error('Invalid categories response:', result);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    }

    function populateCategories(categories) {
        const select = document.getElementById('productCategory');
        
        console.log('Checking productCategory element:', select);
        
        if (!select) {
            console.error('Category select not found in DOM!');
            console.log('Available select elements:', document.querySelectorAll('select'));
            return;
        }
        
        console.log('Category select found, populating...');
        
        // Clear existing options (keep placeholder)
        select.innerHTML = '<option value="">Pilih kategori produk</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
        
        console.log('Categories populated:', select.options.length - 1, 'options added');
    }

    // Init Form

    async function initForm() {
        try {
            console.log('Fetching store info...');
            const result = await api.get('/seller/products/add');
            
            console.log('Store info response:', result);
            
            if (!result || !result.ok) {
                console.warn('Store info request failed:', result);
                // Don't block category fetch if store info fails
                // showToast('Unauthorized - Please login as seller', 'error');
                // setTimeout(() => window.location.href = '/login', 1500);
                // return;
            } else {
                // Set store ID
                const storeIdInput = document.getElementById('store_id');
                if (storeIdInput) {
                    storeIdInput.value = result.data.store_id;
                    console.log('Store ID set:', result.data.store_id);
                } else {
                    console.error('store_id input not found!');
                }
            }
            
            // Fetch categories (always, even if store info fails)
            await fetchCategories();
            
        } catch (error) {
            console.error('Error in initForm:', error);
            showToast('Gagal memuat informasi toko', 'error');
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
        
        // Description
        const desc = formData.get('description');
        if (!desc || desc.trim().length === 0) {
            document.getElementById('descError').textContent = 'Deskripsi wajib diisi';
            isValid = false;
        } else if (desc.length > 1000) {
            document.getElementById('descError').textContent = 'Maksimal 1000 karakter';
            isValid = false;
        }
        
        // Category
        const category = formData.get('category_id');
        if (!category) {
            document.getElementById('categoryError').textContent = 'Kategori wajib dipilih';
            isValid = false;
        }
        
        // Price
        const price = parseFloat(formData.get('price'));
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
        
        // Image
        const image = formData.get('image');
        if (!image || image.size === 0) {
            showToast('Foto produk wajib diunggah', 'error');
            isValid = false;
        }
        
        return isValid;
    }

    // Form Submission

    const form = document.getElementById('addProductForm');
    if (form) {
        console.log('Form found, attaching submit handler');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            // Add image file
            const imageFile = productImageInput?.files[0];
            if (imageFile) {
                formData.set('image', imageFile);
            }
            
            // Validate
            if (!validateForm(formData)) {
                return;
            }
            
            // Disable submit button
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Menyimpan...';
            
            try {
                const result = await api.post('/seller/products/add', formData);
                
                if (result && result.ok) {
                    showToast('Produk berhasil ditambahkan!', 'success');
                    setTimeout(() => {
                        window.location.href = '/products';
                    }, 1500);
                } else {
                    throw new Error(result?.error || 'Gagal menambahkan produk');
                }
                
            } catch (error) {
                console.error('Error submitting form:', error);
                showToast(error.message, 'error');
                
                submitBtn.disabled = false;
                submitBtn.textContent = 'Simpan';
            }
        });
    } else {
        console.error('Form #addProductForm not found!');
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Batal menambahkan produk? Perubahan tidak akan disimpan.')) {
                window.location.href = '/products';
            }
        });
    }

    // Toast Notification
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

    console.log('Initializing AddProduct page...');
    initForm();
}

if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initAddProductPage);
} else {
    console.log('DOM already loaded, running immediately');
    setTimeout(initAddProductPage, 100);
}