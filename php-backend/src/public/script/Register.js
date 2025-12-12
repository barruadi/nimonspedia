// /script/Register.js
// Full register flow with seller toko step (logo upload + Quill rich text)
// Quill is lazy-loaded using the exact pattern you provided.

import { api } from '/utils/api.js';
import { checkAlreadyLoggedIn } from '/utils/loginRedirect.js';

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

checkAlreadyLoggedIn();


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
const addressInput         = document.getElementById('address');

// Password criteria elements (register)
const rpLength = document.getElementById('rp-length');
const rpUpper = document.getElementById('rp-upper');
const rpLower = document.getElementById('rp-lower');
const rpNumber = document.getElementById('rp-number');
const rpSymbol = document.getElementById('rp-symbol');

// Field error elements
const fullNameError = document.getElementById('fullNameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const addressError = document.getElementById('addressError');

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

function clearAllErrors() {
  if (fullNameError) fullNameError.textContent = '';
  if (emailError) emailError.textContent = '';
  if (passwordError) passwordError.textContent = '';
  if (confirmPasswordError) confirmPasswordError.textContent = '';
  if (addressError) addressError.textContent = '';
  if (storeNameErrorEl) storeNameErrorEl.textContent = '';
  if (storeDescErrorEl) storeDescErrorEl.textContent = '';
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
  clearAllErrors();
  let isValid = true;

  const fullName  = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;
  const confirm   = confirmPasswordInput ? confirmPasswordInput.value : '';
  const address   = addressInput.value.trim();

  if (!fullName) {
    fullNameError.textContent = 'Nama wajib diisi';
    isValid = false;
  } else if (fullName.length > 200) {
    fullNameError.textContent = 'Maksimal 200 karakter';
    isValid = false;
  }

  if (!email) {
    emailError.textContent = 'Email wajib diisi';
    isValid = false;
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      emailError.textContent = 'Format email tidak valid';
      isValid = false;
    }
  }

  if (!password) {
    passwordError.textContent = 'Password wajib diisi';
    isValid = false;
  } else {
    const policy = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password),
    };

    const passwordErrors = [];
    if (!policy.length) passwordErrors.push('min 8 karakter');
    if (!policy.upper) passwordErrors.push('huruf besar');
    if (!policy.lower) passwordErrors.push('huruf kecil');
    if (!policy.number) passwordErrors.push('angka');
    if (!policy.symbol) passwordErrors.push('simbol');

    if (passwordErrors.length > 0) {
      passwordError.textContent = 'Perlu: ' + passwordErrors.join(', ');
      isValid = false;
    }
  }

  if (!confirm) {
    confirmPasswordError.textContent = 'Konfirmasi password wajib diisi';
    isValid = false;
  } else if (password !== confirm) {
    confirmPasswordError.textContent = 'Password tidak sama';
    isValid = false;
  }

  if (!address) {
    addressError.textContent = 'Alamat wajib diisi';
    isValid = false;
  }

  return isValid;
}

function updateRegisterPasswordCriteria(password) {
  const s = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
  if (rpLength) {
    rpLength.classList.toggle('valid', s.length);
    rpLength.classList.toggle('invalid', !s.length);
  }
  if (rpUpper) {
    rpUpper.classList.toggle('valid', s.upper);
    rpUpper.classList.toggle('invalid', !s.upper);
  }
  if (rpLower) {
    rpLower.classList.toggle('valid', s.lower);
    rpLower.classList.toggle('invalid', !s.lower);
  }
  if (rpNumber) {
    rpNumber.classList.toggle('valid', s.number);
    rpNumber.classList.toggle('invalid', !s.number);
  }
  if (rpSymbol) {
    rpSymbol.classList.toggle('valid', s.symbol);
    rpSymbol.classList.toggle('invalid', !s.symbol);
  }
}

// simple loading helper for buttons
function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.origText = btn.textContent;
    btn.textContent = 'Memuat...';
    btn.disabled = true;
    btn.classList.add('loading');
  } else {
    if (btn.dataset.origText) btn.textContent = btn.dataset.origText;
    btn.disabled = false;
    btn.classList.remove('loading');
  }
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
  if (storeNameErrorEl) storeNameErrorEl.textContent = '';

  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    if (storeNameErrorEl) storeNameErrorEl.textContent = 'Format tidak valid. Gunakan JPG, PNG, atau WEBP';
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    if (storeNameErrorEl) storeNameErrorEl.textContent = 'Ukuran file terlalu besar. Maksimal 2MB';
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
    storeNameErrorEl.textContent = 'Logo toko wajib diunggah';
    ok = false;
  } else if (!VALID_IMAGE_TYPES.includes(logoFile.type)) {
    storeNameErrorEl.textContent = 'Format tidak valid. Gunakan JPG, PNG, atau WEBP';
    ok = false;
  } else if (logoFile.size > MAX_IMAGE_SIZE) {
    storeNameErrorEl.textContent = 'Ukuran terlalu besar. Maksimal 2MB';
    ok = false;
  }

  return ok;
}

// --------------------------- SUBMITS ---------------------------
async function submitBuyer() {
  if (!validateBaseFields()) return;

  const full_name = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;
  const address   = addressInput.value.trim();

  setButtonLoading(submitBuyerBtn, true);
  await new Promise(r => setTimeout(r, 700));

  const res = await api.post('/register', {
    full_name,
    email,
    password,
    address,
    role: 'buyer'
  });

  if (!res || res.ok === false) {
    setButtonLoading(submitBuyerBtn, false);
    const errorMsg = res?.error || 'Pendaftaran gagal, silakan coba lagi';
    if (errorMsg.includes('Email sudah terdaftar') || errorMsg.includes('email')) {
      emailError.textContent = errorMsg;
    } else if (errorMsg.includes('Password') || errorMsg.includes('password')) {
      passwordError.textContent = errorMsg;
    } else if (errorMsg.includes('Nama')) {
      fullNameError.textContent = errorMsg;
    } else if (errorMsg.includes('Alamat')) {
      addressError.textContent = errorMsg;
    } else {
      emailError.textContent = errorMsg;
    }
    return;
  }

  window.location.href = '/products';
}

async function submitSeller() {
  if (!validateBaseFields()) return;
  if (!validateSellerFields()) return;

  const fd = new FormData();
  fd.set('full_name', fullNameInput.value.trim());
  fd.set('email', emailInput.value.trim());
  fd.set('password', passwordInput.value);
  fd.set('address', addressInput.value.trim());
  fd.set('role', 'seller');

  fd.set('store_name', storeNameInput.value.trim());
  fd.set('store_description', storeQuill.root.innerHTML);

  const logoFile = storeLogoInput.files[0];
  if (logoFile) fd.set('store_logo', logoFile);

  setButtonLoading(submitSellerBtn, true);
  await new Promise(r => setTimeout(r, 700));

  const res = await api.post('/register', fd);

  if (!res || res.ok === false) {
    setButtonLoading(submitSellerBtn, false);
    const errorMsg = res?.error || 'Pendaftaran gagal, silakan coba lagi';
    if (errorMsg.includes('Email sudah terdaftar') || errorMsg.includes('email')) {
      emailError.textContent = errorMsg;
    } else if (errorMsg.includes('Password') || errorMsg.includes('password')) {
      passwordError.textContent = errorMsg;
    } else if (errorMsg.includes('Nama toko') || errorMsg.includes('store')) {
      storeNameErrorEl.textContent = errorMsg;
    } else if (errorMsg.includes('Deskripsi toko')) {
      storeDescErrorEl.textContent = errorMsg;
    } else if (errorMsg.includes('Logo')) {
      storeNameErrorEl.textContent = errorMsg;
    } else if (errorMsg.includes('Nama')) {
      fullNameError.textContent = errorMsg;
    } else if (errorMsg.includes('Alamat')) {
      addressError.textContent = errorMsg;
    } else {
      emailError.textContent = errorMsg;
    }
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
    clearAllErrors();
    showStep(stepUser);
  });

  backToStep1Btn.addEventListener('click', () => {
    clearAllErrors();
    showStep(stepRole);
  });

  toNextAfterUserBtn.addEventListener('click', async () => {
    if (!validateBaseFields()) return;

    const email = emailInput.value.trim();
    setButtonLoading(toNextAfterUserBtn, true);

    try {
      const checkRes = await api.post('/register/check-email', { email });
      setButtonLoading(toNextAfterUserBtn, false);

      if (!checkRes || checkRes.ok === false) {
        const errorMsg = checkRes?.error || 'Email sudah terpakai';
        emailError.textContent = errorMsg;
        return;
      }

      if (selectedRole === 'seller') {
        try {
          if (!storeQuill) {
            await initStoreQuillEditor();
          }
        } catch (e) {
          console.error('Quill failed to load:', e);
          storeNameErrorEl.textContent = 'Editor tidak bisa dimuat. Coba lagi.';
          return;
        }
        showStep(stepStore);
      } else {
        fillReview();
        showStep(stepReview);
      }
    } catch (err) {
      setButtonLoading(toNextAfterUserBtn, false);
      emailError.textContent = 'Gagal memeriksa email. Coba lagi.';
    }
  });

  backToStep2Btn.addEventListener('click', () => {
    clearAllErrors();
    showStep(stepUser);
  });

  backToStep2FromReviewBtn.addEventListener('click', () => {
    clearAllErrors();
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
  // live update password criteria while typing
  passwordInput?.addEventListener('input', (e) => updateRegisterPasswordCriteria(e.target.value || ''));
})();
