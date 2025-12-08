import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminLogin.css';

const API_BASE = 'http://localhost/api/node/admin';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      
      if (token) {
        try {
          const response = await fetch(`${API_BASE}/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          const data = await response.json();

          if (response.ok && data.ok) {
            navigate('/admin/dashboard');
          }
        } catch {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
        }
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error('Server tidak merespons dengan benar. Pastikan server sedang berjalan.');
      }

      if (!response.ok) {
        if (response.status === 401) {
          setPasswordError('Email atau password salah. Silakan coba lagi.');
        } else if (response.status === 400) {
          setEmailError('Email dan password harus diisi.');
        } else if (response.status === 404) {
          setPasswordError('Endpoint tidak ditemukan. Periksa konfigurasi server.');
        } else {
          setPasswordError(data.error?.message || 'Terjadi kesalahan saat login.');
        }
        return;
      }

      if (!data.ok) {
        setPasswordError(data.error?.message || 'Login gagal.');
        return;
      }

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminUser', JSON.stringify(data.user));

      navigate('/admin/dashboard');
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setPasswordError('Tidak dapat terhubung ke server. Pastikan server sedang berjalan.');
      } else {
        setPasswordError(err.message || 'Terjadi kesalahan yang tidak terduga.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-left">
        <div className="illustration">
          <img
            src="http://localhost/uploads/auth/login-art.png"
            alt="Admin illustration"
            className="hero-img"
          />
        </div>

        <div className="left-copy">
          <h2 className="left-headline">
            Panel Admin <span className="brand">Nimonspedia</span>
          </h2>
          <p className="left-sub">
            Kelola platform dengan mudah dan efisien
          </p>
        </div>
      </section>

      <section className="login-card">
        <header className="login-header">
          <h1 className="login-title">Admin Login</h1>
          <p className="login-sub">
            Akses khusus untuk administrator Nimonspedia
          </p>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label>Email*</label>
            <div className="input-wrap">
              <input
                id="loginEmail"
                name="email"
                type="email"
                placeholder="Masukkan email admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <span className="field-error" id="emailError">{emailError}</span>
          </div>

          <div className="field">
            <label>Password*</label>
            <div className="input-wrap with-icon">
              <input
                id="loginPassword"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="reveal-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <img
                  id="eyeIcon"
                  src={`http://localhost/uploads/auth/${showPassword ? 'closed-eye-icon.png' : 'eye-icon.png'}`}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            </div>
            <span className="field-error" id="passwordError">{passwordError}</span>
          </div>

          <button
            id="loginSubmitBtn"
            type="submit"
            className="primary-btn"
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <footer className="page-footer">
          Akses tidak sah akan dilaporkan kepada administrator
        </footer>
      </section>
    </main>
  );
};

export default AdminLogin;
