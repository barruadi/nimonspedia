import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './AuctionDetail.css';

const API_BASE_URL = 'http://localhost:3000/api/node';

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState(null);
  const [bidSuccess, setBidSuccess] = useState(false);

  // Fetch auction detail with CORRECT API route
  useEffect(() => {
    const fetchAuctionDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        // Validate ID
        if (!id || isNaN(id)) {
          throw new Error('Invalid auction ID');
        }

        // /auctions/:id → /auction/:id (singular)
        const response = await fetch(`${API_BASE_URL}/auction/${id}`);

        console.log('[AuctionDetail] API Response:', response.status);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Lelang tidak ditemukan');
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.error || 'Gagal memuat lelang');
        }

        setAuction(data.data);

        // Fetch bids with CORRECT API route
        // Assuming bids endpoint follows same pattern
        try {
          const bidsResponse = await fetch(`${API_BASE_URL}/auction/${id}/bids`);
          if (bidsResponse.ok) {
            const bidsData = await bidsResponse.json();
            if (bidsData.ok) {
              setBids(bidsData.data || []);
            }
          }
        } catch (bidErr) {
          console.warn('Failed to fetch bids:', bidErr);
        }

      } catch (err) {
        console.error('Error fetching auction:', err);
        setError(err.message || 'Terjadi kesalahan saat memuat lelang');
      } finally {
        setLoading(false);
      }
    };

    fetchAuctionDetail();
  }, [id]);

  // Timer untuk countdown
  useEffect(() => {
    if (!auction) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const targetTime = auction.status === 'active' 
        ? new Date(auction.end_time) 
        : new Date(auction.start_time);

      if (targetTime <= now) {
        setTimeLeft(auction.status === 'active' ? 'Berakhir' : 'Dimulai');
        return;
      }

      const diff = targetTime - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let result = '';
      if (days > 0) result = `${days}d ${hours}h ${minutes}m`;
      else if (hours > 0) result = `${hours}h ${minutes}m ${seconds}s`;
      else if (minutes > 0) result = `${minutes}m ${seconds}s`;
      else result = `${seconds}s`;

      setTimeLeft(result);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [auction, auction?.status, auction?.end_time, auction?.start_time]);

  // Format currency
  const formatPrice = (price) => {
    if (!price && price !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Place bid with validation
  const handlePlaceBid = async () => {
    try {
      setBidError(null);
      setBidSuccess(false);

      // Validation
      const bid = parseInt(bidAmount);
      if (!bidAmount || isNaN(bid)) {
        setBidError('Masukkan jumlah penawaran yang valid');
        return;
      }

      if (bid <= auction.current_price) {
        setBidError(`Penawaran harus lebih dari Rp ${auction.current_price.toLocaleString('id-ID')}`);
        return;
      }

      setSubmittingBid(true);

      // Post bid with CORRECT API route
      const response = await fetch(`${API_BASE_URL}/auction/${id}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bidder_id: 1, // TODO: Get from auth context
          bid_amount: bid,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Gagal menempatkan penawaran');
      }

      setBidSuccess(true);
      setBidAmount('');

      // Refresh bids
      const bidsResponse = await fetch(`${API_BASE_URL}/auction/${id}/bids`);
      if (bidsResponse.ok) {
        const bidsData = await bidsResponse.json();
        if (bidsData.ok) {
          setBids(bidsData.data || []);
        }
      }

      // Clear success message after 3 seconds
      setTimeout(() => setBidSuccess(false), 3000);

    } catch (err) {
      console.error('Error placing bid:', err);
      setBidError(err.message || 'Gagal menempatkan penawaran');
    } finally {
      setSubmittingBid(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="auction-detail-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Memuat detail lelang...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="auction-detail-page">
        <button className="back-btn" onClick={() => navigate('/auctions')}>← Kembali</button>
        <div className="error-container">
          <h2>⚠️ Terjadi Kesalahan</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/auctions')} className="primary-btn">
            Kembali ke Lelang
          </button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!auction) {
    return (
      <div className="auction-detail-page">
        <button className="back-btn" onClick={() => navigate('/auctions')}>← Kembali</button>
        <div className="error-container">
          <h2>Lelang Tidak Ditemukan</h2>
          <p>Lelang dengan ID {id} tidak ditemukan.</p>
          <button onClick={() => navigate('/auctions')} className="primary-btn">
            Kembali ke Lelang
          </button>
        </div>
      </div>
    );
  }

  const isActive = auction.status === 'active';
  const displayPrice = isActive ? auction.current_price : auction.starting_price;
  const highestBid = bids.length > 0 ? bids[0].bid_amount : auction.starting_price;

  return (
    <div className="auction-detail-page">
      <button className="back-btn" onClick={() => navigate('/auctions')}>← Kembali ke Lelang</button>

      <div className="detail-container">
        {/* Left: Image Section */}
        <div className="image-section">
          <div className="image-wrapper">
            <img 
              src={auction.image_path || '/placeholder.png'} 
              alt={auction.product_name}
              onError={(e) => e.target.src = '/placeholder.png'}
            />
            <span className={`status-badge ${auction.status}`}>
              {auction.status === 'active' ? '🔴 Berlangsung' : '⏱️ Akan Datang'}
            </span>
          </div>
        </div>

        {/* Right: Detail Section */}
        <div className="detail-section">
          {/* Product Info */}
          <div className="product-info">
            <h1>{auction.product_name}</h1>
            <p className="store-info">
              <span className="label">Toko:</span>
              <span className="value">{auction.store_name}</span>
            </p>
          </div>

          {/* Price Info */}
          <div className="price-section">
            <div className="price-card">
              <span className="price-label">Harga Awal</span>
              <span className="price-value">{formatPrice(auction.starting_price)}</span>
            </div>
            <div className="price-card highlight">
              <span className="price-label">Harga Saat Ini</span>
              <span className="price-value">{formatPrice(displayPrice)}</span>
            </div>
          </div>

          {/* Auction Meta Info */}
          <div className="meta-grid">
            <div className="meta-card">
              <span className="meta-label">Sisa Waktu</span>
              <span className={`meta-value ${timeLeft.includes('Berakhir') ? 'ended' : ''}`}>
                {timeLeft}
              </span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Penawaran Tertinggi</span>
              <span className="meta-value">{formatPrice(highestBid)}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Total Penawaran</span>
              <span className="meta-value">{bids.length}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Kuantitas</span>
              <span className="meta-value">{auction.quantity}</span>
            </div>
          </div>

          {/* Bid Form */}
          {isActive && (
            <div className="bid-form-section">
              <h3>Tawar Produk</h3>
              
              {bidError && <div className="alert alert-error">{bidError}</div>}
              {bidSuccess && <div className="alert alert-success">✅ Penawaran berhasil ditempatkan!</div>}

              <div className="bid-input-group">
                <input
                  type="number"
                  className="bid-input"
                  placeholder={`Minimal: ${formatPrice(displayPrice + 1000)}`}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled={submittingBid}
                  min={displayPrice + 1}
                />
                <button 
                  className="bid-submit-btn"
                  onClick={handlePlaceBid}
                  disabled={submittingBid || !bidAmount}
                >
                  {submittingBid ? 'Memproses...' : 'Tawar Sekarang'}
                </button>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="alert alert-info">
              ℹLelang ini tidak sedang berlangsung
            </div>
          )}
        </div>
      </div>

      {/* Bids Section */}
      <div className="bids-section">
        <h2>Penawaran ({bids.length})</h2>
        
        {bids.length > 0 ? (
          <div className="bids-container">
            {bids.map((bid, index) => (
              <div key={bid.bid_id} className="bid-card">
                <div className="bid-rank">#{index + 1}</div>
                <div className="bid-content">
                  <div className="bid-top">
                    <span className="bidder-name">{bid.bidder_name}</span>
                    <span className="bid-time">
                      {new Date(bid.bid_time).toLocaleString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className="bid-amount">{formatPrice(bid.bid_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-bids-container">
            <p>📭 Belum ada penawaran untuk lelang ini</p>
            {isActive && <p className="subtext">Jadilah yang pertama untuk menawar!</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuctionDetail;