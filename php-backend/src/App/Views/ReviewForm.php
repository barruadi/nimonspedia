<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title ?? 'Write Review') ?> - Nimonspedia</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 30px;
        }

        .header {
            margin-bottom: 30px;
        }

        .header h1 {
            color: #333;
            margin-bottom: 10px;
        }

        .product-info {
            display: flex;
            gap: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 30px;
        }

        .product-image {
            width: 100px;
            height: 100px;
            object-fit: cover;
            border-radius: 8px;
        }

        .product-details h3 {
            color: #333;
            margin-bottom: 8px;
        }

        .product-details p {
            color: #666;
            font-size: 14px;
        }

        .form-group {
            margin-bottom: 25px;
        }

        .form-group label {
            display: block;
            color: #333;
            font-weight: 600;
            margin-bottom: 10px;
        }

        .required {
            color: #e74c3c;
        }

        .rating-input {
            display: flex;
            gap: 10px;
            flex-direction: row-reverse;
            justify-content: flex-end;
            font-size: 40px;
        }

        .rating-input input {
            display: none;
        }

        .rating-input label {
            cursor: pointer;
            color: #ddd;
            transition: color 0.2s;
        }

        .rating-input label:hover,
        .rating-input label:hover ~ label,
        .rating-input input:checked ~ label {
            color: #ffc107;
        }

        textarea {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            min-height: 120px;
        }

        textarea:focus {
            outline: none;
            border-color: #28a745;
        }

        .char-count {
            text-align: right;
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }

        .image-upload {
            border: 2px dashed #ddd;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            cursor: pointer;
            transition: border-color 0.3s;
        }

        .image-upload:hover {
            border-color: #28a745;
        }

        .image-upload input {
            display: none;
        }

        .image-preview {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            flex-wrap: wrap;
        }

        .preview-item {
            position: relative;
            width: 100px;
            height: 100px;
        }

        .preview-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 4px;
        }

        .preview-item button {
            position: absolute;
            top: -8px;
            right: -8px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
        }

        .button-group {
            display: flex;
            gap: 15px;
            margin-top: 30px;
        }

        .btn {
            padding: 12px 30px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            transition: background-color 0.3s;
        }

        .btn-primary {
            background-color: #28a745;
            color: white;
        }

        .btn-primary:hover {
            background-color: #218838;
        }

        .btn-primary:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }

        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background-color: #5a6268;
        }

        .alert {
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .alert-error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .alert-success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .upload-hint {
            font-size: 14px;
            color: #666;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Write a Review</h1>
        </div>

        <div class="product-info">
            <img src="<?= htmlspecialchars($product['image_path'] ?? '/placeholder.png') ?>"
                 alt="<?= htmlspecialchars($product['name']) ?>"
                 class="product-image">
            <div class="product-details">
                <h3><?= htmlspecialchars($product['name']) ?></h3>
                <p>Share your experience with this product</p>
            </div>
        </div>

        <form id="reviewForm" enctype="multipart/form-data">
            <input type="hidden" name="order_id" value="<?= htmlspecialchars($order_id) ?>">
            <input type="hidden" name="product_id" value="<?= htmlspecialchars($product['product_id']) ?>">

            <div class="form-group">
                <label>Rating <span class="required">*</span></label>
                <div class="rating-input">
                    <input type="radio" name="rating" id="star5" value="5" required>
                    <label for="star5">★</label>
                    <input type="radio" name="rating" id="star4" value="4">
                    <label for="star4">★</label>
                    <input type="radio" name="rating" id="star3" value="3">
                    <label for="star3">★</label>
                    <input type="radio" name="rating" id="star2" value="2">
                    <label for="star2">★</label>
                    <input type="radio" name="rating" id="star1" value="1">
                    <label for="star1">★</label>
                </div>
            </div>

            <div class="form-group">
                <label for="review_text">Your Review (Optional)</label>
                <textarea
                    id="review_text"
                    name="review_text"
                    placeholder="Share your thoughts about this product..."
                    maxlength="500"></textarea>
                <div class="char-count">
                    <span id="charCount">0</span>/500 characters
                </div>
            </div>

            <div class="form-group">
                <label>Photos (Optional - Max 3)</label>
                <div class="image-upload" onclick="document.getElementById('images').click()">
                    <input type="file" id="images" name="images[]" accept="image/*" multiple>
                    <p>📷 Click to upload photos</p>
                    <p class="upload-hint">JPG, PNG, or WebP (Max 5MB each)</p>
                </div>
                <div id="imagePreview" class="image-preview"></div>
            </div>

            <div id="alertContainer"></div>

            <div class="button-group">
                <button type="submit" class="btn btn-primary" id="submitBtn">
                    Submit Review
                </button>
                <button type="button" class="btn btn-secondary" onclick="history.back()">
                    Cancel
                </button>
            </div>
        </form>
    </div>

    <script>
        const textarea = document.getElementById('review_text');
        const charCount = document.getElementById('charCount');
        const imageInput = document.getElementById('images');
        const imagePreview = document.getElementById('imagePreview');
        const form = document.getElementById('reviewForm');
        const submitBtn = document.getElementById('submitBtn');
        const alertContainer = document.getElementById('alertContainer');

        let selectedFiles = [];

        // Character counter
        textarea.addEventListener('input', () => {
            charCount.textContent = textarea.value.length;
        });

        // Image preview
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);

            if (selectedFiles.length + files.length > 3) {
                showAlert('You can only upload up to 3 images', 'error');
                return;
            }

            files.forEach(file => {
                if (file.size > 5 * 1024 * 1024) {
                    showAlert('Each image must be less than 5MB', 'error');
                    return;
                }

                if (selectedFiles.length < 3) {
                    selectedFiles.push(file);
                    renderPreview();
                }
            });

            e.target.value = '';
        });

        function renderPreview() {
            imagePreview.innerHTML = '';
            selectedFiles.forEach((file, index) => {
                const div = document.createElement('div');
                div.className = 'preview-item';

                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = '×';
                btn.onclick = () => removeImage(index);

                div.appendChild(img);
                div.appendChild(btn);
                imagePreview.appendChild(div);
            });
        }

        function removeImage(index) {
            selectedFiles.splice(index, 1);
            renderPreview();
        }

        function showAlert(message, type) {
            alertContainer.innerHTML = `
                <div class="alert alert-${type === 'error' ? 'error' : 'success'}">
                    ${message}
                </div>
            `;
            setTimeout(() => {
                alertContainer.innerHTML = '';
            }, 5000);
        }

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const rating = form.querySelector('input[name="rating"]:checked');
            if (!rating) {
                showAlert('Please select a rating', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const formData = new FormData();
            formData.append('order_id', form.order_id.value);
            formData.append('product_id', form.product_id.value);
            formData.append('rating', rating.value);
            formData.append('review_text', textarea.value);

            selectedFiles.forEach((file) => {
                formData.append('images[]', file);
            });

            try {
                const response = await fetch('/api/reviews', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                const data = await response.json();

                if (data.ok) {
                    showAlert('Review submitted successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = '/orders';
                    }, 1500);
                } else {
                    showAlert(data.error || 'Failed to submit review', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Review';
                }
            } catch (error) {
                showAlert('An error occurred. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Review';
            }
        });
    </script>
</body>
</html>
