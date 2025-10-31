import { api } from "/utils/api.js";

const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPassInput = document.getElementById("loginPassword");
const togglePassword = document.getElementById("togglePassword");
const loginErrorBox = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");

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
  togglePassword.textContent = isHidden ? "hide" : "show";
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

  // optimistic disable button to prevent double submit
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

    // login success -> go home (or dashboard)
    window.location.href = "/home";
  } catch (err) {
    showError("Terjadi kesalahan jaringan.");
    loginSubmitBtn.disabled = false;
  }
});
