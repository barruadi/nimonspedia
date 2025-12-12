import { api } from '/utils/api.js';
import { notificationManager } from '/utils/notificationManager.js';

(async function initProfile() {
  const rootLoading   = document.getElementById('profile-loading');
  const rootContent   = document.getElementById('profile-content');
  const errBox        = document.getElementById('profile-error');
  const okBox         = document.getElementById('profile-success');

  const nameSpan      = document.getElementById('p-name');
  const emailSpan     = document.getElementById('p-email');

  const editNameBtn   = document.getElementById('editNameBtn');
  const changePwBtn   = document.getElementById('changePwBtn');

  const toggleChat    = document.getElementById('toggle-chat');
  const toggleAuction = document.getElementById('toggle-auction');
  const toggleOrder   = document.getElementById('toggle-order');

  const nameModal     = document.getElementById('nameModal');
  const pwModal       = document.getElementById('pwModal');

  const nameForm      = document.getElementById('nameForm');
  const nameInput     = document.getElementById('nameInput');

  const pwForm        = document.getElementById('pwForm');
  const oldPwInput    = document.getElementById('oldPwInput');
  const newPwInput    = document.getElementById('newPwInput');
  const newPwConfirmInput = document.getElementById('newPwConfirmInput');

  let currentUserId = null;

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

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
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

  try {
    const res = await api.get('/me');

    if (!res || res.ok === false) {
      window.location.href = '/login';
      return;
    }

    const { user } = res;
    currentUserId = user.id || user.user_id;
    console.log('[Seller Profile] User ID set to:', currentUserId);
    nameSpan.textContent  = user.name || user.full_name || '';
    emailSpan.textContent = user.email || '';
    nameInput.value       = nameSpan.textContent;

    // Initialize notification manager and load preferences
    try {
      await notificationManager.init();
      const prefs = await notificationManager.getPreferences();
      
      console.log('[Seller Profile] Loaded preferences:', prefs);
      
      if (prefs) {
        toggleChat.checked = prefs.chat || false;
        toggleAuction.checked = prefs.auction || false;
        toggleOrder.checked = prefs.order || false;
      } else {
        // Default to true if no preferences found
        toggleChat.checked = true;
        toggleAuction.checked = true;
        toggleOrder.checked = true;
      }
    } catch (notifErr) {
      console.warn('[Seller Profile] Failed to load notification preferences:', notifErr);
      toggleChat.checked = true;
      toggleAuction.checked = true;
      toggleOrder.checked = true;
    }

    if (toggleChat) {
      toggleChat.addEventListener('change', (e) => {
        updateNotificationPreference('chat', e.target.checked);
      });
    }

    if (toggleAuction) {
      toggleAuction.addEventListener('change', (e) => {
        updateNotificationPreference('auction', e.target.checked);
      });
    }

    if (toggleOrder) {
      toggleOrder.addEventListener('change', (e) => {
        updateNotificationPreference('order', e.target.checked);
      });
    }

    rootLoading.style.display = 'none';
    rootContent.style.display = 'block';
  } catch (err) {
    rootLoading.textContent = 'Anda belum login.';
    console.error(err);
    return;
  }

  editNameBtn.addEventListener('click', () => {
    clearMessages();
    nameInput.value = nameSpan.textContent || '';
    openModal(nameModal);
  });

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

  changePwBtn.addEventListener('click', () => {
    clearMessages();
    oldPwInput.value = '';
    newPwInput.value = '';
    newPwConfirmInput.value = '';
    openModal(pwModal);
  });

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

  async function updateNotificationPreference(notificationType, enabled) {
    try {
      console.log(`[Seller Profile] Updating ${notificationType} to ${enabled}`);

      // Use notificationManager to update preference
      console.log("HASILLL: ")

      const success = await notificationManager.updatePreference(notificationType, enabled);
      console.log("HASILLL: ", success)

      if (success) {
        showSuccess('Pengaturan notifikasi berhasil diperbarui.');
        setTimeout(() => clearMessages(), 3000);
      } else {
        showError('Gagal memperbarui pengaturan.');
        // Revert toggle
        if (notificationType === 'chat') toggleChat.checked = !enabled;
        else if (notificationType === 'auction') toggleAuction.checked = !enabled;
        else if (notificationType === 'order') toggleOrder.checked = !enabled;
      }
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan jaringan.');
      // Revert toggle
      if (notificationType === 'chat') toggleChat.checked = !enabled;
      else if (notificationType === 'auction') toggleAuction.checked = !enabled;
      else if (notificationType === 'order') toggleOrder.checked = !enabled;
    }
  }
})();
