import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

const API_BASE = 'http://localhost/api/node/admin';

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUserForFlags, setSelectedUserForFlags] = useState(null);
  const [currentUserFlags, setCurrentUserFlags] = useState({});
  const [flagReasons, setFlagReasons] = useState({});
  const [globalFlags, setGlobalFlags] = useState({
    checkout_enabled: true,
    chat_enabled: true,
    auction_enabled: true
  });
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalFlagToToggle, setGlobalFlagToToggle] = useState(null);
  const [globalReason, setGlobalReason] = useState('');
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const validateAuth = async () => {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        navigate('/admin/login');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error('Invalid token');
        }

        setAdmin(data.user);
      } catch (error) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    validateAuth();
  }, [navigate]);

  useEffect(() => {
    if (admin) {
      fetchUsers();
      fetchGlobalFlags();
    }
  }, [admin, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!admin) return;
    
    const debounce = setTimeout(() => {
      setCurrentPage(1);
      fetchUsers();
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const fetchUsers = async () => {
    if (!admin) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        per_page: itemsPerPage,
        ...(searchQuery && { search: searchQuery })
      });

      const response = await fetch(`${API_BASE}/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login');
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      if (data.ok) {
        setUsers(data.users || []);
        setTotalUsers(data.pagination?.totalItems || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      showToast('Gagal memuat data pengguna', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalFlags = async () => {
    try {
      const response = await fetch(`${API_BASE}/global-flags`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login');
          return;
        }
        throw new Error('Failed to fetch global flags');
      }

      const data = await response.json();

      if (data.ok) {
        setGlobalFlags(data.flags || {
          checkout_enabled: true,
          chat_enabled: true,
          auction_enabled: true
        });
      }
    } catch (error) {
      showToast('Gagal memuat global flags', 'error');
    }
  };

  const handleManageFlags = async (user) => {
    try {
      const response = await fetch(`${API_BASE}/users/${user.id}/flags`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login');
          return;
        }
        throw new Error('Failed to fetch user flags');
      }

      const data = await response.json();

      if (data.ok) {
        setSelectedUserForFlags(user);
        setCurrentUserFlags(data.flags || {
          checkout_enabled: true,
          chat_enabled: true,
          auction_enabled: true
        });
        setFlagReasons({});
      }
    } catch (error) {
      showToast('Gagal memuat data flags', 'error');
    }
  };

  const handleUserFlagChange = (flagName, value) => {
    setCurrentUserFlags(prev => ({
      ...prev,
      [flagName]: value
    }));

    if (!value) {
      setFlagReasons(prev => ({
        ...prev,
        [flagName]: ''
      }));
    } else {
      setFlagReasons(prev => {
        const newReasons = { ...prev };
        delete newReasons[flagName];
        return newReasons;
      });
    }
  };

  const handleSaveUserFlags = async () => {
    if (!selectedUserForFlags) return;

    const flagsToUpdate = {};
    const disabledFlags = Object.entries(currentUserFlags).filter(([_, value]) => !value);
    
    for (const [flagName] of disabledFlags) {
      const reason = flagReasons[flagName];
      if (!reason || reason.length < 10) {
        showToast('Alasan harus diisi minimal 10 karakter untuk setiap flag yang dimatikan', 'error');
        return;
      }
      flagsToUpdate[flagName] = {
        isEnabled: false,
        reason
      };
    }

    Object.entries(currentUserFlags).filter(([_, value]) => value).forEach(([key]) => {
      flagsToUpdate[key] = {
        isEnabled: true,
        reason: ''
      };
    });

    try {
      const response = await fetch(`${API_BASE}/users/${selectedUserForFlags.id}/flags`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ flags: flagsToUpdate })
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login');
          return;
        }
        throw new Error('Failed to update user flags');
      }

      const data = await response.json();

      if (data.ok) {
        showToast('Feature flags berhasil diperbarui', 'success');
        setSelectedUserForFlags(null);
        setFlagReasons({});
        fetchUsers();
      }
    } catch (error) {
      showToast('Gagal memperbarui feature flags', 'error');
    }
  };

  const handleGlobalFlagToggle = (flagName) => {
    const currentValue = globalFlags[flagName];
    if (currentValue) {
      setGlobalFlagToToggle(flagName);
      setGlobalReason('');
      setShowGlobalModal(true);
    } else {
      confirmGlobalFlagToggle(flagName, true);
    }
  };

  const confirmGlobalFlagToggle = async (flagName = null, enableFlag = false) => {
    const targetFlag = flagName || globalFlagToToggle;
    
    if (!enableFlag && (!globalReason || globalReason.length < 20)) {
      showToast('Alasan harus diisi minimal 20 karakter', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/global-flags`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          flag: targetFlag,
          isEnabled: enableFlag,
          reason: enableFlag ? '' : globalReason
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          navigate('/admin/login');
          return;
        }
        throw new Error('Failed to update global flag');
      }

      const data = await response.json();

      if (data.ok) {
        setGlobalFlags(prev => ({
          ...prev,
          [targetFlag]: enableFlag
        }));
        showToast(`Global flag berhasil ${enableFlag ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
        setShowGlobalModal(false);
        setGlobalFlagToToggle(null);
        setGlobalReason('');
      }
    } catch (error) {
      showToast('Gagal mengubah global flag', 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (loading && !admin) {
    return (
      <div className="admin-dashboard loading">
        <div className="loader">
          <div className="spinner"></div>
          <p>Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="navbar-brand">
            <img
              src="/uploads/logo/nimonspedia.png"
              alt="Nimonspedia"
              className="navbar-logo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span className="navbar-brand-text" style={{ display: 'none' }}>Nimonspedia</span>
          </div>

          <div className="admin-info">
            <span className="admin-greeting">Hi,</span>
            <span className="admin-name">{admin?.name || admin?.email || 'Super Admin'}</span>
            <button onClick={handleLogout} className="btn-logout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <section className="search-section">
          <div className="search-bar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Cari dengan Nama / Email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        <div className="table-container">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Memuat data...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>Tidak ada data pengguna</p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nama</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Balance</th>
                      <th>Tanggal Daftar</th>
                      <th>Kelola Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`badge ${user.role?.toLowerCase()}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>Rp {(user.balance || 0).toLocaleString('id-ID')}</td>
                        <td>{new Date(user.createdAt || user.created_at).toLocaleDateString('id-ID')}</td>
                        <td>
                          <button
                            className="btn-manage"
                            onClick={() => handleManageFlags(user)}
                          >
                            Kelola Flags
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} sampai {Math.min(currentPage * itemsPerPage, totalUsers)} dari {totalUsers} Pengguna
                </div>
                
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="11 17 6 12 11 7"></polyline>
                      <polyline points="18 17 13 12 18 7"></polyline>
                    </svg>
                  </button>
                  
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>

                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                    ) : (
                      <button
                        key={page}
                        className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    )
                  ))}

                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                  
                  <button 
                    className="pagination-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="13 17 18 12 13 7"></polyline>
                      <polyline points="6 17 11 12 6 7"></polyline>
                    </svg>
                  </button>

                  <select 
                    className="items-per-page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={16}>16</option>
                    <option value={20}>20</option>
                    <option value={24}>24</option>
                    <option value={28}>28</option>
                    <option value={32}>32</option>
                    <option value={48}>48</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <section className="global-flags-section">
          <h2>Global Feature Flags</h2>
          <p className="global-flags-description">Mengatur ketersediaan fitur untuk seluruh pengguna</p>
          
          <div className="warning-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span>Perubahan pada Global Flags akan mempengaruhi semua pengguna. Harap berhati-hati.</span>
          </div>

          <div className="global-flags-grid">
            <div className="global-flag-card">
              <div className="global-flag-header">
                <div className="global-flag-title">
                  <h3>Checkout</h3>
                  <span className={`status-indicator ${globalFlags.checkout_enabled ? 'enabled' : 'disabled'}`}>
                    {globalFlags.checkout_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={globalFlags.checkout_enabled}
                    onChange={() => handleGlobalFlagToggle('checkout_enabled')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p className="global-flag-description">Mengaktifkan fitur checkout untuk semua pengguna</p>
            </div>

            <div className="global-flag-card">
              <div className="global-flag-header">
                <div className="global-flag-title">
                  <h3>Chat</h3>
                  <span className={`status-indicator ${globalFlags.chat_enabled ? 'enabled' : 'disabled'}`}>
                    {globalFlags.chat_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={globalFlags.chat_enabled}
                    onChange={() => handleGlobalFlagToggle('chat_enabled')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p className="global-flag-description">Mengaktifkan fitur chat untuk semua pengguna</p>
            </div>

            <div className="global-flag-card">
              <div className="global-flag-header">
                <div className="global-flag-title">
                  <h3>Auction</h3>
                  <span className={`status-indicator ${globalFlags.auction_enabled ? 'enabled' : 'disabled'}`}>
                    {globalFlags.auction_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={globalFlags.auction_enabled}
                    onChange={() => handleGlobalFlagToggle('auction_enabled')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p className="global-flag-description">Mengaktifkan fitur lelang untuk semua pengguna</p>
            </div>
          </div>
        </section>
      </div>

      {selectedUserForFlags && (
        <div className="modal-overlay" onClick={() => setSelectedUserForFlags(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Kelola Feature Flags</h3>
              <button className="modal-close" onClick={() => setSelectedUserForFlags(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="user-info-card">
                <div className="user-info-row">
                  <span className="label">Nama:</span>
                  <span className="value">{selectedUserForFlags.name}</span>
                </div>
                <div className="user-info-row">
                  <span className="label">Email:</span>
                  <span className="value">{selectedUserForFlags.email}</span>
                </div>
              </div>

              <div className="flags-grid">
                {Object.entries(currentUserFlags).map(([flagName, enabled]) => {
                  const displayName = flagName.replace('_enabled', '').replace('_', ' ');
                  return (
                    <div key={flagName} className="flag-item">
                      <label className={`flag-label ${!enabled ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => handleUserFlagChange(flagName, e.target.checked)}
                        />
                        <span className="flag-name">{displayName.charAt(0).toUpperCase() + displayName.slice(1)}</span>
                        {!enabled && (
                          <span className="status-badge disabled">Nonaktif</span>
                        )}
                      </label>
                      {!enabled && (
                        <textarea
                          placeholder="Masukkan alasan (minimal 10 karakter)"
                          value={flagReasons[flagName] || ''}
                          onChange={(e) => setFlagReasons(prev => ({
                            ...prev,
                            [flagName]: e.target.value
                          }))}
                          className="reason-textarea"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedUserForFlags(null);
                  setFlagReasons({});
                }}
              >
                Batal
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveUserFlags}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showGlobalModal && (
        <div className="modal-overlay" onClick={() => setShowGlobalModal(false)}>
          <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Konfirmasi Nonaktifkan Global Flag</h3>
              <button className="modal-close" onClick={() => setShowGlobalModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <p>Anda akan menonaktifkan fitur <strong>{globalFlagToToggle?.replace('_enabled', '').replace('_', ' ')}</strong> untuk semua pengguna. Harap berikan alasan.</p>
              
              <textarea
                placeholder="Masukkan alasan (minimal 20 karakter)"
                value={globalReason}
                onChange={(e) => setGlobalReason(e.target.value)}
                className="modal-textarea"
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowGlobalModal(false);
                  setGlobalFlagToToggle(null);
                  setGlobalReason('');
                }}
              >
                Batal
              </button>
              <button
                className="btn-danger"
                onClick={() => confirmGlobalFlagToggle()}
              >
                Nonaktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            {toast.type === 'success' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
