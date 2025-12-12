import { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { showToast } from '../utils/toast';

export default function NotificationSettings() {
  const {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    loading,
    error,
    subscribe,
    unsubscribe,
    updatePreferences
  } = usePushNotifications();

  const [localPreferences, setLocalPreferences] = useState({
    chat: true,
    auction: true,
    order: true
  });

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handleTogglePushNotifications = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        showToast('Push notifications disabled', 'You will no longer receive push notifications', 'success');
      } else {
        showToast('Error', error || 'Failed to disable push notifications', 'error');
      }
    } else {
      const success = await subscribe(localPreferences);
      if (success) {
        showToast('Push notifications enabled', 'You will now receive push notifications', 'success');
      } else {
        showToast('Error', error || 'Failed to enable push notifications', 'error');
      }
    }
  };

  const handlePreferenceChange = async (category) => {
    const newPreferences = {
      ...localPreferences,
      [category]: !localPreferences[category]
    };

    setLocalPreferences(newPreferences);

    if (isSubscribed) {
      const success = await updatePreferences(newPreferences);
      if (success) {
        showToast('Preferences updated', `${category} notifications ${newPreferences[category] ? 'enabled' : 'disabled'}`, 'success');
      } else {
        showToast('Error', error || 'Failed to update preferences', 'error');
        // Revert on error
        setLocalPreferences(localPreferences);
      }
    }
  };

  if (!isSupported) {
    return (
      <div className="notification-settings">
        <div className="alert alert-warning">
          <h3>Push Notifications Not Supported</h3>
          <p>Your browser does not support push notifications. Please use a modern browser like Chrome, Firefox, or Edge.</p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="notification-settings">
        <div className="alert alert-error">
          <h3>Notifications Blocked</h3>
          <p>You have blocked notifications for this site. Please enable them in your browser settings to receive push notifications.</p>
          <p className="text-sm mt-2">
            To enable notifications:
            <br />
            1. Click the lock icon in your browser's address bar
            <br />
            2. Find "Notifications" and set it to "Allow"
            <br />
            3. Refresh this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-settings">
      <div className="settings-header">
        <h2>Push Notification Settings</h2>
        <p className="text-gray-600">Manage how you receive notifications from Nimonspedia</p>
      </div>

      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-info">
            <h3>Enable Push Notifications</h3>
            <p>Receive notifications even when the app is closed</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isSubscribed}
              onChange={handleTogglePushNotifications}
              disabled={loading}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {isSubscribed && (
          <>
            <div className="divider"></div>

            <h3 className="section-title">Notification Categories</h3>
            <p className="section-description">Choose which types of notifications you want to receive</p>

            <div className="setting-item">
              <div className="setting-info">
                <h4>Chat Notifications</h4>
                <p>Get notified when you receive new messages</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={localPreferences.chat}
                  onChange={() => handlePreferenceChange('chat')}
                  disabled={loading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h4>Auction Notifications</h4>
                <p>Get notified about auction updates (outbid, won, ending soon)</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={localPreferences.auction}
                  onChange={() => handlePreferenceChange('auction')}
                  disabled={loading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <h4>Order Notifications</h4>
                <p>Get notified about order status changes</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={localPreferences.order}
                  onChange={() => handlePreferenceChange('order')}
                  disabled={loading}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="alert alert-error mt-4">
          <p>{error}</p>
        </div>
      )}

      <style jsx>{`
        .notification-settings {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .settings-header {
          margin-bottom: 2rem;
        }

        .settings-header h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .settings-section {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 0;
        }

        .setting-info {
          flex: 1;
        }

        .setting-info h3,
        .setting-info h4 {
          font-size: 1rem;
          font-weight: 500;
          margin-bottom: 0.25rem;
        }

        .setting-info p {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .section-title {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .section-description {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 1rem;
        }

        .divider {
          height: 1px;
          background: #e5e7eb;
          margin: 1.5rem 0;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e0;
          transition: 0.3s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #3b82f6;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .alert {
          padding: 1rem;
          border-radius: 0.5rem;
          margin-top: 1rem;
        }

        .alert-warning {
          background: #fef3c7;
          border: 1px solid #fbbf24;
          color: #92400e;
        }

        .alert-error {
          background: #fee2e2;
          border: 1px solid #ef4444;
          color: #991b1b;
        }

        .alert h3 {
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .text-sm {
          font-size: 0.875rem;
        }

        .mt-2 {
          margin-top: 0.5rem;
        }

        .mt-4 {
          margin-top: 1rem;
        }

        .text-gray-600 {
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
