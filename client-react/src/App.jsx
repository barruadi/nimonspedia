import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './App.css'

// Placeholder components for Auction and Chat
function AuctionPage() {
  return (
    <div>
      <h1>Auction Page</h1>
      <Link to="/chat">Go to Chat</Link>
    </div>
  )
}

function ChatPage() {
  return (
    <div>
      <h1>Chat Page</h1>
      <Link to="/auction">Go to Auction</Link>
    </div>
  )
}

function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <Link to="/auction">Go to Auction</Link> | <Link to="/chat">Go to Chat</Link>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auction" element={<AuctionPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
