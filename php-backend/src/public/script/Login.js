import { api } from "/utils/api.js";
import { checkAlreadyLoggedIn } from "/utils/loginRedirect.js";

checkAlreadyLoggedIn();

const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPassInput = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const eyeIcon = document.getElementById('eyeIcon');

const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

const ICONS = {
  show: "/uploads/auth/eye-icon.png",
  hide: "/uploads/auth/closed-eye-icon.png",
};

const allow = await api.get('/login');
if (!allow || !allow.ok) {
  window.location.href = '/products';
}

function clearAllErrors() {
  if (emailError) emailError.textContent = '';
  if (passwordError) passwordError.textContent = '';
}

togglePassword.addEventListener("click", () => {
  const isHidden = loginPassInput.type === "password";
  loginPassInput.type = isHidden ? "text" : "password";
  if (eyeIcon) eyeIcon.src = isHidden ? ICONS.hide : ICONS.show;
  togglePassword.setAttribute("aria-pressed", String(isHidden));
  togglePassword.setAttribute("aria-label", isHidden ? "hide" : "show");
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

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAllErrors();

  const email = loginEmailInput.value.trim();
  const password = loginPassInput.value;

  if (!email) {
    emailError.textContent = 'Email wajib diisi';
    return;
  }

  if (!password) {
    passwordError.textContent = 'Password wajib diisi';
    return;
  }

  loginSubmitBtn.disabled = true;
  setButtonLoading(loginSubmitBtn, true);
  await new Promise(r => setTimeout(r, 700));

  try {
    const res = await api.post("/login", {
      email,
      password,
    });

    if (!res || res.ok === false) {
      setButtonLoading(loginSubmitBtn, false);
      const errorMsg = res?.error || 'Login gagal';
      if (errorMsg.includes('Email tidak terdaftar') || errorMsg.includes('email')) {
        emailError.textContent = errorMsg;
      } else if (errorMsg.includes('Password salah') || errorMsg.includes('password')) {
        passwordError.textContent = errorMsg;
      } else {
        emailError.textContent = errorMsg;
      }
      return;
    }

    window.location.href = "/products";
  } catch (err) {
    setButtonLoading(loginSubmitBtn, false);
    emailError.textContent = 'Terjadi kesalahan jaringan';
  }
});
