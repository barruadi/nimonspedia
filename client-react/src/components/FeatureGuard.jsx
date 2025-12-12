import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isFeatureEnabled } from '../services/featureFlagService';

/**
 * FeatureGuard Component
 * Protects routes by checking if feature is enabled
 * Redirects to DisabledFeature page if feature is disabled
 *
 * Usage:
 * <FeatureGuard feature="chat_enabled">
 *   <ChatPage />
 * </FeatureGuard>
 */
export default function FeatureGuard({ feature, children }) {
  const [enabled, setEnabled] = useState(null); // null = loading, true/false = result
  const location = useLocation();

  useEffect(() => {
    async function checkFeature() {
      const isEnabled = await isFeatureEnabled(feature);
      setEnabled(isEnabled);
    }

    checkFeature();
  }, [feature]);

  // Show nothing while loading (or you can show a spinner)
  if (enabled === null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If feature is disabled, redirect to DisabledFeature page
  if (!enabled) {
    return (
      <Navigate
        to="/feature-disabled"
        state={{ featureName: feature, from: location.pathname }}
        replace
      />
    );
  }

  // Feature is enabled, render children
  return <>{children}</>;
}
