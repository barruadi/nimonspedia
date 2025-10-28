import { api } from '/utils/api.js';

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';

  const email = e.target.email.value.trim();
  const password = e.target.password.value;

  try {
    const res = await api.post('/login', { 
      email, 
      password 
    });
    console.log(res);
    if (res?.ok === false) {
      throw new Error(res.error?.message || 'Login failed');
    }
    
    window.location.href = '/home';
  } catch (err) {
    errorEl.textContent = err.data?.error?.message || err.message || 'Login failed';
    errorEl.style.display = 'block';
  }
});