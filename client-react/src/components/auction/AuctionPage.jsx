import { useState, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';

const AuctionPage = () => {
  const { connected, emit, on, off } = useSocket();
  const [user, setUser] = useState(null);
  const [auctionData, setAuctionData] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  const auctionId = 'test-auction-1'; // Mockup auction ID

  // Fetch user session
  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(err => console.error('Failed to fetch user:', err));
  }, []);

  // Join auction room when connected
  useEffect(() => {
    if (connected) {
      console.log('[Auction] Joining auction room:', auctionId);
      emit('auction:join', auctionId);

      // Listen for auction data
      on('auction:joined', (data) => {
        console.log('[Auction] Joined:', data);
        setAuctionData(data.mockData);
        setTimeLeft(data.mockData.timeLeft);
        setBids(data.mockData.bids);
      });

      // Listen for new bids
      on('auction:new-bid', (bid) => {
        console.log('[Auction] New bid:', bid);
        setBids(prev => [...prev, bid]);
        if (auctionData) {
          setAuctionData(prev => ({
            ...prev,
            currentPrice: bid.amount
          }));
        }
      });

      // Listen for bid success
      on('auction:bid-success', (data) => {
        console.log('[Auction] Bid placed successfully:', data);
        alert(`Bid placed successfully: $${data.amount}`);
      });

      return () => {
        emit('auction:leave', auctionId);
        off('auction:joined');
        off('auction:new-bid');
        off('auction:bid-success');
      };
    }
  }, [connected, auctionId]);

  const handlePlaceBid = () => {
    if (!bidAmount || isNaN(bidAmount)) {
      alert('Please enter a valid bid amount');
      return;
    }

    const amount = parseFloat(bidAmount);

    if (!auctionData || amount <= auctionData.currentPrice) {
      alert(`Bid must be higher than current price: $${auctionData?.currentPrice}`);
      return;
    }

    emit('auction:bid', {
      auctionId,
      userId: user?.id || 'guest',
      userName: user?.name || 'Guest',
      amount
    });

    setBidAmount('');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Auction Page (WebSocket Mockup)</h1>

      {/* Connection Status */}
      <div style={{
        padding: '10px',
        marginBottom: '20px',
        backgroundColor: connected ? '#d4edda' : '#f8d7da',
        border: `1px solid ${connected ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px'
      }}>
        Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* User Info */}
      {user && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
          <strong>User:</strong> {user.name} ({user.role})
        </div>
      )}

      {/* Auction Details */}
      {auctionData && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h2>{auctionData.product}</h2>
          <p><strong>Current Price:</strong> ${auctionData.currentPrice}</p>
          <p><strong>Time Left:</strong> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
        </div>
      )}

      {/* Bidding */}
      {user?.role === 'buyer' && (
        <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h3>Place a Bid</h3>
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder="Enter bid amount"
            style={{ padding: '8px', marginRight: '10px', width: '200px' }}
          />
          <button
            onClick={handlePlaceBid}
            disabled={!connected}
            style={{
              padding: '8px 16px',
              backgroundColor: connected ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: connected ? 'pointer' : 'not-allowed'
            }}
          >
            Place Bid
          </button>
        </div>
      )}

      {/* Bid History */}
      <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h3>Bid History</h3>
        {bids.length === 0 ? (
          <p>No bids yet</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {bids.map((bid, index) => (
              <li key={index} style={{
                padding: '10px',
                marginBottom: '5px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px'
              }}>
                <strong>{bid.userName}</strong> bid ${bid.amount} at {new Date(bid.timestamp).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AuctionPage;
