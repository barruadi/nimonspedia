import { api } from '/utils/api.js';

(async function initProfile() {
  const rootLoading  = document.getElementById('profile-loading');
  const rootContent  = document.getElementById('profile-content');
  const errBox       = document.getElementById('profile-error');
  const okBox        = document.getElementById('profile-success');

  const nameSpan     = document.getElementById('p-name');
  const emailSpan    = document.getElementById('p-email');

  const editNameBtn  = document.getElementById('editNameBtn');
  const nameForm     = document.getElementById('nameForm');
  const nameInput    = document.getElementById('nameInput');
  const cancelNameBtn= document.getElementById('cancelNameBtn');

  const changePwBtn  = document.getElementById('changePwBtn');
  const pwForm       = document.getElementById('pwForm');
  const cancelPwBtn  = document.getElementById('cancelPwBtn');
  const oldPwInput   = document.getElementById('oldPwInput');
  const newPwInput   = document.getElementById('newPwInput');
  const newPwConfirmInput = document.getElementById('newPwConfirmInput');

  // helpers
  function showError(msg) {
    if (!errBox) return;
    errBox.style.display = 'block';
    errBox.textContent = msg;
    okBox.style.display = 'none';
    okBox.textContent = '';
  }

  function showSuccess(msg) {
    if (!okBox) return;
    okBox.style.display = 'block';
    okBox.textContent = msg;
    errBox.style.display = 'none';
    errBox.textContent = '';
  }

  function clearMessages() {
    errBox.style.display = 'none';
    errBox.textContent = '';
    okBox.style.display = 'none';
    okBox.textContent = '';
  }

  // load profile data
  try {
    const res = await api.get('/me');

    if (!res || res.ok === false) {
      window.location.href = '/login';
      return;
    }

    const { user } = res;

    nameSpan.textContent  = user.full_name || user.name || '';
    emailSpan.textContent = user.email || '';

    // stash the current name for editing
    nameInput.value = nameSpan.textContent;

    rootLoading.style.display = 'none';
    rootContent.style.display = 'block';
  } catch (err) {
    rootLoading.textContent = 'Failed to load profile.';
    console.error(err);
    return;
  }

  // --- NAME EDIT FLOW ---

  editNameBtn.addEventListener('click', () => {
    clearMessages();

    nameInput.value = nameSpan.textContent;
    nameForm.style.display = 'block';

  });

  cancelNameBtn.addEventListener('click', () => {
    clearMessages();
    nameForm.style.display = 'none';
    // show row again if you hid it
  });

  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();

    const newName = nameInput.value.trim();
    if (!newName) {
      showError('Nama tidak boleh kosong.');
      return;
    }

    // optimistic disable
    const saveBtn = nameForm.querySelector('.save-btn');
    saveBtn.disabled = true;

    try {
      const updateRes = await api.patch('/me', {
        full_name: newName
      });

      if (!updateRes || updateRes.ok === false) {
        showError(updateRes?.error?.message || 'Gagal memperbarui nama.');
        saveBtn.disabled = false;
        return;
      }

      // reflect new name
      nameSpan.textContent = newName;

      showSuccess('Nama berhasil diperbarui.');
      nameForm.style.display = 'none';
      saveBtn.disabled = false;
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan jaringan.');
      saveBtn.disabled = false;
    }
  });

  // --- PASSWORD CHANGE FLOW ---

  changePwBtn.addEventListener('click', () => {
    clearMessages();
    // toggle password form
    const visible = pwForm.style.display === 'block';
    pwForm.style.display = visible ? 'none' : 'block';

    // clear fields whenever opening
    if (!visible) {
      oldPwInput.value = '';
      newPwInput.value = '';
      newPwConfirmInput.value = '';
    }
  });

  cancelPwBtn.addEventListener('click', () => {
    clearMessages();
    pwForm.style.display = 'none';
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
    saveBtn.disabled = true;

    try {
      const pwRes = await api.patch('/profile/change-password', {
        old_password: oldPw,
        new_password: newPw
      });
      
      if (!pwRes || pwRes.ok === false) {
        showError(pwRes?.error?.message || 'Gagal mengganti password.');
        saveBtn.disabled = false;
        return;
      }

      showSuccess('Password berhasil diubah.');
      pwForm.style.display = 'none';
      saveBtn.disabled = false;
      oldPwInput.value = '';
      newPwInput.value = '';
      newPwConfirmInput.value = '';
    } catch (err) {
      console.error(err);
      showError('Terjadi kesalahan jaringan.');
      saveBtn.disabled = false;
    }
  });
})();
