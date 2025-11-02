import { api } from "/utils/api.js";
import { checkAlreadyLoggedIn } from "/utils/loginRedirect.js";

checkAlreadyLoggedIn();

const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPassInput = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
const loginErrorBox = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");

const ICONS = {
  show: "/uploads/auth/eye-icon.png",
  hide: "/uploads/auth/closed-eye-icon.png",
};

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
  eyeIcon.src = isHidden ? ICONS.hide : ICONS.show;
  togglePassword.setAttribute("aria-pressed", String(isHidden));
  togglePassword.setAttribute("aria-label", isHidden ? "hide" : "show");
});

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

  loginSubmitBtn.disabled = true;

  try {
    const res = await api.post("/login", {
      email,
      password,
    });

    if (!res || res.ok === false) {
      showError(
        res?.error?.message || "Login gagal. Periksa email / password.",
      );
      loginSubmitBtn.disabled = false;
      return;
    }

    window.location.href = "/products";
  } catch (err) {
    showError("Terjadi kesalahan jaringan.");
    loginSubmitBtn.disabled = false;
  }
});
