import { api } from '/utils/api.js';

function notifyAuthChanged(session) {
  window.dispatchEvent(new CustomEvent('auth:changed', { detail: session || null }));
}
if (!window.notifyAuthChanged) window.notifyAuthChanged = notifyAuthChanged;

class AppNavbar extends HTMLElement {
  async connectedCallback() {
    this._onAuth = () => this.refresh(); // react to global auth changes
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

  // --- Public: manually force a refresh (optional) ---
  async refresh() {
    this._session = await this.fetchSession();
    this.render();
  }

  async fetchSession() {
    try {
      const res = await api.get('/me'); // { authenticated, user }
      if (!res || res.authenticated !== true) {
        return { authenticated: false, user: null };
      }
      return { authenticated: true, user: res.user || null };
    } catch {
      return { authenticated: false, user: null };
    }
  }

  renderSkeleton() {
    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          <a class="brand" href="/products" data-nav>
            <div class="brand-icon">N</div>
            <div class="brand-text">Nimonspedia</div>
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
    const displayName = (s.user?.name || 'Profil').trim();
    const initials = this.initials(displayName);

    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          <a class="brand" href="/products" data-nav>
            <div class="brand-icon">N</div>
            <div class="brand-text">Nimonspedia</div>
          </a>

          <div class="nav-actions">
            ${loggedIn ? `
              <a class="nav-link" href="/products" data-nav>Produk</a>
              <a class="nav-link" href="/checkout" data-nav>Keranjang</a>
              
              <div class="profile-dropdown">
                <button class="profile-trigger" type="button" id="profile-trigger" title="${this.escape(displayName)}">
                  <div class="avatar-circle">${initials}</div>
                  <span class="profile-name">Hi, ${this.escape(displayName)}</span>
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
            ` : `
              <a class="login-btn" href="/login" data-nav>Masuk</a>
              <a class="register-btn" href="/register" data-nav>Daftar</a>
            `}
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
        btn.disabled = false;
        btn.innerHTML = '<div class="dropdown-icon icon-logout"></div><span>Keluar</span>';
      }
    });
  }

  initials(name) {
    const parts = (name || '').trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    const init = (first + second).toUpperCase();
    return init || 'NA';
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