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
            <div class="brand-icon"></div>
            <div class="brand-text">Nimonspedia</div>
          </a>
          <div class="nav-actions">
            <span class="skeleton-pill" style="width:80px;height:28px;"></span>
            <span class="skeleton-pill" style="width:90px;height:28px;"></span>
          </div>
        </div>
      </nav>
    `;
    this.wireSpaLinks();
  }

  render() {
    const s = this._session || { authenticated:false, user:null };
    const loggedIn = !!s.authenticated && !!s.user;
    const displayName = (s.user?.name || 'Profil').trim();
    const initials = this.initials(displayName);

    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">
          <!-- LEFT: brand -->
          <a class="brand" href="/products" data-nav>
            <div class="brand-icon"></div>
            <div class="brand-text">Nimonspedia</div>
          </a>

          <!-- RIGHT: actions -->
          <div class="nav-actions">
            <a class="nav-link" href="/products" data-nav>Produk</a>
            

            <span class="nav-spacer"></span>

            ${loggedIn ? `
            <a class="nav-link" href="/checkout" data-nav>Keranjang</a>
              <a class="nav-link profile-link" href="/profile" data-nav title="${this.escape(displayName)}">
                <div class="avatar-circle">${initials}</div>
                <span class="profile-name">${this.escape(displayName)}</span>
              </a>
              <button id="logout-btn" class="logout-btn" type="button">Keluar</button>
            ` : `
              <a class="login-btn" href="/login" data-nav>Masuk</a>
              <a class="register-btn" href="/register" data-nav>Daftar</a>
            `}
          </div>
        </div>
      </nav>
    `;

    this.wireSpaLinks();
    if (loggedIn) this.wireLogout();
  }

  wireSpaLinks() {
    this.querySelectorAll('[data-nav]').forEach(a => {
      a.addEventListener('click', (e) => {
        if (!window.render) return; // no SPA router
        if (a.origin !== location.origin) return;
        e.preventDefault();
        const href = a.getAttribute('href');
        history.pushState({}, '', href);
        window.render(href);
      });
    });
  }

  wireLogout() {
    const btn = this.querySelector('#logout-btn');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.disabled = true;
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
      } finally {
        btn.disabled = false;
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

  escape(s='') {
    return s.replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
}

if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', AppNavbar);
}

export { notifyAuthChanged };
