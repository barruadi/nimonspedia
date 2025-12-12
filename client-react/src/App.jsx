import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import './components/ToastNotification'
import ChatPage from './components/chat/ChatPage'
import AuctionPage from './components/auction/AuctionPage'
import AuctionList from './pages/AuctionList'
import AuctionDetail from './pages/AuctionDetail'
import SellerAuctionHistory from './pages/SellerAuctionHistory'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import DisabledFeature from './pages/DisabledFeature'
import FeatureGuard from './components/FeatureGuard'
import './components/Button.css'

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
          backgroundColor: '#05AA5B',
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
    <>
      <app-toast></app-toast>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          
          {/* Auction Routes - Protected */}
          <Route path="/auction" element={
            <FeatureGuard feature="auction_enabled">
              <AuctionPage />
            </FeatureGuard>
          } />
          <Route path="/auctions" element={
            <FeatureGuard feature="auction_enabled">
              <AuctionList />
            </FeatureGuard>
          } />
          <Route path="/auction/:id" element={
            <FeatureGuard feature="auction_enabled">
              <AuctionDetail />
            </FeatureGuard>
          } />
          <Route path="/auction-history" element={
            <FeatureGuard feature="auction_enabled">
              <SellerAuctionHistory />
            </FeatureGuard>
          } />
          
          {/* Chat Routes - Protected */}
          <Route path="/chat/*" element={
            <FeatureGuard feature="chat_enabled">
              <ChatPage />
            </FeatureGuard>
          } />
          
          {/* Admin Routes - No protection needed */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          
          {/* Disabled Feature Page */}
          <Route path="/feature-disabled" element={<DisabledFeature />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
