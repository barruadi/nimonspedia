import { api } from '/utils/api.js';

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

  /* ---------- load profile ---------- */
  try {
    const res = await api.get('/me');

    if (!res || res.ok === false) {
      window.location.href = '/login';
      return;
    }

    const { user } = res;
    nameSpan.textContent  = user.full_name || user.name || '';
    emailSpan.textContent = user.email || '';
    nameInput.value       = nameSpan.textContent;

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
      const updateRes = await api.patch('/me', { full_name: newName });

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
      const pwRes = await api.patch('/profile/change-password', {
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
})();
