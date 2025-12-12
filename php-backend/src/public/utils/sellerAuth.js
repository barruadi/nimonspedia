import { showLoading, hideLoading } from './loading.js';
import { showToast } from './toast.js';
import { api } from './api.js';

export async function checkSellerAuth() {
  showLoading('Memverifikasi akses...', 'Tunggu sebentar');

  try {
    const result = await api.get('/me');

    if (!result || result.authenticated !== true) {
      showToast('Akses Ditolak', 'Anda harus login terlebih dahulu', 'error');
      setTimeout(() => {
        window.location.href = '/products';
      }, 1500);
      return false;
    }

    if (result.user.role !== 'seller') {
      showToast('Akses Ditolak', 'Halaman ini hanya untuk seller', 'error');
      setTimeout(() => {
        window.location.href = '/products';
      }, 1500);
      return false;
    }

    hideLoading();
    return true;

  } catch (error) {
    console.error('Auth check error:', error);
    showToast('Akses Ditolak', 'Terjadi kesalahan saat verifikasi', 'error');
    setTimeout(() => {
      window.location.href = '/products';
    }, 1500);
    return false;
  }
}
