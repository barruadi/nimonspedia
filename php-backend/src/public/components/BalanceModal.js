import { api } from '/utils/api.js';

// Impor fungsi notifikasi dari Navbar.js
import { notifyAuthChanged } from '/components/Navbar.js';

class BalanceModal extends HTMLElement {
  constructor() {
    super();
    this.currentBalance = 0;
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  static formatCurrency(amount) {
    return `Rp ${parseInt(amount, 10).toLocaleString("id-ID")}`;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/styles/BalanceModal.css">
      <div id="topUpModal" class="balance-modal-backdrop">
        <div class="balance-modal" role="dialog" aria-modal="true">
          <img src="/uploads/balance/balance.png" alt="Balance" class="modal-icon">
          <h3 class="modal-title">Top Up Balance</h3>
          
          <form id="topUpForm" class="modal-form">
            <label class="modal-label">
              <span>Jumlah top up*</span>
              <input type="number" id="topUpAmount" class="modal-input" placeholder="Jumlah top up (minimal Rp 1.000)" min="1000" step="1000" required>
            </label>
            
            <p id="topUpInfo" class="modal-info-text"></p>
            <p id="topUpError" class="modal-error-text"></p>
            
            <div class="modal-buttons">
              <button type="button" id="cancelTopUpBtn" class="btn-modal-cancel">Batal</button>
              <button type="submit" id="confirmTopUpBtn" class="btn-modal-confirm">Top Up</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  connectedCallback() {
    // Cache DOM elements
    this.modal = this.shadowRoot.getElementById('topUpModal');
    this.form = this.shadowRoot.getElementById('topUpForm');
    this.amountInput = this.shadowRoot.getElementById('topUpAmount');
    this.infoText = this.shadowRoot.getElementById('topUpInfo');
    this.errorText = this.shadowRoot.getElementById('topUpError');
    this.confirmBtn = this.shadowRoot.getElementById('confirmTopUpBtn');

    // Attach listeners
    this.shadowRoot.getElementById('cancelTopUpBtn').addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.amountInput.addEventListener('input', () => this.updateInfoText());

    // Dengarkan event global untuk membuka modal
    window.addEventListener('open-top-up-modal', () => this.open());
  }
  
  open() {
    const navbar = document.querySelector('app-navbar');
    this.currentBalance = navbar?._session?.user?.balance || 0;
    
    this.amountInput.value = '';
    this.errorText.textContent = '';
    this.updateInfoText();
    
    this.modal.classList.add('is-open');
    this.amountInput.focus();
  }

  close() {
    this.modal.classList.remove('is-open');
  }

  updateInfoText() {
    const amount = parseInt(this.amountInput.value, 10) || 0;
    const newTotal = this.currentBalance + amount;
    this.infoText.innerHTML = `Saldo setelah top up: <strong>${BalanceModal.formatCurrency(newTotal)}</strong>`;
  }

  async handleSubmit(e) {
    e.preventDefault();
    const amount = parseInt(this.amountInput.value, 10) || 0;

    if (amount < 10000) {
      this.errorText.textContent = 'Minimum top up adalah Rp 10.000';
      return;
    }

    if (amount > 10000000) {
      this.errorText.textContent = 'Maximum top up adalah Rp 10.000.000';
      return;
    }

    this.confirmBtn.disabled = true;
    this.confirmBtn.textContent = 'Memproses...';
    this.errorText.textContent = '';

    try {
      // Call direct top-up endpoint
      const res = await fetch('http://localhost/api/profile/top-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ amount })
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Top up gagal');
      }

      // Close modal
      this.close();

      // Refresh balance
      await this.refreshBalance();

      // Show success message
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: `Top up berhasil! Saldo baru: Rp ${parseInt(data.data.new_balance).toLocaleString('id-ID')}`,
          type: 'success'
        }
      }))

    } catch (err) {
      this.errorText.textContent = err.message;
      this.confirmBtn.disabled = false;
      this.confirmBtn.textContent = 'Top Up';
    }
  }

  async refreshBalance() {
    try {
      const res = await fetch('http://localhost/api/me', {
        credentials: 'include'
      });
      const data = await res.json();

      if (data.authenticated && data.user) {
        // Update navbar with new balance
        if (notifyAuthChanged) {
          notifyAuthChanged({ authenticated: true, user: data.user });
        }

        // Dispatch balance updated event
        window.dispatchEvent(new CustomEvent('balance:updated', {
          detail: { newBalance: data.user.balance }
        }));
      }
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }
}

if (!customElements.get('balance-modal')) {
  customElements.define('balance-modal', BalanceModal);
}