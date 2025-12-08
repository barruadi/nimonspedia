import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import './AuctionDetail.css';

const API_BASE_URL = 'http://localhost/api/node';

const AuctionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [authData, setAuthData] = useState(null);
  const { socket, connected } = useSocket(authData);
  
  // Auction & Bid Data
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Timer & Countdown
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const [lastCountdownReset, setLastCountdownReset] = useState(null);
  
  // Bid Form
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState(null);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [newBidAnimation, setNewBidAnimation] = useState(null);
  
  // User & Auction State
  const [currentUser, setCurrentUser] = useState(null);
  const [userBalance, setUserBalance] = useState(0);
  const [isSeller, setIsSeller] = useState(false);
  const [auctionSellerId, setAuctionSellerId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAction, setCancelAction] = useState('cancel'); // 'cancel' or 'stop'
  const [cancelLoading, setCancelLoading] = useState(false);
  const [timeSyncOffset, setTimeSyncOffset] = useState(0); // Offset antara server time dan client time (ms)

  // Disable cache untuk page ini
  useEffect(() => {
    // Set meta tag untuk no-cache
    const meta = document.querySelector('meta[http-equiv="Cache-Control"]') || 
                 document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    if (!document.querySelector('meta[http-equiv="Cache-Control"]')) {
      document.head.appendChild(meta);
    }

    // Set Pragma
    const pragmaMeta = document.querySelector('meta[http-equiv="Pragma"]') || 
                       document.createElement('meta');
    pragmaMeta.httpEquiv = 'Pragma';
    pragmaMeta.content = 'no-cache';
    if (!document.querySelector('meta[http-equiv="Pragma"]')) {
      document.head.appendChild(pragmaMeta);
    }

    // Set Expires
    const expiresMeta = document.querySelector('meta[http-equiv="Expires"]') || 
                        document.createElement('meta');
    expiresMeta.httpEquiv = 'Expires';
    expiresMeta.content = '0';
    if (!document.querySelector('meta[http-equiv="Expires"]')) {
      document.head.appendChild(expiresMeta);
    }

    return () => {
      // Clean up on unmount
      const cacheControl = document.querySelector('meta[http-equiv="Cache-Control"]');
      const pragma = document.querySelector('meta[http-equiv="Pragma"]');
      const expires = document.querySelector('meta[http-equiv="Expires"]');
      if (cacheControl) cacheControl.remove();
      if (pragma) pragma.remove();
      if (expires) expires.remove();
    };
  }, []);

  // Fetch current user from PHP backend
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(`http://localhost/api/me`, {
          credentials: 'include'
        });
        
        console.log('[AuctionDetail] PHP API response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[AuctionDetail] PHP API response data:', data);
          
          // Handle PHP API response structure: { authenticated: true, user: { id, name, role, balance } }
          if (data.authenticated && data.user) {
            const userData = {
              user_id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              balance: data.user.balance
            };
            console.log('[AuctionDetail] Extracted user data:', userData);
            setCurrentUser(userData);
            setAuthData({
              userId: data.user.id,
              userRole: data.user.role
            });
            // Ensure user_id is a number
            const userId = parseInt(userData.user_id, 10);
            console.log('[AuctionDetail] Setting currentUserId to:', userId, 'type:', typeof userId);
            setCurrentUserId(userId);
            setUserBalance(userData.balance || 0);
          } else if ((data.ok && data.data) || data.user_id) {
            // Fallback for other response structures
            const userData = data.data || data;
            console.log('[AuctionDetail] Current user fetched (fallback):', userData);
            setCurrentUser(userData);
            setAuthData({
              userId: userData.user_id,
              userRole: userData.role
            });
            const userId = parseInt(userData.user_id, 10);
            console.log('[AuctionDetail] Setting currentUserId to:', userId, 'type:', typeof userId);
            setCurrentUserId(userId);
            setUserBalance(userData.balance || 0);
          } else {
            console.warn('[AuctionDetail] PHP API response unexpected structure:', data);
          }
        } else {
          console.warn('[AuctionDetail] PHP API returned non-ok status:', response.status);
        }
      } catch (err) {
        console.warn('[AuctionDetail] Failed to fetch current user:', err.message);
        // If PHP API fails, set dummy currentUser to allow page load BUT don't set currentUserId
        const dummyUser = { user_id: 0, email: 'guest', balance: 0 };
        console.log('[AuctionDetail] Using dummy user (PHP API failed):', dummyUser);
        setCurrentUser(dummyUser);
        setCurrentUserId(null); // Keep null so isSeller won't compare with dummy user
      }
    };

    fetchCurrentUser();
  }, []);

  // Fetch auction detail - tidak perlu wait untuk currentUser
  useEffect(() => {
    const fetchAuctionDetail = async () => {
      try {
        setLoading(true);
        setError(null);

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

        const responseData = data.data;
        console.log('[AuctionDetail] Node API response:', responseData);
        console.log('[AuctionDetail] Auction object:', responseData.auction);
        console.log('[AuctionDetail] Product object:', responseData.product);
        console.log('[AuctionDetail] seller_id from auction:', responseData.auction?.seller_id);
        console.log('[AuctionDetail] seller_id from product:', responseData.product?.seller_id);
        
        const minIncrement = responseData.auction.min_increment || responseData.auction.minimum_increment || 1000;
        console.log('[AuctionDetail] min_increment from API:', {
          min_increment: responseData.auction.min_increment,
          minimum_increment: responseData.auction.minimum_increment,
          resolved: minIncrement
        });
        
        const auctionData = {
          auction_id: responseData.auction.auction_id,
          product_id: responseData.auction.product_id,
          starting_price: responseData.auction.starting_price,
          current_price: responseData.auction.current_price,
          min_increment: minIncrement,
          quantity: responseData.auction.quantity,
          start_time: responseData.auction.start_time,
          end_time: responseData.auction.end_time,
          status: responseData.auction.status,
          seller_id: responseData.auction.seller_id,
          winner_id: responseData.auction.winner_id,
          winner_name: responseData.auction.winner_name,
          product_name: responseData.product.name,
          product_description: responseData.product.description,
          image_path: responseData.product.image_path,
          store_id: responseData.store.store_id,
          store_name: responseData.store.store_name
        };

        console.log('[AuctionDetail] Winner data from API:', {
          winner_id: responseData.auction.winner_id,
          winner_name: responseData.auction.winner_name,
          status: responseData.auction.status
        });

        setAuction(auctionData);
        
        console.log('[AuctionDetail] Auction loaded:', {
          auction_id: auctionData.auction_id,
          seller_id: auctionData.seller_id,
          product_name: auctionData.product_name,
          winner_id: auctionData.winner_id,
          winner_name: auctionData.winner_name
        });
        
        console.log('[AuctionDetail] Setting auctionSellerId to:', auctionData.seller_id, 'type:', typeof auctionData.seller_id);
        
        // Ensure seller_id is a number
        if (auctionData.seller_id) {
          const sellerId = parseInt(auctionData.seller_id, 10);
          if (!isNaN(sellerId)) {
            console.log('[AuctionDetail] Converted auctionSellerId to:', sellerId, 'type:', typeof sellerId);
            setAuctionSellerId(sellerId);
          } else {
            console.error('[AuctionDetail] seller_id is not a valid number:', auctionData.seller_id);
            setAuctionSellerId(null);
          }
        } else {
          console.warn('[AuctionDetail] seller_id is null or undefined');
          setAuctionSellerId(null);
        }
        
        if (responseData.bid_history && responseData.bid_history.length > 0) {
          setBids(responseData.bid_history);
        } else {
          setBids([]);
        }

      } catch (err) {
        console.error('[AuctionDetail] Error fetching auction:', err);
        setError(err.message || 'Terjadi kesalahan saat memuat lelang');
      } finally {
        setLoading(false);
      }
    };

    fetchAuctionDetail();
  }, [id]);

  // Update isSeller when auction or currentUser changes
  useEffect(() => {
    console.log('[AuctionDetail] useEffect checking isSeller:', {
      auctionSellerId,
      currentUserId,
      type_sellerId: typeof auctionSellerId,
      type_currentId: typeof currentUserId,
      bothNull: auctionSellerId === null || currentUserId === null
    });

    // Only set isSeller if BOTH IDs are actual values (not null)
    if (auctionSellerId !== null && currentUserId !== null) {
      const isSellerUser = auctionSellerId === currentUserId;
      console.log('[AuctionDetail] isSeller CALCULATED:', {
        auctionSellerId,
        currentUserId,
        result: isSellerUser
      });
      setIsSeller(isSellerUser);
    } else {
      console.log('[AuctionDetail] SKIPPING isSeller - waiting for both IDs to be available');
      console.log('  - auctionSellerId:', auctionSellerId, '(type:', typeof auctionSellerId, ')');
      console.log('  - currentUserId:', currentUserId, '(type:', typeof currentUserId, ')');
      setIsSeller(false); // Reset to false while waiting for data
    }
  }, [auctionSellerId, currentUserId]);

  // Timer countdown with server-side sync
  useEffect(() => {
    if (!auction) return;

    const calculateCountdown = () => {
      // Jika status scheduled
      if (auction.status === 'scheduled') {
        setCountdownSeconds(null);
        return;
      }

      // Jika status ended atau cancelled
      if (auction.status === 'ended' || auction.status === 'cancelled') {
        setCountdownSeconds(0);
        return;
      }

      // Auction active tapi belum ada bid (end_time null)
      if (auction.status === 'active' && !auction.end_time) {
        setCountdownSeconds('waiting');
        return;
      }

      // Auction active dengan bid - calculate dari end_time server
      if (auction.status === 'active' && auction.end_time) {
        // Gunakan synchronized time (client time + offset)
        const syncedNow = new Date(Date.now() + timeSyncOffset);
        const endTime = new Date(auction.end_time);
        const diffMs = endTime - syncedNow;
        const seconds = Math.max(0, Math.ceil(diffMs / 1000));
        console.log(`[AuctionDetail] Timer calc (synced): syncedNow=${syncedNow.toISOString()}, end=${endTime.toISOString()}, diff=${diffMs}ms, seconds=${seconds}, offset=${timeSyncOffset}ms`);
        setCountdownSeconds(seconds);
        return;
      }

      // Default
      setCountdownSeconds(null);
    };

    // Calculate immediately saat auction data berubah
    calculateCountdown();
    
    // Then update setiap 1 detik
    const timer = setInterval(calculateCountdown, 1000);

    return () => clearInterval(timer);
  }, [auction, timeSyncOffset]);

  // Socket setup - join room and listen for updates
  useEffect(() => {
    if (!socket || !auction || !currentUser) return;

    console.log(`[AuctionDetail] Joining auction room: ${auction.auction_id}`);

    socket.emit('auction:join', {
      auctionId: auction.auction_id,
      userId: currentUser.user_id
    }, (response) => {
      if (response?.success) {
        console.log('[AuctionDetail] Successfully joined auction room');
      } else {
        console.warn('[AuctionDetail] Failed to join room:', response?.error);
      }
    });

    const handleBidUpdate = (data) => {
      console.log('[AuctionDetail] Bid update received:', data);
      console.log('[AuctionDetail] New end_time from server:', data.new_end_time);
      
      // Calculate time sync offset jika ada server_time
      if (data.server_time) {
        const serverTime = new Date(data.server_time).getTime();
        const clientTime = Date.now();
        const offset = serverTime - clientTime;
        console.log(`[AuctionDetail] Time sync: server=${serverTime}, client=${clientTime}, offset=${offset}ms`);
        setTimeSyncOffset(offset);
      }
      
      if (data.auction_id === auction.auction_id) {
        // Update auction state with new end_time from server
        setAuction(prev => ({
          ...prev,
          current_price: data.bid_amount,
          end_time: data.new_end_time,
          status: 'active'
        }));

        if (data.bid_history && Array.isArray(data.bid_history)) {
          setBids(data.bid_history);
        }

        setNewBidAnimation(true);
        setTimeout(() => setNewBidAnimation(false), 2000);
      }
    };

    const handleAuctionStarted = (data) => {
      console.log('[AuctionDetail] Auction started event received:', data);
      
      if (data.auction_id === auction.auction_id) {
        setAuction(prev => ({
          ...prev,
          status: 'active',
          start_time: data.start_time,
          end_time: data.end_time
        }));
        console.log('[AuctionDetail] Auction status updated to active');
      }
    };

    const handleAuctionCancelled = (data) => {
      console.log('[AuctionDetail] Auction cancelled event received:', data);
      
      if (data.auction_id === auction.auction_id) {
        setAuction(prev => ({
          ...prev,
          status: 'cancelled'
        }));
        setShowCancelModal(false);
        console.log('[AuctionDetail] Auction status updated to cancelled');
      }
    };

    const handleAuctionEnded = (data) => {
      console.log('[AuctionDetail] Auction ended event received:', data);
      
      if (data.auction_id === auction.auction_id) {
        setAuction(prev => ({
          ...prev,
          status: 'ended',
          winner_id: data.winner_id,
          winner_name: data.winner_name,
          current_price: data.final_price
        }));
        setCountdownSeconds(0);
        setShowCancelModal(false);
        console.log('[AuctionDetail] Auction status updated to ended with winner:', data.winner_name);
      }
    };

    const handleBidError = (data) => {
      console.error('[AuctionDetail] Bid error:', data);
      setBidError(data.error || 'Gagal menempatkan penawaran');
    };

    socket.on('auction:bid-update', handleBidUpdate);
    socket.on('auction:started', handleAuctionStarted);
    socket.on('auction:cancelled', handleAuctionCancelled);
    socket.on('auction:ended', handleAuctionEnded);
    socket.on('auction:bid-error', handleBidError);

    return () => {
      socket.emit('auction:leave', { auctionId: auction.auction_id });
      socket.off('auction:bid-update', handleBidUpdate);
      socket.off('auction:started', handleAuctionStarted);
      socket.off('auction:cancelled', handleAuctionCancelled);
      socket.off('auction:ended', handleAuctionEnded);
      socket.off('auction:bid-error', handleBidError);
    };
  }, [socket, connected, auction, currentUser?.user_id]);

  // Place bid via Socket.IO (with validation)
  const handlePlaceBid = useCallback(async () => {
    try {
      setBidError(null);
      setBidSuccess(false);

      if (auction.status !== 'active') {
        setBidError('Lelang tidak sedang berlangsung');
        return;
      }

      const bid = parseInt(bidAmount);
      if (!bidAmount || isNaN(bid)) {
        setBidError('Masukkan jumlah penawaran yang valid');
        return;
      }

      const minimumBid = auction.current_price + (auction.min_increment || 0);
      if (bid < minimumBid) {
        setBidError(`Penawaran minimal: Rp ${minimumBid.toLocaleString('id-ID')}`);
        return;
      }

      if (bid > userBalance) {
        setBidError(`Saldo Anda tidak cukup. Saldo: Rp ${userBalance.toLocaleString('id-ID')}`);
        return;
      }

      if (!socket || !connected) {
        setBidError('Koneksi socket terputus. Silakan refresh halaman.');
        return;
      }

      setSubmittingBid(true);

      socket.emit('auction:place-bid', {
        auctionId: auction.auction_id,
        bidderId: currentUser.user_id,
        bidAmount: bid
      }, (response) => {
        if (response?.success) {
          console.log('[AuctionDetail] Bid placed successfully');
          setBidSuccess(true);
          setBidAmount('');
          setUserBalance(response.data?.newBalance || userBalance - bid);
          
          setTimeout(() => setBidSuccess(false), 3000);
        } else {
          setBidError(response?.error || 'Gagal menempatkan penawaran');
          console.error('[AuctionDetail] Bid failed:', response?.error);
        }
        setSubmittingBid(false);
      });

    } catch (err) {
      console.error('[AuctionDetail] Error placing bid:', err);
      setBidError(err.message || 'Gagal menempatkan penawaran');
      setSubmittingBid(false);
    }
  }, [auction, bidAmount, userBalance, currentUser, socket]);

  // Handle seller stop/cancel auction
  const handleStopAuction = async (action) => {
    try {
      setCancelLoading(true);
      
      const endpoint = action === 'stop' 
        ? `${API_BASE_URL}/auction/${auction.auction_id}/stop`
        : `${API_BASE_URL}/auction/${auction.auction_id}/cancel`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: currentUser.user_id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Gagal menghentikan lelang');
      }

      setAuction(prev => ({
        ...prev,
        status: action === 'stop' ? 'ended' : 'cancelled',
        winner_id: data.data?.winner_id || null,
        winner_name: data.data?.winner_name || null
      }));

      setShowCancelModal(false);
      alert(`Lelang berhasil di${action === 'stop' ? 'hentikan' : 'batalkan'}!`);

    } catch (err) {
      console.error('[AuctionDetail] Error stopping auction:', err);
      const errorMsg = err.message || 'Gagal menghentikan lelang';
      
      // If error says there are bids, refresh page to get latest data
      if (errorMsg.includes('existing bids')) {
        alert('Penawaran baru telah diterima. Halaman akan di-refresh untuk menampilkan data terbaru.');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        alert(errorMsg);
      }
    } finally {
      setCancelLoading(false);
    }
  };

  // Format currency helper
  const formatPrice = (price) => {
    if (!price && price !== 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Format timer display
  const formatTimer = () => {
    if (countdownSeconds === 'waiting') {
      return 'Menunggu Bid Pertama';
    }
    
    if (countdownSeconds === null) {
      return 'Belum Dimulai';
    }
    
    if (countdownSeconds === 0) {
      return 'Berakhir';
    }

    if (typeof countdownSeconds === 'number') {
      const minutes = Math.floor(countdownSeconds / 60);
      const secs = countdownSeconds % 60;
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    return 'Menghitung...';
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
        <div className="error-container">
          <h2>Terjadi Kesalahan</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/auctions')} className="primary-btn">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!auction) {
    return (
      <div className="auction-detail-page">
        <div className="error-container">
          <h2>Lelang Tidak Ditemukan</h2>
          <p>Lelang dengan ID {id} tidak ditemukan.</p>
          <button onClick={() => navigate('/auctions')} className="primary-btn">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const isActive = auction.status === 'active';
  const displayPrice = isActive ? auction.current_price : auction.starting_price;
  const timerClass = countdownSeconds !== null && countdownSeconds !== 'waiting' && countdownSeconds < 60 ? 'timer-warning' : '';
  const nextMinBid = auction.current_price + (auction.min_increment || 1000);

  console.log('[AuctionDetail] RENDER:', {
    isSeller: isSeller,
    auctionSellerId: auctionSellerId,
    currentUserId: currentUserId,
    button_should_be: isSeller ? 'Kembali ke Product Management' : 'Kembali ke Lelang'
  });

  return (
    <div className="auction-detail-page">
      {isSeller ? (
        <button className="back-btn" onClick={() => window.location.href = 'http://localhost/seller/products'}>Kembali ke Product Management</button>
      ) : (
        <button className="back-btn" onClick={() => navigate('/auctions')}>Kembali ke Lelang</button>
      )}

      <div className="detail-container">
        {/* Left: Image Section */}
        <div className="image-section">
          <div className="image-wrapper">
            <img 
              src={auction.image_path || '/placeholder.png'} 
              alt={auction.product_name}
              onError={(e) => e.target.src = '/placeholder.png'}
            />
            <span className={`status-badge status-${auction.status}`}>
              {auction.status === 'active' ? 'ACTIVE' : auction.status === 'scheduled' ? 'SCHEDULED' : auction.status === 'ended' ? 'ENDED' : 'CANCELLED'}
            </span>
          </div>
        </div>

        {/* Right: Detail Section */}
        <div className="detail-section">
          {/* Product Info */}
          <div className="product-info">
            <h1>{auction.product_name}</h1>
            {auction.product_description && (
              <p className="product-description">{auction.product_description}</p>
            )}
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
              <span className="meta-label">Min Increment</span>
              <span className="meta-value">{formatPrice(auction.min_increment || 0)}</span>
            </div>
            <div className={`meta-card ${timerClass}`}>
              <span className="meta-label">Sisa Waktu</span>
              <span className="meta-value timer-display">{formatTimer()}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Dimulai</span>
              <span className="meta-value">{new Date(auction.start_time).toLocaleString('id-ID')}</span>
            </div>
            {auction.end_time && (
              <div className="meta-card">
                <span className="meta-label">Berakhir</span>
                <span className="meta-value">{new Date(auction.end_time).toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          {/* BUYER SECTION */}
          {!isSeller && currentUser && (
            <>
              {/* User Balance Display */}
              <div className="user-info-section">
                <div className="balance-card">
                  <span className="balance-label">Saldo Anda</span>
                  <span className="balance-value">{formatPrice(userBalance)}</span>
                </div>
              </div>

              {/* Bid Form - Only if Active */}
              {auction.status === 'active' && (
                <div className="bid-form-section">
                  <h3>Tawar Produk</h3>
                  
                  <div className="bid-requirement">
                    Bid minimal: <strong>{formatPrice(nextMinBid)}</strong>
                  </div>
                  
                  {bidError && <div className="alert alert-error">{bidError}</div>}
                  {bidSuccess && <div className="alert alert-success">✓ Penawaran berhasil ditempatkan!</div>}

                  <div className="bid-input-group">
                    <input
                      type="number"
                      className="bid-input"
                      placeholder={`Minimal: ${formatPrice(nextMinBid)}`}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      disabled={submittingBid}
                      min={nextMinBid}
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

              {/* Auction Status Messages */}
              {auction.status === 'scheduled' && (
                <div className="alert alert-info">
                  Lelang akan dimulai pada {new Date(auction.start_time).toLocaleString('id-ID')}
                </div>
              )}

              {auction.status === 'ended' && (
                <div className="winner-card">
                  <h3>Lelang Berakhir</h3>
                  {console.log('[AuctionDetail] RENDER: auction status ended, winner_id:', auction.winner_id, 'winner_name:', auction.winner_name)}
                  {auction.winner_id && (
                    <>
                      <p className="winner-info">Pemenang: <strong>{auction.winner_name || 'Pembeli'}</strong></p>
                      <p className="winner-price">Harga Akhir: <strong>{formatPrice(auction.current_price)}</strong></p>
                    </>
                  )}
                  {!auction.winner_id && (
                    <p className="no-winner">Tidak ada pemenang (tidak ada bid)</p>
                  )}
                </div>
              )}

              {auction.status === 'cancelled' && (
                <div className="alert alert-error">
                  Lelang telah dibatalkan oleh penjual
                </div>
              )}
            </>
          )}

          {/* SELLER SECTION */}
          {isSeller && currentUser && (
            <>
              {auction.status === 'scheduled' && (
                <div className="seller-actions">
                  <button 
                    className="btn btn-danger btn-cancel"
                    onClick={() => {
                      setCancelAction('cancel');
                      setShowCancelModal(true);
                    }}
                    disabled={cancelLoading}
                  >
                    Batalkan Lelang
                  </button>
                </div>
              )}

              {auction.status === 'active' && (
                <div className="seller-actions">
                  {bids.length === 0 && (
                    <button 
                      className="btn btn-danger btn-cancel"
                      onClick={() => {
                        setCancelAction('cancel');
                        setShowCancelModal(true);
                      }}
                      disabled={cancelLoading}
                    >
                      Batalkan Lelang (Tidak ada Bid)
                    </button>
                  )}
                  {bids.length > 0 && (
                    <button 
                      className="btn btn-warning btn-stop"
                      onClick={() => {
                        setCancelAction('stop');
                        setShowCancelModal(true);
                      }}
                      disabled={cancelLoading}
                    >
                      Hentikan Lelang Sekarang
                    </button>
                  )}
                </div>
              )}

              {auction.status === 'ended' && (
                <div className="seller-result-card">
                  <h3>Lelang Berakhir</h3>
                  {console.log('[AuctionDetail] RENDER SELLER: auction status ended, winner_id:', auction.winner_id, 'winner_name:', auction.winner_name)}
                  {auction.winner_id && (
                    <>
                      <p className="winner-info">Pemenang: <strong>{auction.winner_name || 'Pembeli'}</strong></p>
                      <p className="winner-price">Harga Akhir: <strong>{formatPrice(auction.current_price)}</strong></p>
                      <p className="hint">Order otomatis dibuat. Pembeli akan melakukan pembayaran.</p>
                    </>
                  )}
                  {!auction.winner_id && (
                    <p className="no-winner">Tidak ada pemenang (tidak ada bid diterima)</p>
                  )}
                </div>
              )}

              {auction.status === 'cancelled' && (
                <div className="alert alert-success">
                  ✓ Lelang dibatalkan
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Konfirmasi {cancelAction === 'cancel' ? 'Pembatalan' : 'Penghentian'} Lelang</h3>
            {cancelAction === 'cancel' && (
              <p>Apakah Anda yakin ingin <strong>MEMBATALKAN</strong> lelang ini? Tindakan ini tidak dapat dibatalkan.</p>
            )}
            {cancelAction === 'stop' && (
              <p>Apakah Anda yakin ingin <strong>MENGHENTIKAN</strong> lelang ini sekarang? Penawar tertinggi saat ini akan menjadi pemenang.</p>
            )}
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelLoading}
              >
                Batal
              </button>
              <button 
                className={`btn ${cancelAction === 'cancel' ? 'btn-danger' : 'btn-warning'}`}
                onClick={() => handleStopAuction(cancelAction)}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Memproses...' : (cancelAction === 'cancel' ? 'Batalkan' : 'Hentikan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bids History Section */}
      <div className={`bids-section ${newBidAnimation ? 'new-bid-flash' : ''}`}>
        <h2>Riwayat Penawaran - {new Set(bids.map(b => b.bidder_id)).size} Penawar</h2>
        
        {bids.length > 0 ? (
          <div className="bids-container">
            {bids.map((bid, index) => (
              <div 
                key={`${bid.bid_id}-${index}`}
                className={`bid-card ${bid.bidder_id === currentUser?.user_id ? 'own-bid' : ''} ${index === 0 ? 'highest-bid' : ''}`}
              >
                <div className="bid-rank">#{index + 1}</div>
                <div className="bid-content">
                  <div className="bid-top">
                    <span className="bidder-name">
                      {bid.bidder_id === currentUser?.user_id ? 'Anda' : bid.bidder_name || `Penawar ${bid.bidder_id}`}
                    </span>
                    <span className="bid-time">
                      {new Date(bid.bid_time).toLocaleString('id-ID', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
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
            <p>Belum ada penawaran</p>
            {auction.status === 'active' && !isSeller && (
              <p className="subtext">Jadilah yang pertama untuk menawar!</p>
            )}
            {isSeller && auction.status === 'active' && (
              <p className="subtext">Tunggu pembeli untuk menawar produk Anda...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuctionDetail;
