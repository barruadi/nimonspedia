import { api } from '/utils/api.js';

// --- STATE ---
let selectedRole = null; // 'buyer' | 'seller'

// --- ELEMENTS ---
const stepRole   = document.getElementById('step-role');
const stepUser   = document.getElementById('step-user');
const stepStore  = document.getElementById('step-store');
const stepReview = document.getElementById('step-review');

const roleCards  = [...document.querySelectorAll('.role-card')];
const toStep2Btn = document.getElementById('toStep2');

const backToStep1Btn           = document.getElementById('backToStep1');
const toNextAfterUserBtn       = document.getElementById('toNextAfterUser');

const backToStep2Btn           = document.getElementById('backToStep2');
const backToStep2FromReviewBtn = document.getElementById('backToStep2FromReview');

const submitSellerBtn          = document.getElementById('submitSeller');
const submitBuyerBtn           = document.getElementById('submitBuyer');

// inputs
const fullNameInput        = document.getElementById('fullNameInput');
const emailInput           = document.getElementById('emailInput');
const passwordInput        = document.getElementById('passwordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const storeNameInput       = document.getElementById('storeNameInput');

// error box
const errorBox = document.getElementById('errorBox');

// review summary elements
const summaryRoleEl    = document.getElementById('summaryRole');
const summaryNameEl    = document.getElementById('summaryName');
const summaryEmailEl   = document.getElementById('summaryEmail');
const summaryStoreEl   = document.getElementById('summaryStore');
const sellerSummaryRow = stepReview.querySelector('.seller-only');

// password reveal buttons
const revealButtons = [...document.querySelectorAll('.reveal-btn')];

// --- HELPERS ---
function showStep(whichStepEl) {
  [stepRole, stepUser, stepStore, stepReview].forEach(s => {
    s.classList.remove('active');
  });
  whichStepEl.classList.add('active');
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

function clearError() {
  errorBox.textContent = '';
  errorBox.style.display = 'none';
}

function fillReview(storeNameVal = '') {
  summaryRoleEl.textContent  = selectedRole === 'seller' ? 'Penjual' : 'Pembeli';
  summaryNameEl.textContent  = fullNameInput.value.trim();
  summaryEmailEl.textContent = emailInput.value.trim();

  if (selectedRole === 'seller') {
    sellerSummaryRow.style.display = 'block';
    summaryStoreEl.textContent = storeNameVal || storeNameInput.value.trim();
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

// --- SUBMIT CALLS ---
async function submitBuyer() {
  clearError();
  if (!validateBaseFields()) return;

  const full_name = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;

  const res = await api.post('/register', {
    full_name,
    email,
    password,
    role: 'buyer'
  });

  if (!res || res.ok === false) {
    showError(res?.error?.message || 'Pendaftaran gagal');
    return;
  }

  window.location.href = '/home';
}

async function submitSeller() {
  clearError();
  if (!validateBaseFields()) return;

  const store_name = storeNameInput.value.trim();
  if (!store_name) {
    showError('Nama toko wajib diisi untuk penjual.');
    return;
  }

  const full_name = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;

  const res = await api.post('/register', {
    full_name,
    email,
    password,
    role: 'seller',
    store_name
  });

  if (!res || res.ok === false) {
    showError(res?.error?.message || 'Pendaftaran gagal');
    return;
  }

  window.location.href = '/home';
}

// --- ROLE PICK LOGIC ---
function selectRole(role) {
  selectedRole = role;

  roleCards.forEach(btn => {
    if (btn.dataset.role === role) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  toStep2Btn.disabled = false;
}

// set default
selectRole('buyer');

roleCards.forEach(card => {
  card.addEventListener('click', () => {
    const role = card.dataset.role;
    selectRole(role);
  });
});

toStep2Btn.addEventListener('click', () => {
  if (!selectedRole) return;
  clearError();
  showStep(stepUser);
});

// --- STEP NAV ---
backToStep1Btn.addEventListener('click', () => {
  clearError();
  showStep(stepRole);
});

toNextAfterUserBtn.addEventListener('click', () => {
  clearError();

  if (!validateBaseFields()) return;

  if (selectedRole === 'seller') {
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

submitSellerBtn.addEventListener('click', async () => {
  await submitSeller();
});

backToStep2FromReviewBtn.addEventListener('click', () => {
  clearError();
  showStep(stepUser);
});

submitBuyerBtn.addEventListener('click', async () => {
  await submitBuyer();
});

// --- PASSWORD REVEAL ---
revealButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const wrap = btn.closest('.input-wrap');
    if (!wrap) return;

    const input = wrap.querySelector('input');
    const icon  = btn.querySelector('.eye-icon');
    if (!input || !icon) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    if (isHidden) {
      icon.classList.add('hidden-eye');
    } else {
      icon.classList.remove('hidden-eye');
    }
  });
});
