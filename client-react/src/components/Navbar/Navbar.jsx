import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = ({ role = 'buyer', onLogout = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Fetch session on mount
  useEffect(() => {
    fetchSession();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('http://localhost/api/me', {
        credentials: 'include'
      });

      if (!res.ok) {
        setSession({ authenticated: false, user: null, flags: null });
        return;
      }

      const data = await res.json();

      if (!data.authenticated || !data.user) {
        setSession({ authenticated: false, user: null, flags: null });
        return;
      }

      // Fetch feature flags
      let flags = {
        auction_enabled: { enabled: true },
        chat_enabled: { enabled: true },
        checkout_enabled: { enabled: true }
      };

      try {
        const flagsRes = await fetch('http://localhost/api/feature-flags', {
          credentials: 'include'
        });
        if (flagsRes.ok) {
          const flagsData = await flagsRes.json();
          if (flagsData && flagsData.flags) {
            flags = flagsData.flags;
          }
        }
      } catch (err) {
        console.warn('[Navbar] Failed to fetch feature flags:', err);
      }

      setSession({
        authenticated: true,
        user: data.user,
        flags
      });
    } catch (err) {
      console.error('[Navbar] Failed to fetch session:', err);
      setSession({ authenticated: false, user: null, flags: null });
    }
  };

  const handleNavClick = (href) => {
    setShowMobileMenu(false);
    navigate(href);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('http://localhost/api/logout', {
        method: 'POST',
        credentials: 'include'
      });

      // Clear cookies
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });

      localStorage.removeItem('adminToken');
      sessionStorage.clear();

      setShowLogoutModal(false);
      setSession({ authenticated: false, user: null, flags: null });

      if (onLogout) {
        onLogout();
      }

      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
      alert('Gagal logout. Coba lagi.');
      setIsLoggingOut(false);
    }
  };

  const handleBalanceClick = () => {
    setShowMobileMenu(false);
    window.dispatchEvent(new CustomEvent('open-top-up-modal'));
  };

  if (!session) {
    return <NavbarSkeleton />;
  }

  const loggedIn = session.authenticated && session.user;
  const currentRole = loggedIn ? String(session.user.role || '').toLowerCase() : 'guest';
  const name = (session.user?.name || '').trim() || 'Pengguna';
  const initials = getInitials(name);
  const balance = formatIDR(Number(session.user?.balance ?? 0));
  const cartCount = Number(session.user?.cartCount ?? 0);
  const flags = session.flags || {
    auction_enabled: { enabled: true },
    chat_enabled: { enabled: true },
    checkout_enabled: { enabled: true }
  };

  const logoLink = currentRole === 'seller' ? '/seller/dashboard' : '/products';

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <a className="brand" href={logoLink} onClick={(e) => {
            e.preventDefault();
            handleNavClick(logoLink);
          }}>
            <div className="brand-icon"></div>
            <div className="brand-text">Nimonspedia</div>
          </a>

          <div className="nav-actions">
            {!loggedIn ? (
              <>
                <a
                  className="nav-link hide-mobile"
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/login');
                  }}
                >
                  Login
                </a>
                <a
                  className="register-btn hide-mobile"
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/register');
                  }}
                >
                  Daftar
                </a>
              </>
            ) : currentRole === 'seller' ? (
              <>
                <a
                  className="nav-link hide-mobile"
                  href="/seller/dashboard"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/seller/dashboard');
                  }}
                >
                  Dashboard
                </a>
                <a
                  className="nav-link hide-mobile"
                  href="/seller/products"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/seller/products');
                  }}
                >
                  Produk
                </a>
                <a
                  className="nav-link hide-mobile"
                  href="/seller/orders"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/seller/orders');
                  }}
                >
                  Orders
                </a>
                {flags.auction_enabled?.enabled && (
                  <a
                    className="nav-link hide-mobile"
                    href="/auction-history"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick('/auction-history');
                    }}
                  >
                    Lelang
                  </a>
                )}
                {flags.chat_enabled?.enabled && (
                  <a
                    className="nav-link hide-mobile"
                    href="/chat"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick('/chat');
                    }}
                  >
                    Chat
                  </a>
                )}
                <span className="saldo seller-saldo hide-mobile">
                  Saldo: <span className="val">{balance}</span>
                </span>
                <ProfileDropdown
                  initials={initials}
                  name={name}
                  isSeller={true}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  onProfileClick={() => handleNavClick('/seller/profile')}
                  onLogoutClick={() => setShowLogoutModal(true)}
                  dropdownRef={dropdownRef}
                />
              </>
            ) : (
              <>
                {flags.auction_enabled?.enabled && (
                  <a
                    className="nav-link hide-mobile"
                    href="/auctions"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick('/auctions');
                    }}
                  >
                    Lelang
                  </a>
                )}
                {flags.chat_enabled?.enabled && (
                  <a
                    className="nav-link hide-mobile"
                    href="/chat"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick('/chat');
                    }}
                  >
                    Chat
                  </a>
                )}
                {flags.checkout_enabled?.enabled && (
                  <a
                    className="nav-link cart-link hide-mobile"
                    href="/cart"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick('/cart');
                    }}
                    title="Keranjang"
                  >
                    <span className="cart"></span>
                    {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                  </a>
                )}
                <span
                  className="saldo buyer-saldo hide-mobile"
                  onClick={handleBalanceClick}
                  title="Top Up Saldo"
                  style={{ cursor: 'pointer' }}
                >
                  Saldo: <span className="val">{balance}</span>
                </span>
                <ProfileDropdown
                  initials={initials}
                  name={name}
                  isSeller={false}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  onProfileClick={() => handleNavClick('/profile')}
                  onOrdersClick={() => handleNavClick('/orders')}
                  onLogoutClick={() => setShowLogoutModal(true)}
                  dropdownRef={dropdownRef}
                />
              </>
            )}

            <button
              className="hamburger-btn"
              id="hamburger-btn"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Menu"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`mobile-menu ${showMobileMenu ? 'active' : ''}`}
          ref={mobileMenuRef}
        >
          {!loggedIn ? (
            <>
              <a
                className="mobile-menu-item"
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/login');
                }}
              >
                Login
              </a>
              <a
                className="mobile-menu-item"
                href="/register"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/register');
                }}
              >
                Daftar
              </a>
            </>
          ) : currentRole === 'seller' ? (
            <>
              <a
                className="mobile-menu-item"
                href="/seller/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/seller/dashboard');
                }}
              >
                Dashboard
              </a>
              <a
                className="mobile-menu-item"
                href="/seller/products"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/seller/products');
                }}
              >
                Produk
              </a>
              <a
                className="mobile-menu-item"
                href="/seller/orders"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/seller/orders');
                }}
              >
                Orders
              </a>
              {flags.auction_enabled?.enabled && (
                <a
                  className="mobile-menu-item"
                  href="/auction-history"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/auction-history');
                  }}
                >
                  Lelang
                </a>
              )}
              {flags.chat_enabled?.enabled && (
                <a
                  className="mobile-menu-item"
                  href="/chat"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/chat');
                  }}
                >
                  Chat
                </a>
              )}
              <div className="mobile-menu-item mobile-saldo seller-mobile-saldo">
                Saldo: <span className="val">{balance}</span>
              </div>
              <a
                className="mobile-menu-item"
                href="/seller/profile"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/seller/profile');
                }}
              >
                Profil
              </a>
              <button
                className="mobile-menu-item mobile-logout"
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowLogoutModal(true);
                }}
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              {flags.auction_enabled?.enabled && (
                <a
                  className="mobile-menu-item"
                  href="/auctions"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/auctions');
                  }}
                >
                  Lelang
                </a>
              )}
              {flags.chat_enabled?.enabled && (
                <a
                  className="mobile-menu-item"
                  href="/chat"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/chat');
                  }}
                >
                  Chat
                </a>
              )}
              {flags.checkout_enabled?.enabled && (
                <a
                  className="mobile-menu-item"
                  href="/cart"
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('/cart');
                  }}
                >
                  <span>Keranjang</span>
                  {cartCount > 0 && <span className="cart-badge-mobile">{cartCount}</span>}
                </a>
              )}
              <div
                className="mobile-menu-item mobile-saldo buyer-mobile-saldo"
                onClick={handleBalanceClick}
              >
                Saldo: <span className="val">{balance}</span>
              </div>
              <a
                className="mobile-menu-item"
                href="/profile"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/profile');
                }}
              >
                Profil Saya
              </a>
              <a
                className="mobile-menu-item"
                href="/orders"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('/orders');
                }}
              >
                Pesanan Saya
              </a>
              <button
                className="mobile-menu-item mobile-logout"
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowLogoutModal(true);
                }}
              >
                Keluar
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
};

const ProfileDropdown = ({
  initials,
  name,
  isSeller,
  showDropdown,
  setShowDropdown,
  onProfileClick,
  onOrdersClick,
  onLogoutClick,
  dropdownRef
}) => {
  return (
    <div className="profile-dropdown" ref={dropdownRef}>
      <button
        className={`profile-trigger ${showDropdown ? 'active' : ''}`}
        type="button"
        title={name}
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
      >
        <div className="avatar-circle">{initials}</div>
        <span className="profile-name">Hi, {name}</span>
        <div className="dropdown-arrow"></div>
      </button>
      <div className={`dropdown-menu ${showDropdown ? 'active' : ''}`}>
        <a
          className="dropdown-item"
          href={isSeller ? '/seller/profile' : '/profile'}
          onClick={(e) => {
            e.preventDefault();
            setShowDropdown(false);
            onProfileClick();
          }}
        >
          <div className="dropdown-icon icon-profile"></div>
          <span>{isSeller ? 'Profil' : 'Profil Saya'}</span>
        </a>
        {!isSeller && (
          <a
            className="dropdown-item"
            href="/orders"
            onClick={(e) => {
              e.preventDefault();
              setShowDropdown(false);
              onOrdersClick();
            }}
          >
            <div className="dropdown-icon icon-orders"></div>
            <span>Pesanan Saya</span>
          </a>
        )}
        <button
          className="dropdown-item logout-item"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setShowDropdown(false);
            onLogoutClick();
          }}
        >
          <div className="dropdown-icon icon-logout"></div>
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );
};

const LogoutModal = ({ isOpen, onCancel, onConfirm, isLoading }) => {
  return (
    <div className={`logout-modal-overlay ${isOpen ? 'active' : ''}`}>
      <div className="logout-modal">
        <div className="logout-modal-content">
          <img
            src="/uploads/seller/edit-confirmation-logo.svg"
            alt="Confirmation"
            className="logout-modal-image"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div className="logout-modal-text">
            <h3>Konfirmasi Logout</h3>
            <p>Apakah Anda yakin ingin keluar?</p>
          </div>
        </div>
        <div className="logout-modal-actions">
          <button
            className="logout-modal-btn logout-modal-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            Tidak
          </button>
          <button
            className="logout-modal-btn logout-modal-confirm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Logging out...' : 'Ya, Logout'}
          </button>
        </div>
      </div>
    </div>
  );
};

const NavbarSkeleton = () => {
  return (
    <nav className="app-nav">
      <div className="app-nav-inner">
        <a className="brand" href="/products">
          <div style={{ width: '150px', height: '28px' }}></div>
        </a>
        <div className="nav-actions">
          <span className="skeleton-pill" style={{ width: '80px', height: '28px', backgroundColor: '#e5e7eb', borderRadius: '999px' }}></span>
          <span className="skeleton-pill" style={{ width: '90px', height: '28px', backgroundColor: '#e5e7eb', borderRadius: '999px' }}></span>
        </div>
      </div>
    </nav>
  );
};

// Helper functions
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'NA';
}

function formatIDR(n = 0) {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(n);
  } catch {
    const x = Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `Rp${x}`;
  }
}

export default Navbar;
