import { api } from "/utils/api.js";

const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPassInput = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
const loginErrorBox = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const eyeIcon = document.getElementById('eyeIcon');

// password criteria elements
const lpLength = document.getElementById('lp-length');
const lpUpper = document.getElementById('lp-upper');
const lpLower = document.getElementById('lp-lower');
const lpNumber = document.getElementById('lp-number');
const lpSymbol = document.getElementById('lp-symbol');

const ICONS = {
  show: "/uploads/auth/eye-icon.png",
  hide: "/uploads/auth/closed-eye-icon.png",
};

const allow = await api.get('/login');
if (!allow || !allow.ok) {
  window.location.href = '/products';
}

function showError(msg) {
  loginErrorBox.textContent = msg;
  loginErrorBox.style.display = "block";
}

function clearError() {
  loginErrorBox.textContent = "";
  loginErrorBox.style.display = "none";
}

togglePassword.addEventListener("click", () => {
  const isHidden = loginPassInput.type === "password";
  loginPassInput.type = isHidden ? "text" : "password";
  if (eyeIcon) eyeIcon.src = isHidden ? ICONS.hide : ICONS.show;
  togglePassword.setAttribute("aria-pressed", String(isHidden));
  togglePassword.setAttribute("aria-label", isHidden ? "hide" : "show");
});

// Password policy helpers
function getPasswordPolicy(password) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

function updateLoginPasswordCriteria(password) {
  const s = getPasswordPolicy(password);
  if (lpLength) { lpLength.classList.toggle('valid', s.length); lpLength.classList.toggle('invalid', !s.length); }
  if (lpUpper)  { lpUpper.classList.toggle('valid', s.upper); lpUpper.classList.toggle('invalid', !s.upper); }
  if (lpLower)  { lpLower.classList.toggle('valid', s.lower); lpLower.classList.toggle('invalid', !s.lower); }
  if (lpNumber) { lpNumber.classList.toggle('valid', s.number); lpNumber.classList.toggle('invalid', !s.number); }
  if (lpSymbol) { lpSymbol.classList.toggle('valid', s.symbol); lpSymbol.classList.toggle('invalid', !s.symbol); }
}

loginPassInput.addEventListener('input', (e) => {
  updateLoginPasswordCriteria(e.target.value || '');
});

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

// handle form submit
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const email = loginEmailInput.value.trim();
  const password = loginPassInput.value;

  if (!email || !password) {
    showError("Email dan password wajib diisi.");
    return;
  }

  // enforce password policy on client-side
  const policy = getPasswordPolicy(password);
  const allOk = policy.length && policy.upper && policy.lower && policy.number && policy.symbol;
  if (!allOk) {
    showError('Password tidak memenuhi persyaratan.');
    return;
  }

  loginSubmitBtn.disabled = true;
  setButtonLoading(loginSubmitBtn, true);
  // small UX delay to show loading state
  await new Promise(r => setTimeout(r, 700));

  try {
    const res = await api.post("/login", {
      email,
      password,
    });

    if (!res || res.ok === false) {
      showError(
        res?.error?.message || "Login gagal. Periksa email / password.",
      );
      setButtonLoading(loginSubmitBtn, false);
      return;
    }

    window.location.href = "/products";
  } catch (err) {
    showError("Terjadi kesalahan jaringan.");
    setButtonLoading(loginSubmitBtn, false);
  }
});
