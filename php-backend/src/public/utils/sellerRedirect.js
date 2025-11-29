import { api } from './api.js';

export async function redirectSellerToDashboard() {
  try {
    const result = await api.get('/me');

    if (result && result.authenticated === true && result.user.role === 'seller') {
      window.location.href = '/seller/dashboard';
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}
