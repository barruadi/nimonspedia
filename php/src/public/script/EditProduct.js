import { api } from '../utils/api.js';

// Initialize Quill Rich Text Editor
const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Enter product description (max 1000 characters)...',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
        ]
    }
});

// Character limit for description
quill.on('text-change', function() {
    const text = quill.getText();
    if (text.length > 1000) {
        quill.deleteText(1000, text.length);
        document.getElementById('descError').textContent = 'Maximum 1000 characters';
    } else {
        document.getElementById('descError').textContent = '';
    }
});

// Get product ID from URL query parameter
function getProductIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Fetch categories from API
async function fetchCategories() {
    try {
        const result = await api.get('/categories');
        if (result && result.ok) {
            populateCategories(result.data);
        }
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

// Populate category dropdown
function populateCategories(categories) {
    const select = document.getElementById('productCategory');
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.category_id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

// Fetch product data and store info when page loads
async function initForm() {
    const productId = getProductIdFromURL();
    
    if (!productId) {
        showToast('Product ID not found in URL', 'error');
        setTimeout(() => window.location.href = '/seller/product-management', 1500);
        return;
    }
    
    document.getElementById('current_product_id').textContent = productId;
    document.getElementById('product_id').value = productId;
    
    try {
        const result = await api.get(`/seller/products/edit/${productId}`);
        
        if (!result || !result.ok) {
            showToast(result?.error || 'Failed to load product data', 'error');
            setTimeout(() => window.location.href = '/seller/product-management', 1500);
            return;
        }
        
        const product = result.data.product;
        const store = result.data.store;
        const categories = result.data.categories;
        
        // Populate form
        document.getElementById('store_id').value = store.store_id;
        document.getElementById('store_name').textContent = store.store_name || 'Unknown';
        
        document.getElementById('productName').value = product.name || '';
        quill.root.innerHTML = product.description || '';
        document.getElementById('productPrice').value = product.price || 0;
        document.getElementById('productStock').value = product.stock || 0;
        
        // Populate categories
        populateCategories(categories);
        if (product.category_id) {
            document.getElementById('productCategory').value = product.category_id;
        }
        
        // Display current image
        if (product.image_path) {
            document.getElementById('currentImage').src = product.image_path;
            document.getElementById('currentImageContainer').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error fetching product data:', error);
        showToast('Failed to load product information', 'error');
    }
}

// "Ganti Foto" button - trigger file input
document.getElementById('changeImageBtn').addEventListener('click', function() {
    document.getElementById('productImage').click();
});

// Image preview for new upload
document.getElementById('productImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const errorEl = document.getElementById('imageError');
    errorEl.textContent = '';
    
    if (!file) return;
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        errorEl.textContent = 'Only JPG, JPEG, PNG, WEBP allowed';
        e.target.value = '';
        return;
    }
    
    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
        errorEl.textContent = 'File size must be less than 2MB';
        e.target.value = '';
        return;
    }
    
    // Show new image preview
    const reader = new FileReader();
    reader.onload = function(event) {
        document.getElementById('newImagePreview').src = event.target.result;
        document.getElementById('newImageContainer').style.display = 'block';
    };
    reader.readAsDataURL(file);
});

// Cancel button
document.getElementById('cancelBtn').addEventListener('click', function() {
    if (confirm('Batal mengubah produk? Perubahan tidak akan disimpan.')) {
        window.location.href = '/seller/product-management';
    }
});

// Form validation
function validateForm(formData) {
    let isValid = true;
    
    // Clear previous errors
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
    
    // Name validation
    const name = formData.get('name');
    if (!name || name.length > 200) {
        document.getElementById('nameError').textContent = 'Name required (max 200 chars)';
        isValid = false;
    }
    
    // Description validation
    const descText = quill.getText().trim();
    if (descText.length === 0 || descText.length > 1000) {
        document.getElementById('descError').textContent = 'Description required (max 1000 chars)';
        isValid = false;
    }
    
    // Category validation
    const category = formData.get('category_id');
    if (!category) {
        document.getElementById('categoryError').textContent = 'Category required';
        isValid = false;
    }
    
    // Price validation
    const price = parseFloat(formData.get('price'));
    if (!price || price < 1000) {
        document.getElementById('priceError').textContent = 'Price must be at least Rp 1,000';
        isValid = false;
    }
    
    // Stock validation
    const stock = parseInt(formData.get('stock'));
    if (stock < 0 || isNaN(stock)) {
        document.getElementById('stockError').textContent = 'Stock must be 0 or more';
        isValid = false;
    }
    
    return isValid;
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'success' ? '#4CAF50' : '#f44336';
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Show confirmation modal
function showConfirmationModal() {
    document.getElementById('confirmModal').style.display = 'block';
}

// Hide confirmation modal
function hideConfirmationModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Cancel confirmation
document.getElementById('cancelConfirm').addEventListener('click', hideConfirmationModal);

// Proceed with submission
document.getElementById('proceedConfirm').addEventListener('click', function() {
    hideConfirmationModal();
    submitForm();
});

// Handle form submission (with confirmation)
const form = document.getElementById('editProductForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get Quill content and set to hidden input
        const descHtml = quill.root.innerHTML;
        document.getElementById('productDescription').value = descHtml;
        
        // Get form data
        const formData = new FormData(e.target);
        
        // Client-side validation
        if (!validateForm(formData)) {
            showToast('Please fix validation errors', 'error');
            return;
        }
        
        // Show confirmation modal
        showConfirmationModal();
    });
}

// Actual form submission logic
async function submitForm() {
    const formData = new FormData(document.getElementById('editProductForm'));
    const productId = formData.get('product_id');
    
    // Disable submit button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';
    
    // Show progress bar
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    progressBar.style.display = 'block';
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += 10;
        progressFill.style.width = progress + '%';
        if (progress >= 90) clearInterval(progressInterval);
    }, 100);
    
    try {
        const result = await api.post(`/seller/products/edit/${productId}`, formData);
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        
        if (result && result.ok) {
            showToast('Produk berhasil diupdate', 'success');
            
            // Redirect after 1.5 seconds
            setTimeout(() => {
                window.location.href = '/seller/product-management';
            }, 1500);
            
        } else {
            throw new Error(result?.error || 'Failed to update product');
        }
        
    } catch (error) {
        console.error('Error submitting form:', error);
        showToast(error.message || 'Network error. Please try again.', 'error');
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Simpan Perubahan';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

// Initialize form on page load
initForm();