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
  '/cart': {
    page: '/pages/CartPage.html',
    script: '/script/Cart.js',
  },
  '/seller/dashboard': {
    page: '/pages/DashboardPage.html',
    script: '/script/Dashboard.js',
  },
  '/seller/products': {
    page: '/pages/ProductManagementPage.html',
    script: '/script/ProductManagement.js',
  },
  '/seller/products/add': {
    page: '/pages/AddProductPage.html',
    script: '/script/AddProduct.js',
  },
  '/seller/products/edit/:id': {
    page: '/pages/EditProductPage.html',
    script: '/script/EditProduct.js',
  },
  '/seller/orders': {
    page: '/pages/OrderManagementPage.html',
    script: '/script/OrderManagement.js',
  }
};

const app = document.getElementById('app');
const navbarRoot = document.getElementById('navbar-root');

function mountNavbar() {
  if (!navbarRoot.querySelector('app-navbar')) {
    const navEl = document.createElement('app-navbar');
    navbarRoot.appendChild(navEl);
  }
}

// Match dynamic routes
function matchRoute(pathname) {
  if (routes[pathname]) {
    return { route: routes[pathname], params: {} };
  }

  for (const [pattern, route] of Object.entries(routes)) {
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
    const match = pathname.match(regex);
    
    if (match) {
      const paramNames = (pattern.match(/:\w+/g) || []).map(p => p.substring(1));
      
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      
      return { route, params };
    }
  }

  return { route: routes['/'], params: {} };
}

async function render(pathname) {
  const { route, params } = matchRoute(pathname);

  try {
    const cacheBuster = Date.now();
    const res = await fetch(`${route.page}?_=${cacheBuster}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const html = await res.text();
    app.innerHTML = html;

    await new Promise(resolve => setTimeout(resolve, 50));

    window.routeParams = params;

    if (route.script) {
      const modulePath = route.script.replace(/^\//, './');
      await import(`${modulePath}?_=${cacheBuster}`);
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
