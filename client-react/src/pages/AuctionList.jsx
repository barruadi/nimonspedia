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
  const [authData, setAuthData] = useState(null);

  // Initialize socket - MUST be before any returns
  const { socket, connected } = useSocket(authData);

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

  // Check user role on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('http://localhost/api/me', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[AuctionList] PHP API response:', data);
          
          // Handle PHP API response structure: { authenticated: true, user: { id, name, role, ... } }
          if (data.authenticated && data.user) {
            const userData = {
              user_id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              balance: data.user.balance
            };
            console.log('[AuctionList] User data:', userData);
            setCurrentUser(userData);
            setAuthData({
              userId: data.user.id,
              userRole: data.user.role
            });
            
            // Redirect seller to product management (will happen after this render)
            if (data.user.role === 'seller') {
              console.log('[AuctionList] Redirecting seller to /seller/products');
              setTimeout(() => navigate('/seller/products', { replace: true }), 0);
              return;
            }
          } else {
            console.warn('[AuctionList] API response structure unexpected:', data);
          }
        } else {
          console.warn('[AuctionList] PHP API returned non-ok status:', response.status);
        }
      } catch (err) {
        console.warn('[AuctionList] Failed to fetch current user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  // Debounce search input - MUST be before any returns
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch auctions based on filters (REST API) - MUST be before any returns
  // Only fetch if currentUser exists and is a buyer
  const shouldFetchAuctions = currentUser && currentUser.role === 'buyer';
  const { auctions: apiAuctions, loading: loadingAuctions, error, pagination } = useAuctions(
    shouldFetchAuctions ? activeTab : 'active',
    shouldFetchAuctions ? page : 1,
    shouldFetchAuctions ? search : ''
  );

  // Sync API data with local state
  useEffect(() => {
    setAuctions(apiAuctions);
  }, [apiAuctions]);

  // Setup socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Define all handlers
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

    // Real-time auction started (Scheduled -> Active transition)
    const handleAuctionStarted = (data) => {
      console.log('[AuctionList] Auction started:', data);
      
      // If viewing 'scheduled' tab: Remove the auction from list
      if (activeTab === 'scheduled') {
        setAuctions(prevAuctions =>
          prevAuctions.filter(auction => auction.auction_id !== data.auction_id)
        );
      }
      // If viewing 'active' tab: Add or update the auction
      else if (activeTab === 'active') {
        setAuctions(prevAuctions => {
          const exists = prevAuctions.some(a => a.auction_id === data.auction_id);
          if (exists) {
            // Update if already in list
            return prevAuctions.map(auction => {
              if (auction.auction_id === data.auction_id) {
                return {
                  ...auction,
                  status: 'active',
                  start_time: data.start_time,
                  end_time: data.end_time || null,
                };
              }
              return auction;
            });
          } else {
            // Add to list if not already there (prepend for latest)
            return [data, ...prevAuctions];
          }
        });
      }
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
              end_time: data.new_end_time || auction.end_time,
              bid_count: (auction.bid_count || 0) + 1,
            };
          }
          return auction;
        })
      );
    };

    // Real-time auction ended
    const handleAuctionEnded = (data) => {
      console.log('[AuctionList] Auction ended (socket):', data);
      
      // Remove from active list if viewing 'active' tab
      if (activeTab === 'active') {
        setAuctions(prevAuctions =>
          prevAuctions.filter(auction => auction.auction_id !== data.auction_id)
        );
      }
    };

    // Real-time auction created
    const handleAuctionCreated = (data) => {
      console.log('[AuctionList] New auction created (socket):', data);
      
      // If viewing 'scheduled' tab and auction is scheduled: Add to list
      if (activeTab === 'scheduled' && data.status === 'scheduled') {
        setAuctions(prevAuctions => [data, ...prevAuctions]);
      }
      // If viewing 'active' tab and auction is already active: Add to list
      else if (activeTab === 'active' && data.status === 'active') {
        setAuctions(prevAuctions => [data, ...prevAuctions]);
      }
    };

    // Real-time auction deleted/cancelled
    const handleAuctionDeleted = (data) => {
      console.log('[AuctionList] Auction deleted (socket):', data);
      
      // Remove from both active and scheduled lists
      setAuctions(prevAuctions =>
        prevAuctions.filter(auction => auction.auction_id !== data.auction_id)
      );
    };

    // Real-time auction cancelled (new event from server)
    const handleAuctionCancelled = (data) => {
      console.log('[AuctionList] Auction cancelled (socket):', data);
      
      // Remove from both active and scheduled lists
      setAuctions(prevAuctions =>
        prevAuctions.filter(auction => auction.auction_id !== data.auction_id)
      );
    };

    // Register socket listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('bid:placed', handleBidPlaced);
    socket.on('auction:status_changed', handleAuctionStatusChanged);
    socket.on('auction:started', handleAuctionStarted);
    socket.on('auction:ended', handleAuctionEnded);
    socket.on('auction:created', handleAuctionCreated);
    socket.on('auction:deleted', handleAuctionDeleted);
    socket.on('auction:cancelled', handleAuctionCancelled);
    socket.on('price:updated', handlePriceUpdate);

    // Cleanup listeners on unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('bid:placed', handleBidPlaced);
      socket.off('auction:status_changed', handleAuctionStatusChanged);
      socket.off('auction:started', handleAuctionStarted);
      socket.off('auction:ended', handleAuctionEnded);
      socket.off('auction:created', handleAuctionCreated);
      socket.off('auction:deleted', handleAuctionDeleted);
      socket.off('auction:cancelled', handleAuctionCancelled);
      socket.off('price:updated', handlePriceUpdate);
    };
  }, [socket, activeTab]);

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

  // CONDITIONAL CHECKS AFTER ALL HOOKS
  // If still loading authentication, show loading state
  if (loading) {
    return <div className="auction-list-page"><p>Memuat...</p></div>;
  }

  // If not authenticated or not a buyer, show denied
  if (!currentUser || currentUser.role !== 'buyer') {
    console.log('[AuctionList] Access denied. currentUser:', currentUser);
    return <div className="auction-list-page"><p>Akses ditolak. Silakan login sebagai buyer.</p></div>;
  }

  return (
    <div className="auction-list-container">
      <button className="back-list-btn" onClick={() => navigate(-1)}>← Kembali</button>
      
      <header className="list-header">
        <h1>Lelang Produk</h1>
        <p>Jelajahi berbagai produk yang sedang atau akan diluncurkan</p>
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
