/**
 * Show toast notification (same as PHP backend implementation)
 * Dispatches custom event that can be listened by global toast component
 * @param {string} primary - Main message
 * @param {string} [secondary] - Secondary message (optional)
 * @param {'success' | 'error'} [type] - Toast type ('success' or 'error')
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
