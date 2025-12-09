import './SocketIndicator.css';

const SocketIndicator = ({ connected }) => {
  return (
    <div className={`socket-indicator ${connected ? 'connected' : 'disconnected'}`} title={connected ? 'WebSocket terhubung' : 'WebSocket terputus'}>
      <div className="socket-dot"></div>
      <span className="socket-text">{connected ? 'Live' : 'Offline'}</span>
    </div>
  );
};

export default SocketIndicator;
