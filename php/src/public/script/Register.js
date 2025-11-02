// /script/Register.js
// Full register flow with seller toko step (logo upload + Quill rich text)
// Quill is lazy-loaded using the exact pattern you provided.

import { api } from '/utils/api.js';

// --------------------------- CONSTS ---------------------------
const ICONS = {
  show: "/uploads/auth/eye-icon.png",
  hide: "/uploads/auth/closed-eye-icon.png",
};

const allow = await api.get('/register');
if (!allow || !allow.ok) {
  window.location.href = '/products';
}

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_STORE_DESC = 1000;

// --------------------------- STATE ---------------------------
let selectedRole = null; // 'buyer' | 'seller'
let storeQuill = null;

// --------------------------- ELEMENTS ---------------------------
// Steps
const stepRole   = document.getElementById('step-role');
const stepUser   = document.getElementById('step-user');
const stepStore  = document.getElementById('step-store');
const stepReview = document.getElementById('step-review');

// Role
const roleCards  = [...document.querySelectorAll('.role-card')];
const toStep2Btn = document.getElementById('toStep2');

// Navigation
const backToStep1Btn           = document.getElementById('backToStep1');
const toNextAfterUserBtn       = document.getElementById('toNextAfterUser');
const backToStep2Btn           = document.getElementById('backToStep2');
const backToStep2FromReviewBtn = document.getElementById('backToStep2FromReview');

// Submit
const submitSellerBtn = document.getElementById('submitSeller');
const submitBuyerBtn  = document.getElementById('submitBuyer');

// User fields
const fullNameInput        = document.getElementById('fullNameInput');
const emailInput           = document.getElementById('emailInput');
const passwordInput        = document.getElementById('passwordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');

// Error box
const errorBox = document.getElementById('errorBox');

// Review (buyer)
const summaryRoleEl    = document.getElementById('summaryRole');
const summaryNameEl    = document.getElementById('summaryName');
const summaryEmailEl   = document.getElementById('summaryEmail');
const summaryStoreEl   = document.getElementById('summaryStore');
const sellerSummaryRow = stepReview?.querySelector('.seller-only');

// Password reveal
const revealButtons = [...document.querySelectorAll('.reveal-btn')];

// Seller: logo + store fields
const uploadLogoBtn        = document.getElementById('uploadLogoBtn');
const removeLogoBtn        = document.getElementById('removeLogoBtn');
const logoDropArea         = document.getElementById('logoDropArea');
const storeLogoInput       = document.getElementById('storeLogoInput');
const logoPreviewContainer = document.getElementById('logoPreviewContainer');
const logoPlaceholder      = document.getElementById('logoPlaceholder');
const logoPreview          = document.getElementById('logoPreview');

const storeNameInput   = document.getElementById('storeNameInput');
const storeNameErrorEl = document.getElementById('storeNameError');

const storeDescErrorEl = document.getElementById('storeDescError');
const storeDescCountEl = document.getElementById('storeDescCount');
const hiddenStoreDesc  = document.getElementById('storeDescription');

// --------------------------- HELPERS ---------------------------
function showStep(whichStepEl) {
  [stepRole, stepUser, stepStore, stepReview].forEach(s => s.classList.remove('active'));
  whichStepEl.classList.add('active');
}

function showError(msg) {
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}
function clearError() {
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.style.display = 'none';
}

function fillReview() {
  if (!summaryRoleEl) return;
  summaryRoleEl.textContent  = selectedRole === 'seller' ? 'Penjual' : 'Pembeli';
  summaryNameEl.textContent  = fullNameInput.value.trim();
  summaryEmailEl.textContent = emailInput.value.trim();

  if (selectedRole === 'seller') {
    sellerSummaryRow.style.display = 'block';
    summaryStoreEl.textContent = storeNameInput?.value?.trim() || '';
  } else {
    sellerSummaryRow.style.display = 'none';
    summaryStoreEl.textContent = '';
  }
}

function validateBaseFields() {
  const fullName  = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;
  const confirm   = confirmPasswordInput ? confirmPasswordInput.value : '';

  if (!fullName || !email || !password || !confirm) {
    showError('Lengkapi semua data.');
    return false;
  }
  if (password !== confirm) {
    showError('Password dan konfirmasi password tidak sama.');
    return false;
  }
  return true;
}

// --------------------------- QUILL LOADER (YOUR PATTERN) ---------------------------
function loadQuillScript() {
  return new Promise((resolve, reject) => {
    // Check if Quill already exists
    if (window.Quill) {
      console.log('Quill already loaded');
      resolve();
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="quill.js"]')) {
      console.log('Quill script already in DOM, waiting...');
      const checkQuill = setInterval(() => {
        if (window.Quill) {
          clearInterval(checkQuill);
          resolve();
        }
      }, 100);
      return;
    }

    console.log('Loading Quill script...');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js';
    script.onload = () => {
      console.log('Quill script loaded');
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load Quill script');
      reject(new Error('Failed to load Quill'));
    };
    document.head.appendChild(script);
  });
}

// Initialize Quill Editor for seller toko
async function initStoreQuillEditor() {
  try {
    await loadQuillScript();

    const editorElement = document.getElementById('storeEditor');
    if (!editorElement) {
      console.error('storeEditor element not found');
      return;
    }

    console.log('Initializing Quill editor for store...');
    storeQuill = new Quill('#storeEditor', {
      theme: 'snow',
      placeholder: 'Tulis deskripsi toko (maksimal 1000 karakter)...'
    });
    console.log('Quill editor initialized!');

    // Character counter + sync hidden textarea
    storeQuill.on('text-change', function () {
      const text = storeQuill.getText();
      const length = text.trim().length;

      if (storeDescCountEl) storeDescCountEl.textContent = length;
      if (hiddenStoreDesc) hiddenStoreDesc.value = storeQuill.root.innerHTML;

      if (storeDescErrorEl) {
        storeDescErrorEl.textContent = length > MAX_STORE_DESC
          ? `Maksimal ${MAX_STORE_DESC} karakter`
          : '';
      }
    });

  } catch (error) {
    console.error('Error initializing Quill (store):', error);
  }
}

// --------------------------- IMAGE (FileReader) ---------------------------
function bindLogoUpload() {
  function openPicker() { storeLogoInput?.click(); }

  uploadLogoBtn?.addEventListener('click', openPicker);
  logoDropArea?.addEventListener('click', openPicker);

  // drag + drop
  ['dragenter', 'dragover'].forEach(evt => {
    logoDropArea?.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      logoDropArea.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    logoDropArea?.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      logoDropArea.classList.remove('drag-over');
    });
  });
  logoDropArea?.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleLogoFile(file);
  });

  storeLogoInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleLogoFile(file);
  });

  removeLogoBtn?.addEventListener('click', () => {
    storeLogoInput.value = '';
    logoPreview.src = '';
    logoPreviewContainer.style.display = 'none';
    logoPlaceholder.style.display = 'flex';
    removeLogoBtn.style.display = 'none';
    uploadLogoBtn.textContent = 'Unggah Logo';
  });
}

function handleLogoFile(file) {
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    showError('Format file tidak valid! Gunakan JPG, PNG, atau WEBP.');
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showError('Ukuran file terlalu besar! Maksimal 2MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    logoPreview.src = event.target.result;
    logoPlaceholder.style.display = 'none';
    logoPreviewContainer.style.display = 'flex';
    removeLogoBtn.style.display = 'inline-flex';
    uploadLogoBtn.textContent = 'Ganti Logo';
  };
  reader.readAsDataURL(file);
}

// --------------------------- PASSWORD REVEAL (image toggle) ---------------------------
function bindPasswordReveal() {
  revealButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.input-wrap');
      if (!wrap) return;

      const input = wrap.querySelector('input');
      const img   = btn.querySelector('img.eye-icon');
      if (!input || !img) return;

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';

      img.src = isHidden ? ICONS.hide : ICONS.show;
      btn.setAttribute('aria-pressed', String(isHidden));
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
}

// --------------------------- VALIDATION ---------------------------
function validateSellerFields() {
  let ok = true;
  if (storeNameErrorEl) storeNameErrorEl.textContent = '';
  if (storeDescErrorEl) storeDescErrorEl.textContent = '';

  const name = storeNameInput.value.trim();
  if (!name) {
    storeNameErrorEl.textContent = 'Nama toko wajib diisi';
    ok = false;
  } else if (name.length > 100) {
    storeNameErrorEl.textContent = 'Maksimal 100 karakter';
    ok = false;
  }

  const plain = (storeQuill?.getText() || '').trim();
  if (!plain) {
    storeDescErrorEl.textContent = 'Deskripsi toko wajib diisi';
    ok = false;
  } else if (plain.length > MAX_STORE_DESC) {
    storeDescErrorEl.textContent = `Maksimal ${MAX_STORE_DESC} karakter`;
    ok = false;
  }

  const logoFile = storeLogoInput?.files?.[0];
  if (!logoFile) {
    showError('Logo toko wajib diunggah!');
    ok = false;
  }

  return ok;
}

// --------------------------- SUBMITS ---------------------------
async function submitBuyer() {
  clearError();
  if (!validateBaseFields()) return;

  const full_name = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;

  const res = await api.post('/register', { full_name, email, password, role: 'buyer' });
  if (!res || res.ok === false) {
    showError(res?.error?.message || 'Pendaftaran gagal');
    return;
  }
  window.location.href = '/products';
}

async function submitSeller() {
  clearError();
  if (!validateBaseFields()) return;
  if (!validateSellerFields()) return;

  // Build FormData
  const fd = new FormData();
  fd.set('full_name', fullNameInput.value.trim());
  fd.set('email', emailInput.value.trim());
  fd.set('password', passwordInput.value);
  fd.set('role', 'seller');

  fd.set('store_name', storeNameInput.value.trim());
  fd.set('store_description', storeQuill.root.innerHTML);

  const logoFile = storeLogoInput.files[0];
  if (logoFile) fd.set('store_logo', logoFile);

  const res = await api.post('/register', fd);
  if (!res || res.ok === false) {
    showError(res?.error?.message || 'Pendaftaran gagal');
    return;
  }
  
  window.location.href = '/seller/dashboard';
}

// --------------------------- INIT ---------------------------
function selectRole(role) {
  selectedRole = role;
  roleCards.forEach(btn => btn.classList.toggle('active', btn.dataset.role === role));
  toStep2Btn.disabled = false;
}

function bindRolePick() {
  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      selectRole(card.dataset.role);
    });
  });
  selectRole('buyer'); // default
}

function bindNav() {
  toStep2Btn.addEventListener('click', () => {
    if (!selectedRole) return;
    clearError();
    showStep(stepUser);
  });

  backToStep1Btn.addEventListener('click', () => {
    clearError();
    showStep(stepRole);
  });

  toNextAfterUserBtn.addEventListener('click', async () => {
    clearError();
    if (!validateBaseFields()) return;

    if (selectedRole === 'seller') {
      try {
        if (!storeQuill) {
          await initStoreQuillEditor();   // lazy-load Quill here
        }
      } catch (e) {
        console.error('Quill failed to load:', e);
        showError('Editor deskripsi toko tidak bisa dimuat. Coba lagi.');
      }
      showStep(stepStore);
    } else {
      fillReview();
      showStep(stepReview);
    }
  });

  backToStep2Btn.addEventListener('click', () => {
    clearError();
    showStep(stepUser);
  });

  backToStep2FromReviewBtn.addEventListener('click', () => {
    clearError();
    showStep(stepUser);
  });

  submitBuyerBtn.addEventListener('click', submitBuyer);
  submitSellerBtn.addEventListener('click', submitSeller);
}

// Bootstrap
(function initRegisterPage() {
  bindRolePick();
  bindNav();
  bindPasswordReveal();
  bindLogoUpload();
})();
