import { useState, useEffect } from 'react';
import { showToast } from '../utils/toast';

export default function AdminFeatureFlags() {
  const [globalFlags, setGlobalFlags] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFlags, setUserFlags] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Load global flags on mount
  useEffect(() => {
    loadGlobalFlags();
  }, []);

  async function loadGlobalFlags() {
    try {
      setLoading(true);
      const response = await fetch('/api/node/admin/feature-flags/global?user_id=1', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load global flags');
      }

      const data = await response.json();
      setGlobalFlags(data.flags);
    } catch (error) {
      console.error('[AdminFeatureFlags] Error loading global flags:', error);
      showToast('Error', 'Failed to load global feature flags', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleGlobalFlag(featureName, currentlyEnabled) {
    const newEnabled = !currentlyEnabled;

    // If disabling, ask for reason
    let reasonText = null;
    if (!newEnabled) {
      reasonText = prompt('Enter reason for disabling (required):');

      // If user clicked Cancel, don't proceed
      if (reasonText === null) {
        return;
      }

      // If empty, ask again
      if (reasonText.trim() === '') {
        showToast('Error', 'Please provide a reason for disabling this feature', 'error');
        return;
      }
    }

    try {
      const response = await fetch('/api/node/admin/feature-flags/global?user_id=1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          feature_name: featureName,
          is_enabled: newEnabled,
          reason: reasonText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update global flag');
      }

      showToast('Success', `Global ${getFeatureName(featureName)} ${newEnabled ? 'enabled' : 'disabled'}`, 'success');
      loadGlobalFlags();
    } catch (error) {
      console.error('[AdminFeatureFlags] Error updating global flag:', error);
      showToast('Error', 'Failed to update feature flag', 'error');
    }
  }

  async function handleSearch() {
    if (!searchQuery || searchQuery.length < 2) {
      showToast('Error', 'Search query must be at least 2 characters', 'error');
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(`/api/node/admin/feature-flags/users/search?q=${encodeURIComponent(searchQuery)}&user_id=1`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to search users');
      }

      const data = await response.json();
      setSearchResults(data.users || []);

      if (data.users.length === 0) {
        showToast('No Results', 'No users found matching your query', 'info');
      }
    } catch (error) {
      console.error('[AdminFeatureFlags] Error searching users:', error);
      showToast('Error', 'Failed to search users', 'error');
    } finally {
      setSearching(false);
    }
  }

  async function loadUserFlags(user) {
    try {
      setSelectedUser(user);
      setUserFlags(null);

      const response = await fetch(`/api/node/admin/feature-flags/user/${user.user_id}?user_id=1`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load user flags');
      }

      const data = await response.json();
      setUserFlags(data.flags);
    } catch (error) {
      console.error('[AdminFeatureFlags] Error loading user flags:', error);
      showToast('Error', 'Failed to load user feature flags', 'error');
    }
  }

  async function handleToggleUserFlag(featureName, currentlyEnabled) {
    if (!selectedUser) return;

    const newEnabled = !currentlyEnabled;

    // If disabling, ask for reason
    let reasonText = null;
    if (!newEnabled) {
      reasonText = prompt('Enter reason for disabling (required):');

      // If user clicked Cancel, don't proceed
      if (reasonText === null) {
        return;
      }

      // If empty, ask again
      if (reasonText.trim() === '') {
        showToast('Error', 'Please provide a reason for disabling this feature', 'error');
        return;
      }
    }

    try {
      const response = await fetch(`/api/node/admin/feature-flags/user/${selectedUser.user_id}?user_id=1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          feature_name: featureName,
          is_enabled: newEnabled,
          reason: reasonText
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update user flag');
      }

      showToast('Success', `${getFeatureName(featureName)} ${newEnabled ? 'enabled' : 'disabled'} for user`, 'success');
      loadUserFlags(selectedUser);
    } catch (error) {
      console.error('[AdminFeatureFlags] Error updating user flag:', error);
      showToast('Error', 'Failed to update feature flag', 'error');
    }
  }

  async function handleResetUserFlag(featureName) {
    if (!selectedUser) return;
    if (!confirm(`Reset ${getFeatureName(featureName)} to global setting for this user?`)) return;

    try {
      const response = await fetch(`/api/node/admin/feature-flags/user/${selectedUser.user_id}/${featureName}?user_id=1`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to reset user flag');
      }

      showToast('Success', `${getFeatureName(featureName)} reset to global setting`, 'success');
      loadUserFlags(selectedUser);
    } catch (error) {
      console.error('[AdminFeatureFlags] Error resetting user flag:', error);
      showToast('Error', 'Failed to reset feature flag', 'error');
    }
  }

  function getFeatureName(key) {
    const names = {
      auction_enabled: 'Auction',
      chat_enabled: 'Chat',
      checkout_enabled: 'Checkout'
    };
    return names[key] || key;
  }

  if (loading) {
    return (
      <div className="admin-feature-flags">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading feature flags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-feature-flags">
      <div className="page-header">
        <h1>Feature Flags Management</h1>
        <p>Control feature availability globally or per-user</p>
      </div>

      {/* Global Feature Flags */}
      <div className="section">
        <h2>Global Feature Flags (Maintenance Mode)</h2>
        <p className="section-description">
          Toggle features for all users. When disabled, no users can access these features.
        </p>

        <div className="flags-grid">
          {globalFlags && Object.entries(globalFlags).map(([key, flag]) => (
            <div key={key} className="flag-card">
              <div className="flag-header">
                <h3>{getFeatureName(key)}</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={() => handleToggleGlobalFlag(key, flag.enabled)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="flag-status">
                <span className={`status-badge ${flag.enabled ? 'enabled' : 'disabled'}`}>
                  {flag.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {!flag.enabled && flag.reason && (
                  <p className="reason">{flag.reason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User-Specific Flags */}
      <div className="section">
        <h2>User-Specific Feature Flags</h2>
        <p className="section-description">
          Control features for individual users. User-specific settings override global settings.
        </p>

        {/* Search */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search users by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="search-btn"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Search Results ({searchResults.length})</h3>
            <div className="users-list">
              {searchResults.map(user => (
                <div
                  key={user.user_id}
                  className={`user-item ${selectedUser?.user_id === user.user_id ? 'selected' : ''}`}
                  onClick={() => loadUserFlags(user)}
                >
                  <div className="user-info">
                    <div className="user-name">{user.full_name}</div>
                    <div className="user-email">{user.email}</div>
                  </div>
                  <span className={`role-badge ${user.role}`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected User Flags */}
        {selectedUser && userFlags && (
          <div className="user-flags-container">
            <div className="user-header">
              <div>
                <h3>{selectedUser.full_name}</h3>
                <p className="user-email">{selectedUser.email}</p>
                <span className={`role-badge ${selectedUser.role}`}>
                  {selectedUser.role}
                </span>
              </div>
              {selectedUser?.role?.toLowerCase() === 'seller' && (
                <div className="role-note">
                  <svg className="info-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Sellers only have Chat and Auction features</span>
                </div>
              )}
            </div>

            <div className="flags-grid">
              {Object.entries(userFlags)
                .filter(([key]) => {
                  if (key === 'checkout_enabled' && selectedUser?.role?.toLowerCase() === 'seller') {
                    return false;
                  }
                  return true;
                })
                .map(([key, flag]) => (
                  <div key={key} className="flag-card">
                    <div className="flag-header">
                      <h3>{getFeatureName(key)}</h3>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={flag.enabled !== false}
                          onChange={() => handleToggleUserFlag(key, flag.enabled !== false)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <div className="flag-status">
                      {flag.enabled === null ? (
                        <span className="status-badge global">Using Global Setting</span>
                      ) : (
                        <>
                          <span className={`status-badge ${flag.enabled ? 'enabled' : 'disabled'}`}>
                            {flag.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          {!flag.enabled && flag.reason && (
                            <p className="reason">{flag.reason}</p>
                          )}
                        </>
                      )}
                    </div>
                    {flag.enabled !== null && (
                      <button
                        className="reset-btn"
                        onClick={() => handleResetUserFlag(key)}
                      >
                        Reset to Global
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .admin-feature-flags {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .page-header {
          margin-bottom: 3rem;
        }

        .page-header h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 0.5rem;
        }

        .page-header p {
          color: #718096;
          font-size: 1.125rem;
        }

        .section {
          background: white;
          border-radius: 0.75rem;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .section h2 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }

        .section-description {
          color: #718096;
          margin-bottom: 2rem;
        }

        .flags-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .flag-card {
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 1.5rem;
          background: #f7fafc;
        }

        .flag-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .flag-header h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #2d3748;
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
          background-color: #48bb78;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .flag-status {
          margin-bottom: 1rem;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .status-badge.enabled {
          background: #c6f6d5;
          color: #22543d;
        }

        .status-badge.disabled {
          background: #fed7d7;
          color: #742a2a;
        }

        .status-badge.global {
          background: #bee3f8;
          color: #2c5282;
        }

        .reason {
          margin-top: 0.5rem;
          color: #718096;
          font-size: 0.875rem;
          font-style: italic;
        }

        .reset-btn {
          width: 100%;
          padding: 0.5rem;
          background: #e2e8f0;
          border: none;
          border-radius: 0.25rem;
          color: #2d3748;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .reset-btn:hover {
          background: #cbd5e0;
        }

        .search-container {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .search-input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 1rem;
        }

        .search-btn {
          padding: 0.75rem 2rem;
          background: #4299e1;
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .search-btn:hover:not(:disabled) {
          background: #3182ce;
        }

        .search-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .search-results {
          margin-bottom: 2rem;
        }

        .search-results h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #2d3748;
        }

        .users-list {
          display: grid;
          gap: 0.5rem;
        }

        .user-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .user-item:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
        }

        .user-item.selected {
          background: #ebf8ff;
          border-color: #4299e1;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.25rem;
        }

        .user-email {
          font-size: 0.875rem;
          color: #718096;
        }

        .role-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-badge.buyer {
          background: #bee3f8;
          color: #2c5282;
        }

        .role-badge.seller {
          background: #fbb6ce;
          color: #702459;
        }

        .user-flags-container {
          background: #f7fafc;
          border-radius: 0.5rem;
          padding: 1.5rem;
          margin-top: 1.5rem;
        }

        .user-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .user-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.25rem;
        }

        .role-note {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #bee3f8;
          border-radius: 0.5rem;
          color: #2c5282;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .info-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #718096;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e2e8f0;
          border-top-color: #4299e1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .admin-feature-flags {
            padding: 1rem;
          }

          .flags-grid {
            grid-template-columns: 1fr;
          }

          .search-container {
            flex-direction: column;
          }

          .search-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
