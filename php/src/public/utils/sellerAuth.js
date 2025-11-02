import { showLoading, hideLoading } from './loading.js';
import { showToast } from './toast.js';

export async function checkSellerAuth() {
  showLoading('Memverifikasi akses...', 'Tunggu sebentar');

  return new Promise((resolve) => {
    setTimeout(() => {
      const session = window.__BOOT_SESSION__;

      if (!session || !session.authenticated) {
        showToast('Akses Ditolak', 'Anda harus login terlebih dahulu', 'error');
        setTimeout(() => {
          window.location.href = '/products';
        }, 1500);
        resolve(false);
        return;
      }

      if (session.user.role !== 'seller') {
        showToast('Akses Ditolak', 'Halaman ini hanya untuk seller', 'error');
        setTimeout(() => {
          window.location.href = '/products';
        }, 1500);
        resolve(false);
        return;
      }

      hideLoading();
      resolve(true);
    }, 300);
  });
}
