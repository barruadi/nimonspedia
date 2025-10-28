import { api } from '/utils/api.js';

class AppNavbar extends HTMLElement {
  async connectedCallback() {
    const session = await this.fetchSession();
    const isLoggedIn = !!session;

    this.render(isLoggedIn, session);
    this.wireEvents(isLoggedIn);
  }

  async fetchSession() {
    try {
      const res = await api.get('/me');
      if (!res || res.ok === false) return null;
      return res.data || null;
    } catch (err) {
      return null;
    }
  }

  render(isLoggedIn, session) {
    const displayName = session?.full_name || 'Profil';

    this.innerHTML = `
      <nav class="app-nav">
        <div class="app-nav-inner">

          <!-- LEFT: brand -->
          <a class="brand" href="/home" data-nav>
            <div class="brand-icon"></div>
            <div class="brand-text">Nimonspedia</div>
          </a>

          <!-- RIGHT: auth / profile -->
          <div class="nav-actions">
            ${
              isLoggedIn
                ? `
                  <a class="nav-link profile-link" href="/profile" data-nav>
                    <div class="avatar-circle">${this.initials(displayName)}</div>
                    <span class="profile-name">${displayName}</span>
                  </a>
                  <button id="logout-link" class="logout-btn" type="button">
                    Keluar
                  </button>
                `
                : `
                  <a class="login-btn" href="/login" data-nav>
                    Masuk
                  </a>
                  <a class="register-btn" href="/register" data-nav>
                    Daftar
                  </a>
                `
            }
          </div>

        </div>
      </nav>
    `;
  }

  initials(name) {
    if (!name) return 'Name';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last  = parts[1]?.[0] || '';
    const init = (first + last).toUpperCase();
    return init || 'Name';
  }

  wireEvents(isLoggedIn) {
    this.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (!window.render) return;
        e.preventDefault();
        const href = link.getAttribute('href');
        history.pushState({}, '', href);
        window.render(href);
      });
    });

    if (!isLoggedIn) return;

    const logoutBtn = this.querySelector('#logout-link');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await api.get('/logout');
          // after logout go to /login
          history.pushState({}, '', '/login');
          if (window.render) {
            window.render('/login');
          } else {
            window.location.href = '/login';
          }
        } catch (err) {
          console.error('Logout failed:', err);
          alert('Gagal logout. Coba lagi.');
        }
      });
    }
  }
}

if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', AppNavbar);
}
