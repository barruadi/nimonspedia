import { useNavigate } from 'react-router-dom';
import './MessageBubble.css';

const MessageBubble = ({ message, isOwn }) => {
  const navigate = useNavigate();
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleProductClick = () => {
    if (message.product_id) {
      // Redirect to product detail page (PHP backend handles this route)
      window.location.href = `/product/${message.product_id}`;
    }
  };

  const renderMessageStatus = () => {
    if (!isOwn) return null;

    // Determine status based on message properties
    // is_read: message has been read (2 blue checks)
    // is_delivered: message has been delivered (2 gray checks)
    // default: message sent (1 gray check)

    if (message.is_read) {
      return (
        <span className="message-status read" title="Read">
          <svg width="16" height="16" viewBox="0 0 16 16" className="check-icon">
            <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 8l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      );
    } else if (message.is_delivered) {
      return (
        <span className="message-status delivered" title="Delivered">
          <svg width="16" height="16" viewBox="0 0 16 16" className="check-icon">
            <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 8l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      );
    } else {
      return (
        <span className="message-status sent" title="Sent">
          <svg width="16" height="16" viewBox="0 0 16 16" className="check-icon">
            <path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      );
    }
  };

  const renderMessageContent = () => {
    switch (message.message_type) {
      case 'text':
        return <p className="message-text">{message.content}</p>;

      case 'image':
        return (
          <div className="message-image">
            <img src={message.content} alt="Shared image" />
          </div>
        );

      case 'item_preview':
        return (
          <div
            className="message-product clickable"
            onClick={handleProductClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleProductClick();
              }
            }}
          >
            {message.product_preview && (
              <>
                {message.product_preview.image_path && (
                  <img
                    src={message.product_preview.image_path}
                    alt={message.product_preview.name}
                    className="product-image"
                  />
                )}
                <div className="product-info">
                  <h4>{message.product_preview.name}</h4>
                  <p className="product-price">
                    Rp {message.product_preview.price.toLocaleString()}
                  </p>
                  <p className="product-stock">
                    Stock: {message.product_preview.stock}
                  </p>
                  <div className="product-cta">
                    <span className="view-details">View Details →</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      default:
        return <p className="message-text">{message.content}</p>;
    }
  };

  return (
    <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
      <div className="message-content">
        {!isOwn && (
          <div className="message-sender">
            <span className="sender-name">{message.sender_name}</span>
            <span className="sender-role">({message.sender_role})</span>
          </div>
        )}
        {renderMessageContent()}
        <div className="message-footer">
          <span className="message-time">{formatTime(message.created_at)}</span>
          {renderMessageStatus()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
