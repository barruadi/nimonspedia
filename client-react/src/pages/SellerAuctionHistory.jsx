import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar/Navbar';
import AuctionCard from '../components/auction/AuctionCard';
import { useSocket } from '../hooks/useSocket';
import './SellerAuctionHistory.css';

const API_BASE_URL = 'http://localhost/api/node';

const SellerAuctionHistory = () => {
  const navigate = useNavigate();
  const [authData, setAuthData] = useState(null);
  const { socket, connected } = useSocket(authData);

  // State
  const [currentUser, setCurrentUser] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, active, scheduled, ended, cancelled

  // Fetch current user from PHP backend
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(`http://localhost/api/me`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            const userData = {
              user_id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              balance: data.user.balance
            };
            setCurrentUser(userData);
            setAuthData({
              userId: data.user.id,
              userRole: data.user.role
            });

            // Redirect if not seller
            if (data.user.role !== 'seller') {
              alert('Halaman ini hanya untuk seller');
              window.location.href = '/auctions';
            }
          }
        } else {
          window.location.href = 'http://localhost/login';
        }
      } catch (err) {
        console.error('[SellerAuctionHistory] Failed to fetch current user:', err);
        window.location.href = 'http://localhost/login';
      }
    };

    fetchCurrentUser();
  }, []);

  // Fetch auctions for current seller
  useEffect(() => {
    if (!currentUser?.user_id) return;

    const fetchAuctions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_BASE_URL}/auctions?seller_id=${currentUser.user_id}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.ok && Array.isArray(data.data)) {
          setAuctions(data.data);
        } else {
          setAuctions([]);
        }
      } catch (err) {
        console.error('[SellerAuctionHistory] Error fetching auctions:', err);
        setError(err.message || 'Gagal memuat data lelang');
      } finally {
        setLoading(false);
      }
    };

    fetchAuctions();
  }, [currentUser?.user_id]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket || !connected || !currentUser) return;

    const handleBidUpdate = (data) => {
      console.log('[SellerAuctionHistory] Bid update received:', data);

      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              current_price: data.bid_amount,
              end_time: data.new_end_time,
              status: 'active'
            };
          }
          return auction;
        })
      );
    };

    const handleAuctionStarted = (data) => {
      console.log('[SellerAuctionHistory] Auction started:', data);

      setAuctions(prevAuctions => {
        const exists = prevAuctions.some(a => a.auction_id === data.auction_id);

        if (exists) {
          // Update existing auction
          return prevAuctions.map(auction => {
            if (auction.auction_id === data.auction_id) {
              return {
                ...auction,
                status: 'active',
                start_time: data.start_time,
                end_time: data.end_time
              };
            }
            return auction;
          });
        } else {
          // Add new auction to list
          return [data, ...prevAuctions];
        }
      });
    };

    const handleAuctionEnded = (data) => {
      console.log('[SellerAuctionHistory] Auction ended:', data);

      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              status: 'ended',
              winner_id: data.winner_id,
              winner_name: data.winner_name,
              current_price: data.final_price
            };
          }
          return auction;
        })
      );
    };

    const handleAuctionCancelled = (data) => {
      console.log('[SellerAuctionHistory] Auction cancelled:', data);

      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              status: 'cancelled'
            };
          }
          return auction;
        })
      );
    };

    socket.on('auction:bid-update', handleBidUpdate);
    socket.on('auction:started', handleAuctionStarted);
    socket.on('auction:ended', handleAuctionEnded);
    socket.on('auction:cancelled', handleAuctionCancelled);

    return () => {
      socket.off('auction:bid-update', handleBidUpdate);
      socket.off('auction:started', handleAuctionStarted);
      socket.off('auction:ended', handleAuctionEnded);
      socket.off('auction:cancelled', handleAuctionCancelled);
    };
  }, [socket, connected, currentUser?.user_id]);

  // Filter auctions based on active tab
  const getFilteredAuctions = useCallback(() => {
    if (activeTab === 'all') {
      return auctions;
    }

    return auctions.filter(auction => {
      if (activeTab === 'active') {
        return auction.status === 'active' || auction.status === 'scheduled';
      }
      if (activeTab === 'ended') {
        return auction.status === 'ended';
      }
      if (activeTab === 'cancelled') {
        return auction.status === 'cancelled';
      }
      return true;
    });
  }, [auctions, activeTab]);

  const filteredAuctions = getFilteredAuctions();

  // Handle create new auction button
  const handleCreateAuction = () => {
    window.location.href = 'http://localhost/seller/products';
  };

  return (
    <>
      <Navbar role="seller" />
      <div className="seller-auction-history-page">
        <div className="history-container">
          {/* Header Section */}
          <div className="history-header">
            <div className="header-content">
              <h1>Daftar Lelang Saya</h1>
              <p className="subtitle">Kelola dan pantau semua lelang Anda</p>
            </div>
            <button
              className="create-auction-btn"
              onClick={handleCreateAuction}
            >
              + Buat Lelang Baru
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="filter-tabs">
            <button
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Semua ({auctions.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Sedang Berjalan (
              {auctions.filter(a => a.status === 'active' || a.status === 'scheduled').length}
              )
            </button>
            <button
              className={`tab-btn ${activeTab === 'ended' ? 'active' : ''}`}
              onClick={() => setActiveTab('ended')}
            >
              Selesai (
              {auctions.filter(a => a.status === 'ended').length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
            >
              Dibatalkan (
              {auctions.filter(a => a.status === 'cancelled').length})
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Memuat data lelang...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="error-container">
              <h3>⚠️ Terjadi Kesalahan</h3>
              <p>{error}</p>
              <button
                className="retry-btn"
                onClick={() => window.location.reload()}
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredAuctions.length === 0 && (
            <div className="empty-state">
              <img src="http://localhost/uploads/seller/dashboard-logo.svg" alt="No auctions" className="empty-icon" />
              <h3>Belum ada lelang</h3>
              <p>
                {activeTab === 'all'
                  ? 'Anda belum membuat lelang apapun. Mulai buat lelang pertama Anda sekarang!'
                  : 'Tidak ada lelang pada kategori ini'}
              </p>
              {activeTab === 'all' && (
                <button
                  className="empty-create-btn"
                  onClick={handleCreateAuction}
                >
                  Buat Lelang Sekarang
                </button>
              )}
            </div>
          )}

          {/* Auctions Grid */}
          {!loading && !error && filteredAuctions.length > 0 && (
            <div className="auctions-grid">
              {filteredAuctions.map(auction => (
                <AuctionCard
                  key={auction.auction_id}
                  auction={auction}
                  isSellerView={true}
                  onViewDetail={(auctionId) =>
                    navigate(`/auction/${auctionId}`)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SellerAuctionHistory;
