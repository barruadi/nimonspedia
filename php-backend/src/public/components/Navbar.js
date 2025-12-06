import { api } from '/utils/api.js';

function notifyAuthChanged(session) {
  window.dispatchEvent(new CustomEvent('auth:changed', { detail: session || null }));
}
if (!window.notifyAuthChanged) window.notifyAuthChanged = notifyAuthChanged;

class AppNavbar extends HTMLElement {
  async connectedCallback() {
    this._onAuth = () => this.refresh();
    window.addEventListener('auth:changed', this._onAuth);

    if (window.__BOOT_SESSION__) {
      this._session = window.__BOOT_SESSION__;
      delete window.__BOOT_SESSION__;
      this.render();
    } else {
      this.renderSkeleton();
    }

    await this.refresh();
  }

  disconnectedCallback() {
    window.removeEventListener('auth:changed', this._onAuth);
    // Clean up document click listener
    if (this._closeDropdown) {
      document.removeEventListener('click', this._closeDropdown);
    }
  }

  async refresh() {
    this._session = await this.fetchSession();
    this.render();
  }

  async fetchSession() {
    try {
      const res = await api.get('/me'); // { authenticated, user: { role, name, balance, cartCount? } }
      if (!res || res.authenticated !== true) return { authenticated: false, user: null };
      return { authenticated: true, user: res.user || null };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  /* ---------- renderers ---------- */
  renderSkeleton() {
    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          <a class="brand" href="/products" data-nav>
          </a>
          <div class="nav-actions">
            <span class="skeleton-pill" style="width:80px;height:28px;background:#e5e7eb;border-radius:999px;"></span>
            <span class="skeleton-pill" style="width:90px;height:28px;background:#e5e7eb;border-radius:999px;"></span>
          </div>
        </div>
      </nav>
    `;
    this.wireSpaLinks();
  }
  
  render() {
    const s = this._session || { authenticated: false, user: null };
    const loggedIn = !!s.authenticated && !!s.user;
    const role = loggedIn ? (String(s.user.role || '').toLowerCase()) : 'guest';
    const name = (s.user?.name || '').trim() || 'Pengguna';
    const initials = this.initials(name);
    const balance = this.formatIDR(Number(s.user?.balance ?? 0));
    const cartCount = Number(s.user?.cartCount ?? 0);

    // Determine logo link based on role
    const logoLink = (role === 'seller') ? '/seller/dashboard' : '/products';

    let rightHTML = '';
    let mobileMenuHTML = '';

    if (!loggedIn) {
      // --- Guest (not logged in) ---
      rightHTML = `
        <a class="nav-link hide-mobile" href="/login" data-nav>Login</a>
        <a class="register-btn hide-mobile" href="/register" data-nav>Daftar</a>
      `;
      mobileMenuHTML = `
        <a class="mobile-menu-item" href="/login" data-nav data-mobile-item>Login</a>
        <a class="mobile-menu-item" href="/register" data-nav data-mobile-item>Daftar</a>
      `;
    } else if (role === 'seller') {
      rightHTML = `
        <a class="nav-link hide-mobile" href="/seller/dashboard" data-nav>Dashboard</a>
        <a class="nav-link hide-mobile" href="/seller/products" data-nav>Produk</a>
        <a class="nav-link hide-mobile" href="/seller/orders" data-nav>Orders</a>
        <span class="saldo seller-saldo hide-mobile">
          Saldo: <span class="val">${balance}</span>
        </span>
        <div class="profile-dropdown hide-mobile">
          <button class="profile-trigger" type="button" id="profile-trigger" title="${this.escape(name)}">
            <div class="avatar-circle">${initials}</div>
            <span class="profile-name">Hi, ${this.escape(name)}</span>
            <div class="dropdown-arrow"></div>
          </button>
          <div class="dropdown-menu" id="profile-dropdown">
            <a class="dropdown-item" href="/seller/profile" data-nav data-dropdown-item>
              <div class="dropdown-icon icon-profile"></div>
              <span>Profil</span>
            </a>
            <button class="dropdown-item logout-item" type="button" id="logout-btn">
              <div class="dropdown-icon icon-logout"></div>
              <span>Keluar</span>
            </button>
          </div>
        </div>
      `;
      mobileMenuHTML = `
        <a class="mobile-menu-item" href="/seller/dashboard" data-nav data-mobile-item>Dashboard</a>
        <a class="mobile-menu-item" href="/seller/products" data-nav data-mobile-item>Produk</a>
        <a class="mobile-menu-item" href="/seller/orders" data-nav data-mobile-item>Orders</a>
        <div class="mobile-menu-item mobile-saldo seller-mobile-saldo">
          Saldo: <span class="val">${balance}</span>
        </div>
        <a class="mobile-menu-item" href="/seller/profile" data-nav data-mobile-item>Profil</a>
        <button class="mobile-menu-item mobile-logout" id="logout-btn-mobile" type="button">Keluar</button>
      `;
    } else {
      // --- Buyer view (cart with badge, Saldo, profile pill) ---
      rightHTML = `
          <a class="nav-link cart-link hide-mobile" href="/cart" data-nav title="Keranjang">
            <span class="cart"></span>
            ${cartCount > 0 ? `<span class="cart-badge">${cartCount}</span>` : ''}
          </a>
          <span class="saldo buyer-saldo hide-mobile" id="saldo-trigger" title="Top Up Saldo">
            Saldo: <span class="val">${balance}</span>
          </span>
          <div class="profile-dropdown hide-mobile">
            <button class="profile-trigger" type="button" id="profile-trigger" title="${this.escape(name)}">
              <div class="avatar-circle">${initials}</div>
              <span class="profile-name">Hi, ${this.escape(name)}</span>
              <div class="dropdown-arrow"></div>
            </button>
            <div class="dropdown-menu" id="profile-dropdown">
              <a class="dropdown-item" href="/profile" data-nav data-dropdown-item>
                <div class="dropdown-icon icon-profile"></div>
                <span>Profil Saya</span>
              </a>
              <a class="dropdown-item" href="/orders" data-nav data-dropdown-item>
                <div class="dropdown-icon icon-orders"></div>
                <span>Pesanan Saya</span>
              </a>
              <button class="dropdown-item logout-item" type="button" id="logout-btn">
                <div class="dropdown-icon icon-logout"></div>
                <span>Keluar</span>
              </button>
            </div>
          </div>
      `;
      mobileMenuHTML = `
        <a class="mobile-menu-item" href="/cart" data-nav data-mobile-item>
          <span>Keranjang</span>
          ${cartCount > 0 ? `<span class="cart-badge-mobile">${cartCount}</span>` : ''}
        </a>
        <div class="mobile-menu-item mobile-saldo buyer-mobile-saldo" id="saldo-trigger-mobile">
          Saldo: <span class="val">${balance}</span>
        </div>
        <a class="mobile-menu-item" href="/profile" data-nav data-mobile-item>Profil Saya</a>
        <a class="mobile-menu-item" href="/orders" data-nav data-mobile-item>Pesanan Saya</a>
        <button class="mobile-menu-item mobile-logout" id="logout-btn-mobile" type="button">Keluar</button>
      `;
    }

    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          <a class="brand" href="${logoLink}" data-nav>
            <div class="brand-icon"></div>
            <div class="brand-text">Nimonspedia</div>
          </a>
          <div class="nav-actions">
            ${rightHTML}
            <button class="hamburger-btn" id="hamburger-btn" type="button" aria-label="Menu">
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
              <span class="hamburger-line"></span>
            </button>
          </div>
        </div>
        <div class="mobile-menu" id="mobile-menu">
          ${mobileMenuHTML}
        </div>
      </nav>

      <!-- Logout Confirmation Modal -->
      <div class="logout-modal-overlay" id="logout-modal-overlay">
        <div class="logout-modal">
          <div class="logout-modal-content">
            <img src="/uploads/seller/edit-confirmation-logo.svg" alt="Confirmation" class="logout-modal-image">
            <div class="logout-modal-text">
              <h3>Konfirmasi Logout</h3>
              <p>Apakah Anda yakin ingin keluar?</p>
            </div>
          </div>
          <div class="logout-modal-actions">
            <button class="logout-modal-btn logout-modal-cancel" id="logout-modal-cancel">Tidak</button>
            <button class="logout-modal-btn logout-modal-confirm" id="logout-modal-confirm">Ya, Logout</button>
          </div>
        </div>
      </div>
    `;

    this.wireSpaLinks();
    this.wireHamburger();
    if (loggedIn) {
      this.wireLogout();
      if (role === 'buyer') {
        this.wireBalanceModal();
      }
      if (role === 'buyer' || role === 'seller') {
        this.wireDropdown();
      }
    }
  }

  wireSpaLinks() {
    this.querySelectorAll('[data-nav]').forEach(a => {
      a.addEventListener('click', (e) => {
        if (!window.render) return;
        if (a.origin !== location.origin) return;
        e.preventDefault();
        const href = a.getAttribute('href');

        // Close mobile menu if item is clicked
        if (a.hasAttribute('data-mobile-item')) {
          const mobileMenu = this.querySelector('#mobile-menu');
          const hamburgerBtn = this.querySelector('#hamburger-btn');
          if (mobileMenu) mobileMenu.classList.remove('active');
          if (hamburgerBtn) hamburgerBtn.classList.remove('active');
        }

        history.pushState({}, '', href);
        window.render(href);
      });
    });
  }

  wireHamburger() {
    const btn = this.querySelector('#hamburger-btn');
    const menu = this.querySelector('#mobile-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = menu.classList.contains('active');

      if (isActive) {
        menu.classList.remove('active');
        btn.classList.remove('active');
      } else {
        menu.classList.add('active');
        btn.classList.add('active');
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        menu.classList.remove('active');
        btn.classList.remove('active');
      }
    });
  }

  wireDropdown() {
    const trigger = this.querySelector('#profile-trigger');
    const menu = this.querySelector('#profile-dropdown');
    if (!trigger || !menu) return;

    // Toggle dropdown on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = menu.classList.contains('active');
      
      if (isActive) {
        menu.classList.remove('active');
        trigger.classList.remove('active');
      } else {
        menu.classList.add('active');
        trigger.classList.add('active');
      }
    });

    // Close dropdown when clicking outside
    this._closeDropdown = (e) => {
      if (!this.contains(e.target)) {
        menu.classList.remove('active');
        trigger.classList.remove('active');
      }
    };
    document.addEventListener('click', this._closeDropdown);

    // Close dropdown when clicking menu items
    menu.querySelectorAll('[data-dropdown-item]').forEach(item => {
      item.addEventListener('click', () => {
        menu.classList.remove('active');
        trigger.classList.remove('active');
      });
    });
  }

  wireLogout() {
    const btns = this.querySelectorAll('#logout-btn, #logout-btn-mobile');
    const modal = this.querySelector('#logout-modal-overlay');
    const confirmBtn = this.querySelector('#logout-modal-confirm');
    const cancelBtn = this.querySelector('#logout-modal-cancel');

    if (!btns.length || !modal) return;

    // Show modal when logout button clicked
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        modal.classList.add('active');
      });
    });

    // Cancel logout - close modal
    const closeModal = () => {
      modal.classList.remove('active');
    };

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }

    // Close modal when clicking overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Confirm logout - actually logout
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const originalHTML = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Logging out...';

        try {
          await api.post('/logout', {});
          notifyAuthChanged({ authenticated: false, user: null });
          if (window.render) {
            history.pushState({}, '', '/login');
            window.render('/login');
          } else {
            location.href = '/login';
          }
        } catch (err) {
          console.error('Logout failed:', err);
          alert('Gagal logout. Coba lagi.');
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalHTML;
          closeModal();
        }
      });
    }
  }

  wireBalanceModal() {
    const triggers = this.querySelectorAll('#saldo-trigger, #saldo-trigger-mobile');
    if (!triggers.length) return;

    triggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-top-up-modal'));

        // Close mobile menu if clicking from mobile
        if (trigger.id === 'saldo-trigger-mobile') {
          const mobileMenu = this.querySelector('#mobile-menu');
          const hamburgerBtn = this.querySelector('#hamburger-btn');
          if (mobileMenu) mobileMenu.classList.remove('active');
          if (hamburgerBtn) hamburgerBtn.classList.remove('active');
        }
      });
    });
  }

  initials(name='') {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'NA';
  }

  formatIDR(n=0) {
    try {
      return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(n);
    } catch {
      const x = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `Rp${x}`;
    }
  }

  escape(s = '') {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
}

if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', AppNavbar);
}

export { notifyAuthChanged };