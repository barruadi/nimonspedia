import { useEffect, useState } from 'react';
import './AuctionCard.css';

const AuctionCard = ({ auction, onViewDetail }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isActive] = useState(auction.status === 'active');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // NEW LOGIC: If end_time is NULL, auction is waiting for first bid
      if (isActive && auction.end_time === null) {
        setTimeLeft('Menunggu Penawar Pertama');
        return;
      }

      const targetTime = isActive 
        ? new Date(auction.end_time) 
        : new Date(auction.start_time);

      if (targetTime <= now) {
        setTimeLeft(isActive ? 'Berakhir' : 'Dimulai');
        return;
      }

      const diff = targetTime - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [auction.end_time, auction.start_time, isActive]);

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
          {auction.status === 'active' ? 'Berlangsung' : 'Akan Datang'}
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
