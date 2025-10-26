import { api } from './utils/api.js'

// Defines routes
const routes = {
  '/'         : '/Pages/HomePage.html',
  '/home'     : '/Pages/HomePage.html',
  '/login'    : '/Pages/LoginPage.html',
  '/register' : '/Pages/RegisterPage.html',
}

// SPA mount point
const app = document.getElementById('app');

// SPA renders
// Load page fragment into app
async function render(pathname) {
  const file = routes[pathname] || routes['/'];
  try {
    const html = await fetch(file, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.text();
    });
    app.innerHTML = html;

    [...app.querySelectorAll('script[type="module"][src]')].forEach(s => {
      const tag = document.createElement('script');
      tag.type = 'module';
      tag.src = s.getAttribute('src');
      document.body.appendChild(tag);
      s.remove();
    });

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
  render(location.pathname);
}

window.addEventListener('popstate', () => render(location.pathname));
window.addEventListener('click', onClick);

render(location.pathname);