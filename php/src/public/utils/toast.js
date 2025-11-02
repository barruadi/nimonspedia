/**
 * Memicu komponen <app-toast> global.
 * @param {string} primary - Pesan utama.
 * @param {string} [secondary] - Pesan sekunder (opsional).
 * @param {'success' | 'error'} [type] - Tipe toast ('success' atau 'error').
 */
export function showToast(primary, secondary = '', type = 'success') {
  window.dispatchEvent(new CustomEvent('show-toast', {
    detail: {
      primary,
      secondary,
      type
    }
  }));
}