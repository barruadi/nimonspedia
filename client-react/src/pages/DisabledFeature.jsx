import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDisabledReason } from '../services/featureFlagService';

export default function DisabledFeature() {
  const navigate = useNavigate();
  const location = useLocation();
  const [featureInfo, setFeatureInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get feature name from URL state or path
  const featureName = location.state?.featureName || getFeatureFromPath(location.pathname);

  useEffect(() => {
    async function loadFeatureInfo() {
      if (!featureName) {
        setLoading(false);
        return;
      }

      try {
        const reason = await getDisabledReason(featureName);
        setFeatureInfo({
          name: getFeatureDisplayName(featureName),
          ...reason
        });
      } catch (error) {
        console.error('[DisabledFeature] Error loading feature info:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFeatureInfo();
  }, [featureName]);

  function getFeatureFromPath(pathname) {
    if (pathname.includes('/auction')) return 'auction_enabled';
    if (pathname.includes('/chat')) return 'chat_enabled';
    if (pathname.includes('/cart') || pathname.includes('/checkout')) return 'checkout_enabled';
    return null;
  }

  function getFeatureDisplayName(name) {
    switch (name) {
      case 'auction_enabled':
        return 'Auction';
      case 'chat_enabled':
        return 'Chat';
      case 'checkout_enabled':
        return 'Checkout';
      default:
        return 'This feature';
    }
  }

  if (loading) {
    return (
      <div className="disabled-feature-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="disabled-feature-container">
      <div className="disabled-feature-content">
        <div className="illustration">
          <img 
            src="http://localhost/uploads/assets/not_found.png" 
            alt="Feature Disabled"
          />
        </div>

        <h1 className="title">Fitur Tidak Tersedia</h1>

        {featureInfo && (
          <div className="feature-info">
            <h2 className="feature-name">{featureInfo.name}</h2>

            <div className="reason-box">
              <div className="reason-label">Alasan</div>
              <div className="reason-text">
                {featureInfo.reason || (featureInfo.isGlobal 
                  ? 'Fitur ini sedang dalam pemeliharaan (maintenance) dan sementara tidak tersedia untuk semua pengguna.'
                  : 'Akses Anda ke fitur ini telah dibatasi.')}
              </div>
              <div className="reason-info">
                {featureInfo.isGlobal
                  ? 'Fitur ini dinonaktifkan secara global. Mohon tunggu hingga fitur kembali tersedia.'
                  : 'Akses fitur ini telah dibatasi khusus untuk akun Anda. Silakan hubungi administrator untuk informasi lebih lanjut.'}
              </div>
            </div>
          </div>
        )}

        {!featureInfo && (
          <p className="default-message">
            Halaman yang Anda coba akses saat ini tidak tersedia.
          </p>
        )}

        <div className="action-buttons">
          <a href="/products" className="btn">
            Kembali ke Beranda
          </a>
        </div>
      </div>

      <style jsx>{`
        .disabled-feature-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          padding: 2rem;
        }

        .disabled-feature-content {
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .illustration {
          width: 280px;
          height: 280px;
          margin: 0 auto 2rem;
        }

        .illustration img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .title {
          font-size: 2rem;
          font-weight: 700;
          color: #000000;
          margin-bottom: 1rem;
        }

        .feature-info {
          margin-bottom: 2rem;
        }

        .feature-name {
          font-size: 1.25rem;
          font-weight: 600;
          color: #333333;
          margin-bottom: 1.5rem;
        }

        .reason-box {
          background-color: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
          text-align: left;
        }

        .reason-label {
          font-weight: 600;
          color: #000000;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .reason-text {
          color: #000000;
          line-height: 1.6;
          font-size: 1rem;
          margin-bottom: 0.75rem;
        }

        .reason-info {
          color: #666666;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .default-message {
          color: #000000;
          font-size: 1rem;
          line-height: 1.75;
          margin-bottom: 2rem;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.75rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: #05AA5B;
          color: #ffffff;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .btn:hover {
          background: #049a52;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .btn svg {
          width: 20px;
          height: 20px;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e0e0e0;
          border-top-color: #000000;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .disabled-feature-content {
            padding: 1rem;
          }

          .title {
            font-size: 1.5rem;
          }

          .feature-name {
            font-size: 1.125rem;
          }

          .illustration {
            width: 200px;
            height: 200px;
          }

          .action-buttons {
            flex-direction: column;
          }

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
