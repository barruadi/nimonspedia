import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuctionCard from '../components/auction/AuctionCard';
import { useAuctions } from '../hooks/useAuctions'
import { useSocket } from '../hooks/useSocket';
import './AuctionList.css';

const AuctionList = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [auctions, setAuctions] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize socket
  const socket = useSocket();

  // Check user role on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('http://localhost/api/me', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.data) {
            setCurrentUser(data.data);
            
            // Redirect seller to product management
            if (data.data.role === 'seller') {
              navigate('/product-management', { replace: true });
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[AuctionList] Failed to fetch current user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  // If still loading or redirecting, show nothing
  if (loading) {
    return <div className="auction-list-page"><p>Memuat...</p></div>;
  }

  // If seller, should have been redirected above
  if (!currentUser || currentUser.role === 'seller') {
    return <div className="auction-list-page"><p>Akses ditolak</p></div>;
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch auctions based on filters (REST API)
  const { auctions: apiAuctions, loading: loadingAuctions, error, pagination } = useAuctions(
    activeTab,
    page,
    search
  );

  // Sync API data with local state
  useEffect(() => {
    setAuctions(apiAuctions);
  }, [apiAuctions]);

  // Setup socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Connect event
    const handleConnect = () => {
      console.log('[AuctionList] Socket connected');
      setSocketConnected(true);
    };

    // Disconnect event
    const handleDisconnect = () => {
      console.log('[AuctionList] Socket disconnected');
      setSocketConnected(false);
    };

    // Real-time bid placed event
    const handleBidPlaced = (data) => {
      console.log('[AuctionList] Real-time bid placed:', data);
      
      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              current_price: data.new_price || auction.current_price,
              bid_count: (auction.bid_count || 0) + 1,
            };
          }
          return auction;
        })
      );
    };

    // Real-time auction status change
    const handleAuctionStatusChanged = (data) => {
      console.log('[AuctionList] Auction status changed:', data);
      
      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              status: data.new_status,
            };
          }
          return auction;
        })
      );
    };

    // Real-time auction started
    const handleAuctionStarted = (data) => {
      console.log('[AuctionList] Auction started:', data);
      
      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              status: 'active',
              start_time: data.start_time,
            };
          }
          return auction;
        })
      );
    };

    // Real-time price update
    const handlePriceUpdate = (data) => {
      console.log('[AuctionList] Price updated:', data);
      
      setAuctions(prevAuctions =>
        prevAuctions.map(auction => {
          if (auction.auction_id === data.auction_id) {
            return {
              ...auction,
              current_price: data.current_price,
            };
          }
          return auction;
        })
      );
    };

    // Register socket listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('bid:placed', handleBidPlaced);
    socket.on('auction:status_changed', handleAuctionStatusChanged);
    socket.on('auction:started', handleAuctionStarted);
    socket.on('price:updated', handlePriceUpdate);

    // Cleanup listeners on unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('bid:placed', handleBidPlaced);
      socket.off('auction:status_changed', handleAuctionStatusChanged);
      socket.off('auction:started', handleAuctionStarted);
      socket.off('price:updated', handlePriceUpdate);
    };
  }, [socket]);

  const handleViewDetail = (auctionId) => {
    navigate(`/auction/${auctionId}`);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < pagination.totalPages) setPage(page + 1);
  };

  return (
    <div className="auction-list-container">
      <header className="list-header">
        <h1>Lelang Produk</h1>
        <p>Jelajahi berbagai produk yang sedang atau akan diluncurkan</p>
        
        {/* Socket connection indicator */}
        <div className={`socket-status ${socketConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          {socketConnected ? '🟢 Live Update Aktif' : '🔴 Live Update Offline'}
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => handleTabChange('active')}
        >
          Lelang Berlangsung
        </button>
        <button
          className={`tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
          onClick={() => handleTabChange('scheduled')}
        >
          Lelang Akan Datang
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Cari produk..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Loading State */}
      {loadingAuctions && (
        <div className="loading-container">
          <p>Memuat lelang...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-container">
          <p>⚠️ {error}</p>
        </div>
      )}

      {/* Auctions Grid */}
      {!loadingAuctions && !error && auctions.length > 0 && (
        <div className="auctions-grid">
          {auctions.map((auction) => (
            <AuctionCard
              key={auction.auction_id}
              auction={auction}
              onViewDetail={handleViewDetail}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loadingAuctions && !error && auctions.length === 0 && (
        <div className="empty-state">
          <p>Tidak ada lelang ditemukan</p>
        </div>
      )}

      {/* Pagination */}
      {!loadingAuctions && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={handlePrevPage}
            disabled={page === 1}
          >
            ← Sebelumnya
          </button>

          <span className="page-info">
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>

          <button
            className="pagination-btn"
            onClick={handleNextPage}
            disabled={page >= pagination.totalPages}
          >
            Berikutnya →
          </button>
        </div>
      )}
    </div>
  );
};

export default AuctionList;
