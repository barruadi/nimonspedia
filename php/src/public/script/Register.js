import { api } from '/utils/api.js';

const form = document.getElementById('registerForm');
const errorEl = document.getElementById('registerError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  const full_name = e.target.full_name.value.trim();
  const email = e.target.email.value.trim();
  const password = e.target.password.value;
  const confirm_password = e.target.confirm_password.value;

  if (password !== confirm_password) {
    errorEl.textContent = 'Password confirmation does not match.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await api.post('/register', {
      full_name,
      email,
      password,
    });

    if (!res || res?.ok === false) {
      throw new Error(res?.error?.message || 'Registration failed');
    }

    window.location.href = '/login';

  } catch (err) {
    errorEl.textContent =
      err.data?.error?.message ||
      err.message ||
      'Registration failed';
    errorEl.style.display = 'block';
  }
});
