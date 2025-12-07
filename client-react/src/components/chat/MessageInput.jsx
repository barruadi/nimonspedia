import { useState, useRef, useEffect } from 'react';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, onTyping, disabled, currentUser }) => {
  const [message, setMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [products, setProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (showProductPicker) {
      fetchProducts();
    }
  }, [showProductPicker]);

  const fetchProducts = async () => {
    try {
      // Fetch products from API (you may need to adjust the endpoint)
      const response = await fetch('/api/node/auctions?limit=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (data.ok) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };

  const handleSendText = () => {
    if (!message.trim()) return;

    onSendMessage({
      messageType: 'text',
      content: message.trim()
    });

    setMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      // Upload image
      const formData = new FormData();
      formData.append('image', file);

      const url = currentUser
        ? `/api/node/chat/upload-image?user_id=${currentUser.user_id}`
        : '/api/node/chat/upload-image';

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      if (data.ok) {
        // Send image message
        onSendMessage({
          messageType: 'image',
          content: data.data.imagePath
        });

        setShowAttachMenu(false);
      } else {
        alert('Failed to upload image: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProductSelect = (product) => {
    onSendMessage({
      messageType: 'item_preview',
      content: `Product: ${product.product_name}`,
      productId: product.product_id
    });

    setShowProductPicker(false);
    setShowAttachMenu(false);
  };

  return (
    <div className="message-input-container">
      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="product-picker-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Select a product to share</h3>
              <button
                className="close-btn"
                onClick={() => setShowProductPicker(false)}
              >
                ×
              </button>
            </div>
            <div className="products-list">
              {products.length === 0 ? (
                <p className="no-products">No products available</p>
              ) : (
                products.map((product) => (
                  <div
                    key={product.product_id}
                    className="product-item"
                    onClick={() => handleProductSelect(product)}
                  >
                    {product.image_path && (
                      <img
                        src={product.image_path}
                        alt={product.product_name}
                        className="product-thumbnail"
                      />
                    )}
                    <div className="product-details">
                      <h4>{product.product_name}</h4>
                      <p className="product-price">
                        Starting: Rp {product.starting_price?.toLocaleString()}
                      </p>
                      {product.current_price && (
                        <p className="product-current">
                          Current: Rp {product.current_price?.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="message-input-wrapper">
        {/* Attach Button */}
        <div className="attach-container">
          <button
            className="attach-btn"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={disabled || uploading}
            type="button"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {showAttachMenu && (
            <div className="attach-menu">
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                disabled={uploading}
              >
                <span className="icon">📷</span>
                <span>Photo</span>
              </button>
              <button
                onClick={() => {
                  setShowProductPicker(true);
                  setShowAttachMenu(false);
                }}
              >
                <span className="icon">🏷️</span>
                <span>Product</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
        </div>

        {/* Text Input */}
        <textarea
          className="message-input"
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          disabled={disabled || uploading}
          rows="1"
        />

        {/* Send Button */}
        <button
          className="send-btn"
          onClick={handleSendText}
          disabled={disabled || !message.trim() || uploading}
          type="button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
