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

    let rightHTML = '';

    if (!loggedIn) {
      // --- Guest (not logged in) ---
      rightHTML = `
        <a class="nav-link hide-sm" href="/login" data-nav>Login</a>
        <a class="register-btn" href="/register" data-nav>Daftar</a>
      `;
    } else if (role === 'seller') {
      // --- Seller view (Dashboard, Produk, Orders, Saldo, Logout) ---
      rightHTML = `
        <a class="nav-link" href="/seller/dashboard" data-nav>Dashboard</a>
        <a class="nav-link" href="/seller/products" data-nav>Produk</a>
        <a class="nav-link" href="/seller/orders" data-nav>Orders</a>
        <span class="saldo">Saldo: <span class="val">${balance}</span></span>
        <button id="logout-btn" class="logout-btn" type="button">Logout</button>
      `;
    } else {
      // --- Buyer view (cart with badge, Saldo, profile pill) ---
      rightHTML = `
<a class="nav-link" href="/products" data-nav>Produk</a>
              <a class="nav-link" href="/cart" data-nav>Keranjang</a>
              
              <div class="profile-dropdown">
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
    }

    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          <a class="brand" href="/products" data-nav>
          <div class="brand-icon"></div>
            <div class="brand-text">Nimonspedia</div>
          </a>
          <div class="nav-actions">
            ${rightHTML}
          </div>
        </div>
      </nav>
    `;

    this.wireSpaLinks();
    if (loggedIn) {
      this.wireDropdown();
      this.wireLogout();
    }
  }

  wireSpaLinks() {
    this.querySelectorAll('[data-nav]').forEach(a => {
      a.addEventListener('click', (e) => {
        if (!window.render) return;
        if (a.origin !== location.origin) return;
        e.preventDefault();
        const href = a.getAttribute('href');
        history.pushState({}, '', href);
        window.render(href);
      });
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
    const btn = this.querySelector('#logout-btn');
    if (!btn) return;
    
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      btn.disabled = true;
      btn.textContent = 'Logging out...';
      
      try {
        await api.post('/logout', {});
        notifyAuthChanged({ authenticated:false, user:null });
        if (window.render) {
          history.pushState({}, '', '/login');
          window.render('/login');
        } else {
          location.href = '/login';
        }
      } catch (err) {
        console.error('Logout failed:', err);
        alert('Gagal logout. Coba lagi.');
        btn.disabled = false;
        btn.innerHTML = '<div class="dropdown-icon icon-logout"></div><span>Keluar</span>';
      }
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