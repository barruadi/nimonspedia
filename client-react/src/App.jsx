import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import ChatPage from './components/chat/ChatPage'
import AuctionPage from './components/auction/AuctionPage'
import AuctionList from './pages/AuctionList'
import AuctionDetail from './pages/AuctionDetail'

function HomePage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Welcome to Nimons</h1>
      <p>Choose a feature:</p>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px' }}>
        <Link to="/auction" style={{
          padding: '15px 30px',
          backgroundColor: '#007bff',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '18px'
        }}>
          Go to Auction
        </Link>
        <Link to="/chat" style={{
          padding: '15px 30px',
          backgroundColor: '#28a745',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px',
          fontSize: '18px'
        }}>
          Go to Chat
        </Link>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist in the React app.</p>
      <Link to="/auction">Go to Auction</Link> | <Link to="/chat">Go to Chat</Link>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/auctions" element={<AuctionList />} />
        <Route path="/auction/:id" element={<AuctionDetail />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
