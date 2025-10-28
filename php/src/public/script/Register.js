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

const fullNameInput     = document.getElementById('fullNameInput');
const emailInput        = document.getElementById('emailInput');
const passwordInput     = document.getElementById('passwordInput');
const storeNameInput    = document.getElementById('storeNameInput');

const errorBox          = document.getElementById('errorBox');

const summaryRoleEl     = document.getElementById('summaryRole');
const summaryNameEl     = document.getElementById('summaryName');
const summaryEmailEl    = document.getElementById('summaryEmail');
const summaryStoreEl    = document.getElementById('summaryStore');
const sellerSummaryRow  = stepReview.querySelector('.seller-only');

// --- HELPERS ---
function showStep(which) {
  [stepRole, stepUser, stepStore, stepReview].forEach(s => {
    s.classList.remove('active');
  });
  which.classList.add('active');
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

async function submitBuyer() {
  clearError();
  const full_name  = fullNameInput.value.trim();
  const email      = emailInput.value.trim();
  const password   = passwordInput.value;

  const res = await api.post('/register', {
    full_name,
    email,
    password,
    role: 'buyer'
  });
  
  console.log(res);

  if (!res || res.ok === false) {
    showError(res?.error?.message || 'Pendaftaran gagal');
    return;
  }

  // redirect buyer
  window.location.href = '/home';
}

async function submitSeller() {
  clearError();
  const full_name  = fullNameInput.value.trim();
  const email      = emailInput.value.trim();
  const password   = passwordInput.value;
  const store_name = storeNameInput.value.trim();

  if (!store_name) {
    showError('Nama toko wajib diisi untuk penjual.');
    return;
  }

  const res = await api.post('/register', {
    full_name,
    email,
    password,
    role: 'seller',
    store_name,
  });

  if (!res || res.ok === false) {
    showError(res?.error?.message || 'Pendaftaran gagal');
    return;
  }

  // redirect seller
  window.location.href = '/home';
}

// --- STEP 1: ROLE PICK ---
roleCards.forEach(card => {
  card.addEventListener('click', () => {
    console.log('[wizard] role clicked:', card.dataset.role);

    selectedRole = card.dataset.role; // 'buyer' | 'seller'

    // visual active state
    roleCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    // enable next
    toStep2Btn.disabled = false;
  });
});

toStep2Btn.addEventListener('click', () => {
  if (!selectedRole) return;
  clearError();
  showStep(stepUser);
});

// --- STEP 2: USER INFO ---
backToStep1Btn.addEventListener('click', () => {
  showStep(stepRole);
});

toNextAfterUserBtn.addEventListener('click', () => {
  clearError();

  const fullName  = fullNameInput.value.trim();
  const email     = emailInput.value.trim();
  const password  = passwordInput.value;

  if (!fullName || !email || !password) {
    showError('Lengkapi semua data.');
    return;
  }

  if (selectedRole === 'seller') {
    // seller must fill store name next
    showStep(stepStore);
  } else {
    // buyer goes to review
    fillReview();
    showStep(stepReview);
  }
});

// --- STEP 3: STORE NAME (seller only) ---
backToStep2Btn.addEventListener('click', () => {
  clearError();
  showStep(stepUser);
});

submitSellerBtn.addEventListener('click', async () => {
  await submitSeller();
});

// --- STEP 4: REVIEW (buyer only) ---
backToStep2FromReviewBtn.addEventListener('click', () => {
  clearError();
  showStep(stepUser);
});

submitBuyerBtn.addEventListener('click', async () => {
  await submitBuyer();
});
