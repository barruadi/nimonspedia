import { api } from '/utils/api.js';

class AppNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <nav style="padding:10px;border-bottom:1px solid #ddd;display:flex;gap:12px">
        <a data-nav href="/home">Home</a>
        <a data-nav href="/login">Login</a>
        <a data-nav href="/register">Register</a>
        <a data-nav href="/profile">Profile</a>
        <a id="logout-link" href="#">Logout</a>
      </nav>
    `;

    const logoutLink = this.querySelector('#logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await api.post('/logout');
          history.pushState({}, '', '/login');
          if (window.render) {
            window.render('/login');
          } else {
            window.location.href = '/login';
          }
        } catch (err) {
          console.error('Logout failed:', err);
          alert('Failed to logout. Please try again.');
        }
      });
    }
  }
}

if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', AppNavbar);
}
