import { api } from '../utils/api.js';

console.log('EditProduct.js loaded');

function initEditProductPage() {
    console.log('DOM ready, initializing edit page...');

    // Get product ID from route params
    const productId = window.routeParams?.id;
    
    if (!productId) {
        showToast('Product ID tidak ditemukan', 'error');
        setTimeout(() => window.location.href = '/products', 1500);
        return;
    }

    console.log('Product ID:', productId);

    // Image Upload Handler

    const uploadBtn = document.getElementById('uploadBtn');
    const productImageInput = document.getElementById('productImage');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');

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
            imageChanged = true;
        };
        reader.readAsDataURL(file);
    });

    // Fetch GCategories

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
            document.getElementById('productDescription').value = product.description;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productStock').value = product.stock;

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
            showToast(error.message, 'error');
            setTimeout(() => window.location.href = '/products', 2000);
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
        
        return isValid;
    }

    // Form Submission

    const form = document.getElementById('editProductForm');
    if (form) {
        console.log('Form found, attaching submit handler');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            // Only add image if changed
            if (imageChanged) {
                const imageFile = productImageInput?.files[0];
                if (imageFile) {
                    formData.set('image', imageFile);
                }
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
                const result = await api.post(`/seller/products/edit/${productId}`, formData);
                
                if (result && result.ok) {
                    showToast('Produk berhasil diperbarui!', 'success');
                    setTimeout(() => {
                        window.location.href = '/products';
                    }, 1500);
                } else {
                    throw new Error(result?.error || 'Gagal memperbarui produk');
                }
                
            } catch (error) {
                console.error('Error submitting form:', error);
                showToast(error.message, 'error');
                
                submitBtn.disabled = false;
                submitBtn.textContent = 'Simpan Perubahan';
            }
        });
    } else {
        console.error('Form #editProductForm not found!');
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('Batal mengedit produk? Perubahan tidak akan disimpan.')) {
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
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    console.log('Initializing EditProduct page...');
    loadProductData();
}


if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting...');
    document.addEventListener('DOMContentLoaded', initEditProductPage);
} else {
    console.log('DOM already loaded, running immediately');
    setTimeout(initEditProductPage, 100);
}