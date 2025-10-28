import { api } from '/utils/api.js';
import '/components/Navbar.js';

const routes = {
  '/': {
    page: '/pages/HomePage.html',
    script: null,
  },
  '/home': {
    page: '/pages/HomePage.html',
    script: null,
  },
  '/login': {
    page: '/pages/LoginPage.html',
    script: '/script/Login.js',
  },
  '/register': {
    page: '/pages/RegisterPage.html',
    script: '/script/Register.js',
  },
  '/profile': {
    page: '/pages/ProfilePage.html',
    script: '/script/Profile.js',
  },
};

const app = document.getElementById('app');
const navbarRoot = document.getElementById('navbar-root');

function mountNavbar() {
  if (!navbarRoot.querySelector('app-navbar')) {
    const navEl = document.createElement('app-navbar');
    navbarRoot.appendChild(navEl);
  }
}

async function render(pathname) {
  const route = routes[pathname] || routes['/'];

  try {
    const res = await fetch(route.page, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const html = await res.text();
    app.innerHTML = html;

    if (route.script) {
      const modulePath = route.script.replace(/^\//, './');
      await import(modulePath);
    }
  } catch (e) {
    app.innerHTML = `
      <section style="padding:1rem">
        <h2>Page not found</h2>
        <p>${e.message}</p>
      </section>`;
  }
}

function onClick(e) {
  const a = e.target.closest('a[data-nav]');
  if (!a) return;
  if (a.origin !== location.origin) return;

  e.preventDefault();

  const url = a.getAttribute('href');
  history.pushState({}, '', url);
  render(url);
}

window.addEventListener('popstate', () => render(location.pathname));
window.addEventListener('click', onClick);

window.render = render;

mountNavbar();
render(location.pathname);
