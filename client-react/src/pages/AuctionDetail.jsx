import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import './AuctionDetail.css';

const API_BASE_URL = 'http://localhost:3000/api/node';

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  
  // Auction & Bid Data
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Timer & Countdown
  const [timeLeft, setTimeLeft] = useState('');
  
  // Bid Form
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState(null);
  const [bidSuccess, setBidSuccess] = useState(false);
  
  // User & Auction State
  const [currentUser, setCurrentUser] = useState(null);
  const [userBalance, setUserBalance] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

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

        const response = await fetch(`${API_BASE_URL}/auction/${id}`);

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

        // Response structure: { ok: true, data: { auction: {...}, product: {...}, store: {...}, stats: {...}, bid_history: [...] } }
        const responseData = data.data;
        
        // Flatten the nested structure for easier access in component
        const auctionData = {
          auction_id: responseData.auction.auction_id,
          product_id: responseData.auction.product_id,
          starting_price: responseData.auction.starting_price,
          current_price: responseData.auction.current_price,
          min_increment: responseData.auction.min_increment || 1000,
          quantity: responseData.auction.quantity,
          start_time: responseData.auction.start_time,
          end_time: responseData.auction.end_time,
          status: responseData.auction.status,
          winner_id: responseData.auction.winner_id,
          winner_name: responseData.auction.winner_name,
          product_name: responseData.product.name,
          image_path: responseData.product.image_path,
          store_id: responseData.store.store_id,
          store_name: responseData.store.store_name
        };

        setAuction(auctionData);
        
        // Bids from response
        if (responseData.bid_history && responseData.bid_history.length > 0) {
          setBids(responseData.bid_history);
        } else {
          setBids([]);
        }

        // TODO: Fetch current user from auth context
        // setCurrentUser(getCurrentUser());
        // setUserBalance(getCurrentUserBalance());
        // setIsSeller(data.data.seller_id === getCurrentUserId());

      } catch (err) {
        console.error('Error fetching auction:', err);
        setError(err.message || 'Terjadi kesalahan saat memuat lelang');
      } finally {
        setLoading(false);
      }
    };

    fetchAuctionDetail();
  }, [id]);

  // Timer untuk countdown (dengan anti-sniping 15s)
  useEffect(() => {
    if (!auction) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      
      if (auction.status === 'active') {
        // NEW LOGIC: If end_time is NULL, auction is waiting for first bid
        if (auction.end_time === null) {
          setTimeLeft('Menunggu Penawar Pertama');
          return;
        }

        const targetTime = new Date(auction.end_time);
        const diff = targetTime - now;

        if (diff <= 0) {
          setTimeLeft('Berakhir');
          return;
        }

        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) {
          setTimeLeft(`${seconds}s`);
        } else {
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          setTimeLeft(`${minutes}m ${secs}s`);
        }
      } else {
        const targetTime = new Date(auction.start_time);
        if (targetTime <= now) {
          setTimeLeft('Dimulai');
        } else {
          const diff = targetTime - now;
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          
          if (days > 0) {
            setTimeLeft(`${days}d ${hours}h ${minutes}m`);
          } else if (hours > 0) {
            setTimeLeft(`${hours}h ${minutes}m`);
          } else {
            setTimeLeft(`${minutes}m`);
          }
        }
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [auction]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return;

    // NEW EVENT: auction:bid-update (replaces bid:placed)
    // Emitted every time a bid is placed, with new_end_time
    const handleBidUpdate = (data) => {
      console.log('[AuctionDetail] Bid update received:', data);
      
      if (data.auction_id === parseInt(id)) {
        // Update auction current price and end_time
        setAuction(prev => ({
          ...prev,
          current_price: data.bid_amount,
          end_time: data.new_end_time, // CRITICAL: Update end_time from socket (was NULL, now has value)
          status: 'active' // Ensure auction is marked as active since someone bid
        }));

        console.log(`✅ Auction ${id} end_time updated to: ${data.new_end_time} (is_first_bid: ${data.is_first_bid})`);

        // Refresh bids
        fetch(`${API_BASE_URL}/auction/${id}/bids`)
          .then(res => res.json())
          .then(bidsData => {
            if (bidsData.ok) setBids(bidsData.data || []);
          })
          .catch(err => console.warn('Failed to refresh bids:', err));
      }
    };

    const handleAuctionEnded = (data) => {
      console.log('[AuctionDetail] Auction ended:', data);
      
      if (data.auction_id === parseInt(id)) {
        setAuction(prev => ({
          ...prev,
          status: 'ended',
          winner_id: data.winner_id
        }));
        setTimeLeft('Berakhir');
      }
    };

    socket.on('auction:bid-update', handleBidUpdate);
    socket.on('auction:ended', handleAuctionEnded);

    return () => {
      socket.off('auction:bid-update', handleBidUpdate);
      socket.off('auction:ended', handleAuctionEnded);
    };
  }, [socket, id]);

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

  // Place bid with COMPLETE validation
  const handlePlaceBid = async () => {
    try {
      setBidError(null);
      setBidSuccess(false);

      // Validate auction status
      if (auction.status !== 'active') {
        setBidError('Lelang tidak sedang berlangsung');
        return;
      }

      // Validate bid amount
      const bid = parseInt(bidAmount);
      if (!bidAmount || isNaN(bid)) {
        setBidError('Masukkan jumlah penawaran yang valid');
        return;
      }

      // Validate minimum bid: current_price + min_increment
      const minimumBid = auction.current_price + (auction.min_increment || 0);
      if (bid < minimumBid) {
        setBidError(`Penawaran minimal: Rp ${minimumBid.toLocaleString('id-ID')}`);
        return;
      }

      // Validate user balance (if available)
      if (userBalance > 0 && bid > userBalance) {
        setBidError(`Saldo Anda tidak cukup. Saldo: Rp ${userBalance.toLocaleString('id-ID')}`);
        return;
      }

      setSubmittingBid(true);

      const response = await fetch(`${API_BASE_URL}/auction/${id}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bidAmount: bid,
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

      setTimeout(() => setBidSuccess(false), 3000);

    } catch (err) {
      console.error('Error placing bid:', err);
      setBidError(err.message || 'Gagal menempatkan penawaran');
    } finally {
      setSubmittingBid(false);
    }
  };

  // Handle seller stop/cancel auction
  const handleStopAuction = async (action) => {
    try {
      setCancelLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/auction/${id}/${action}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        // Request body tidak perlu seller_id - akan diambil dari auth middleware
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Gagal menghentikan lelang');
      }

      // Update auction status based on action
      setAuction(prev => ({
        ...prev,
        status: action === 'stop' ? 'ended' : 'cancelled'
      }));

      setShowCancelModal(false);
      alert(`Lelang berhasil di${action === 'stop' ? 'hentikan' : 'batalkan'}!`);

    } catch (err) {
      console.error('Error stopping auction:', err);
      alert(err.message || 'Gagal menghentikan lelang');
    } finally {
      setCancelLoading(false);
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
              <span className="meta-label">Harga Minimal Bid</span>
              <span className="meta-value">{formatPrice(auction.min_increment || 0)}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Sisa Waktu</span>
              <span className={`meta-value ${timeLeft.includes('Berakhir') ? 'ended' : ''}`}>
                {timeLeft}
              </span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Mulai</span>
              <span className="meta-value">{new Date(auction.start_time).toLocaleString('id-ID')}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Berakhir</span>
              <span className="meta-value">{new Date(auction.end_time).toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Bid Form - Buyer Only */}
          {!isSeller && auction.status === 'active' && (
            <div className="bid-form-section">
              <h3>Tawar Produk</h3>
              
              {/* User Balance Display */}
              {userBalance > 0 && (
                <div className="balance-info">
                  Saldo: <strong>{formatPrice(userBalance)}</strong>
                </div>
              )}

              {/* Minimum Bid Requirement */}
              <div className="minimum-bid-info">
                Bid minimal: <strong>{formatPrice(auction.current_price + (auction.min_increment || 0))}</strong>
              </div>
              
              {bidError && <div className="alert alert-error">{bidError}</div>}
              {bidSuccess && <div className="alert alert-success">Penawaran berhasil ditempatkan!</div>}

              <div className="bid-input-group">
                <input
                  type="number"
                  className="bid-input"
                  placeholder={`Minimal: ${formatPrice(auction.current_price + (auction.min_increment || 0))}`}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled={submittingBid}
                  min={auction.current_price + (auction.min_increment || 0)}
                />
                <button 
                  className="bid-submit-btn"
                  onClick={handlePlaceBid}
                  disabled={submittingBid || !bidAmount || auction.status !== 'active'}
                >
                  {submittingBid ? 'Memproses...' : 'Tawar Sekarang'}
                </button>
              </div>
            </div>
          )}

          {/* Seller Actions */}
          {isSeller && (
            <div className="seller-actions">
              {auction.status === 'active' && bids.length === 0 && (
                <button 
                  className="btn btn-cancel"
                  onClick={() => handleStopAuction('cancel')}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? 'Membatalkan...' : 'Batalkan Lelang'}
                </button>
              )}
              {auction.status === 'active' && bids.length > 0 && (
                <button 
                  className="btn btn-stop"
                  onClick={() => setShowCancelModal(true)}
                  disabled={cancelLoading}
                >
                  Hentikan Lelang
                </button>
              )}
            </div>
          )}

          {/* Status Badges */}
          {auction.status === 'scheduled' && (
            <div className="alert alert-info">
              ⏱️ Lelang akan dimulai {new Date(auction.start_time).toLocaleString('id-ID')}
            </div>
          )}

          {auction.status === 'ended' && (
            <div className="alert alert-success">
              🏆 Lelang berakhir. Pemenang: {auction.winner_id ? 'Ada' : 'Tidak ada'}
            </div>
          )}

          {auction.status === 'cancelled' && (
            <div className="alert alert-error">
              ❌ Lelang telah dibatalkan
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Hentikan Lelang?</h3>
            <p>Apakah Anda yakin ingin menghentikan lelang ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
              >
                Batal
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => handleStopAuction('stop')}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Memproses...' : 'Hentikan Lelang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bids Section with Enhanced Features */}
      <div className="bids-section">
        <h2>Penawaran (<span className="bid-count">{bids.length}</span>) - Total Penawar: {new Set(bids.map(b => b.bidder_id)).size}</h2>
        
        {bids.length > 0 ? (
          <div className="bids-container">
            {bids.slice(0, 10).map((bid, index) => (
              <div 
                key={bid.bid_id} 
                className={`bid-card ${bid.bidder_id === currentUser?.user_id ? 'own-bid' : ''}`}
              >
                <div className="bid-rank">#{index + 1}</div>
                <div className="bid-content">
                  <div className="bid-top">
                    <span className="bidder-name">
                      {bid.bidder_id === currentUser?.user_id ? '👤 Anda' : bid.bidder_name || 'Anonymous'}
                    </span>
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
            {auction.status === 'active' && !isSeller && <p className="subtext">Jadilah yang pertama untuk menawar!</p>}
          </div>
        )}

        {/* Load More Button */}
        {bids.length > 10 && (
          <button className="load-more-btn">
            Lihat {bids.length - 10} penawaran lainnya
          </button>
        )}
      </div>
    </div>
  );
};

export default AuctionDetail;