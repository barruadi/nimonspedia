import { api } from './api.js';

export async function checkAlreadyLoggedIn() {
  try {
    const result = await api.get('/me');

    if (result && result.authenticated === true) {
      if (result.user.role === 'seller') {
        window.location.href = '/seller/dashboard';
      } else if (result.user.role === 'buyer') {
        window.location.href = '/products';
      }
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}
