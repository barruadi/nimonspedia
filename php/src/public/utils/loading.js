/**
 * Memicu komponen <app-loading> global.
 * @param {string} [title] - Judul besar (opsional).
 * @param {string} [subtitle] - Teks kecil di bawah (opsional).
 */
export function showLoading(title = 'Memuat...', subtitle = 'Tunggu sebentar...') {
  window.dispatchEvent(new CustomEvent('show-loading', {
    detail: { title, subtitle }
  }));
}

export function hideLoading() {
  window.dispatchEvent(new CustomEvent('hide-loading'));
}