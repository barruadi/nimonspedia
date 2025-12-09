import { useEffect, useState } from 'react';
import './AuctionCard.css';

const AuctionCard = ({ auction, onViewDetail }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const isActive = auction.status === 'active';
  const isScheduled = auction.status === 'scheduled';

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // SCHEDULED: Count down to start_time
      if (isScheduled) {
        const startTime = new Date(auction.start_time);
        if (startTime <= now) {
          setTimeLeft('Dimulai');
          return;
        }
        
        const diff = startTime - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (days > 0) {
          setTimeLeft(`${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeLeft(`${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${seconds}s`);
        }
        return;
      }
      
      // ACTIVE: If end_time is NULL, auction is waiting for first bid
      if (isActive && auction.end_time === null) {
        setTimeLeft('Menunggu Bid');
        return;
      }

      // ACTIVE: Count down to end_time
      if (isActive && auction.end_time) {
        const endTime = new Date(auction.end_time);
        if (endTime <= now) {
          setTimeLeft('Berakhir');
          return;
        }

        const diff = endTime - now;
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 0) {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeLeft(`${minutes}m ${seconds}s`);
        }
        return;
      }
      
      setTimeLeft('Info tidak tersedia');
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [auction.end_time, auction.start_time, isActive, isScheduled]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const displayPrice = isActive ? auction.current_price : auction.starting_price;

  return (
    <div className="auction-card">
      <div className="card-image">
        <img 
          src={auction.image_path || '/placeholder.png'} 
          alt={auction.product_name}
        />
        <span className={`status-badge ${auction.status}`}>
          {auction.status === 'active' ? 'Berlangsung' : auction.status === 'scheduled' ? 'Akan Datang' : 'Status Lainnya'}
        </span>
      </div>

      <div className="card-content">
        <h3 className="product-name">{auction.product_name}</h3>
        <p className="store-name">{auction.store_name}</p>

        <div className="price-section">
          <span className="current-price">{formatPrice(displayPrice)}</span>
        </div>

        <div className="auction-info">
          <div className="info-item">
            <span className="label">Penawaran</span>
            <span className="value">{auction.bid_count || 0}</span>
          </div>
          <div className="info-item">
            <span className="label">Sisa Waktu</span>
            <span className={`value ${timeLeft.includes('Berakhir') ? 'ended' : ''}`}>
              {timeLeft}
            </span>
          </div>
        </div>

        <button 
          className="detail-btn"
          onClick={() => onViewDetail(auction.auction_id)}
        >
          Lihat Detail
        </button>
      </div>
    </div>
  );
};

export default AuctionCard;
