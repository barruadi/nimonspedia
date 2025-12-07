import { api } from '/utils/api.js';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications,
  isUserSubscribed,
  getNotificationPermissionStatus
} from '/utils/pushNotification.js';

(async function initProfile() {
  const rootLoading   = document.getElementById('profile-loading');
  const rootContent   = document.getElementById('profile-content');
  const errBox        = document.getElementById('profile-error');
  const okBox         = document.getElementById('profile-success');

  const nameSpan      = document.getElementById('p-name');
  const emailSpan     = document.getElementById('p-email');

  // triggers
  const editNameBtn   = document.getElementById('editNameBtn');
  const changePwBtn   = document.getElementById('changePwBtn');

  const toggleChat    = document.getElementById('toggle-chat');
  const toggleAuction = document.getElementById('toggle-auction');
  const toggleOrder   = document.getElementById('toggle-order');

  // modals + forms
  const nameModal     = document.getElementById('nameModal');
  const pwModal       = document.getElementById('pwModal');

  const nameForm      = document.getElementById('nameForm');
  const nameInput     = document.getElementById('nameInput');
  const cancelNameBtn = document.getElementById('cancelNameBtn');

  const pwForm        = document.getElementById('pwForm');
  const oldPwInput    = document.getElementById('oldPwInput');
  const newPwInput    = document.getElementById('newPwInput');
  const newPwConfirmInput = document.getElementById('newPwConfirmInput');
  const cancelPwBtn   = document.getElementById('cancelPwBtn');

  let currentUserId = null;
  let isPushSubscribed = false;

  function showError(msg) {
    if (!errBox || !okBox) return;
    errBox.style.display = 'block';
    errBox.textContent = msg;
    okBox.style.display = 'none';
    okBox.textContent = '';
  }
  function showSuccess(msg) {
    if (!errBox || !okBox) return;
    okBox.style.display = 'block';
    okBox.textContent = msg;
    errBox.style.display = 'none';
    errBox.textContent = '';
  }
  function clearMessages() {
    if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
    if (okBox)  { okBox.style.display  = 'none'; okBox.textContent  = ''; }
  }

  // simple modal helpers
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    // focus first input if any
    const first = modal.querySelector('input, textarea, button.save-btn');
    first?.focus();
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  function wireModalClose(modal) {
    if (!modal) return;
    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => closeModal(modal));
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal(modal);
    });
  }
  wireModalClose(nameModal);
  wireModalClose(pwModal);

  function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-pw');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;

        const isVisible = btn.getAttribute('data-visible') === 'true';
        if (isVisible) {
          input.type = 'password';
          btn.setAttribute('data-visible', 'false');
        } else {
          input.type = 'text';
          btn.setAttribute('data-visible', 'true');
        }
      });
    });
  }
  setupPasswordToggles();

  /* ---------- load profile ---------- */
  try {
    const res = await api.get('/me');

    if (!res || res.ok === false) {
      window.location.href = '/login';
      return;
    }

    const { user } = res;
    currentUserId = user.id || user.user_id;
    console.log('[Profile] User ID set to:', currentUserId);
    nameSpan.textContent  = user.name || user.full_name || '';
    emailSpan.textContent = user.email || '';
    nameInput.value       = nameSpan.textContent;

    try {
      const notifRes = await api.get('/profile/notifications');
      if (notifRes && notifRes.ok) {
        const prefs = notifRes.preferences || {};
        toggleChat.checked = prefs.chat_enabled !== false;
        toggleAuction.checked = prefs.auction_enabled !== false;
        toggleOrder.checked = prefs.order_enabled !== false;
      }
    } catch (notifErr) {
      console.warn('Failed to load notification preferences:', notifErr);
      toggleChat.checked = true;
      toggleAuction.checked = true;
      toggleOrder.checked = true;
    }

    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
        console.log('Service worker registered in Profile.js');
      }
      isPushSubscribed = await isUserSubscribed();
      console.log('Push subscription status:', isPushSubscribed);
    } catch (subErr) {
      console.warn('Failed to check subscription status:', subErr);
      isPushSubscribed = false;
    }

    if (toggleChat) {
      toggleChat.addEventListener('change', (e) => {
        updateNotificationPreference('chat_enabled', e.target.checked);
      });
    }

    if (toggleAuction) {
      toggleAuction.addEventListener('change', (e) => {
        updateNotificationPreference('auction_enabled', e.target.checked);
      });
    }

    if (toggleOrder) {
      toggleOrder.addEventListener('change', (e) => {
        updateNotificationPreference('order_enabled', e.target.checked);
      });
    }

    rootLoading.style.display = 'none';
    rootContent.style.display = 'block';
  } catch (err) {
    rootLoading.textContent = 'Anda belum login.';
    console.error(err);
    return;
  }

  /* ---------- NAME (modal) ---------- */
  editNameBtn.addEventListener('click', () => {
    clearMessages();
    nameInput.value = nameSpan.textContent || '';
    openModal(nameModal);
  });

  if (cancelNameBtn) {
    cancelNameBtn.addEventListener('click', () => {
      clearMessages();
      closeModal(nameModal);
    });
  }

  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const newName = nameInput.value.trim();
    if (!newName) {
      showError('Nama tidak boleh kosong.');
      return;
    }

    const saveBtn = nameForm.querySelector('.save-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const updateRes = await api.post('/profile/change-username', { full_name: newName });

      if (!updateRes || updateRes.ok === false) {
        showError(updateRes?.error?.message || 'Gagal memperbarui nama.');
        if (saveBtn) saveBtn.disabled = false;
        return;
      }

      nameSpan.textContent = newName;
      closeModal(nameModal);
      showSuccess('Nama berhasil diperbarui.');
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan jaringan.');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  /* ---------- PASSWORD (modal) ---------- */
  changePwBtn.addEventListener('click', () => {
    clearMessages();
    oldPwInput.value = '';
    newPwInput.value = '';
    newPwConfirmInput.value = '';
    openModal(pwModal);
  });

  if (cancelPwBtn) {
    cancelPwBtn.addEventListener('click', () => {
      clearMessages();
      closeModal(pwModal);
    });
  }

  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const oldPw = oldPwInput.value;
    const newPw = newPwInput.value;
    const confirmPw = newPwConfirmInput.value;

    if (!oldPw || !newPw || !confirmPw) {
      showError('Lengkapi semua field password.');
      return;
    }
    if (newPw !== confirmPw) {
      showError('Password baru tidak sama.');
      return;
    }

    const saveBtn = pwForm.querySelector('.save-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const pwRes = await api.post('/profile/change-password', {
        old_password: oldPw,
        new_password: newPw
      });

      if (!pwRes || pwRes.ok === false) {
        showError(pwRes?.error?.message || 'Gagal mengganti password.');
        if (saveBtn) saveBtn.disabled = false;
        return;
      }

      closeModal(pwModal);
      showSuccess('Password berhasil diubah.');
      oldPwInput.value = '';
      newPwInput.value = '';
      newPwConfirmInput.value = '';
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan jaringan.');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  async function updateNotificationPreference(field, enabled) {
    try {
      // Save preference to database
      const res = await api.post('/profile/notifications', {
        [field]: enabled
      });

      if (res && res.ok) {
        // Handle push subscription based on all toggle states
        await handlePushSubscription();
        
        showSuccess('Pengaturan notifikasi berhasil diperbarui.');
        setTimeout(() => clearMessages(), 3000);
      } else {
        showError(res?.error?.message || 'Gagal memperbarui pengaturan.');
      }
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan jaringan.');
    }
  }

  async function handlePushSubscription() {
    try {
      console.log('[Push] handlePushSubscription called, currentUserId:', currentUserId);
      
      if (!currentUserId) {
        console.error('User ID not available');
        showError('Terjadi kesalahan. Silakan refresh halaman.');
        return;
      }

      const anyEnabled = toggleChat.checked || toggleAuction.checked || toggleOrder.checked;
      
      if (anyEnabled && !isPushSubscribed) {
        console.log('Subscribing to push notifications for user:', currentUserId);
        await subscribeToPushNotifications(currentUserId);
        isPushSubscribed = true;
        console.log('Successfully subscribed to push notifications');
      } else if (!anyEnabled && isPushSubscribed) {
        console.log('Unsubscribing from push notifications for user:', currentUserId);
        await unsubscribeFromPushNotifications(currentUserId);
        isPushSubscribed = false;
        console.log('Successfully unsubscribed from push notifications');
      }
    } catch (error) {
      console.error('Error handling push subscription:', error);
      
      const permissionStatus = getNotificationPermissionStatus();
      if (permissionStatus === 'denied') {
        showError('Notifikasi diblokir. Silakan aktifkan di pengaturan browser.');
      } else if (permissionStatus === 'unsupported') {
        showError('Browser Anda tidak mendukung push notification.');
      } else {
        showError('Gagal mengaktifkan push notification. Silakan coba lagi.');
      }
    }
  }
})();
