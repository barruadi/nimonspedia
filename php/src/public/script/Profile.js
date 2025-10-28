import { api } from '/utils/api.js';

(async function load() {
  const loading = document.getElementById('profile-loading');
  const content = document.getElementById('profile-content');

  try {
    const res = await api.get('/me');
    if (!res || res.ok === false) {

      window.location.href = '/login';
      return;
    }

    const { user } = res;
    
    document.getElementById('p-name').textContent = user.name || '';
    document.getElementById('p-email').textContent = user.email || '';
    document.getElementById('p-role').textContent = user.role || '';
    document.getElementById('p-balance').textContent = user.balance ?? '0.00';

    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    loading.textContent = 'Failed to load profile.';
    console.error(err);
  }
})();
