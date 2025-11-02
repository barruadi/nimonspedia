class AppToast extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this.autoHideTimer = null;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/styles/ToastNotification.css">
      
      <div id="toastBackdrop" class="toast-backdrop"></div>
      <div id="toast" class="toast">
        <img src="/uploads/toast-notification/toast-icon.svg" alt="Toast Icon" class="toast-icon" />
        <div class="toast-message">
          <div id="toastPrimaryMessage"></div>
          <div id="toastSecondaryMessage"></div>
        </div>
        <button type="button" id="toastCloseBtn" class="toast-close-btn">Tutup</button>
      </div>
    `;
  }

  connectedCallback() {
    this.backdrop = this.shadowRoot.getElementById('toastBackdrop');
    this.toast = this.shadowRoot.getElementById('toast');
    this.primaryEl = this.shadowRoot.getElementById('toastPrimaryMessage');
    this.secondaryEl = this.shadowRoot.getElementById('toastSecondaryMessage');
    this.closeBtn = this.shadowRoot.getElementById('toastCloseBtn');

    this.closeBtn.addEventListener('click', () => this.hide());
    this.backdrop.addEventListener('click', () => this.hide());

    window.addEventListener('show-toast', this.handleShowEvent.bind(this));
  }

  handleShowEvent(e) {
    const { primary, secondary = '', type = 'success' } = e.detail;
    this.show(primary, secondary, type);
  }

  show(primary, secondary, type) {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    this.primaryEl.textContent = primary;
    this.secondaryEl.textContent = secondary;
    this.toast.className = 'toast ' + type;

    this.backdrop.classList.add('is-open');
    this.toast.classList.add('is-open');

    this.autoHideTimer = setTimeout(() => this.hide(), 5000);
  }

  hide() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    this.backdrop.classList.remove('is-open');
    this.toast.classList.remove('is-open');
  }
}

if (!customElements.get('app-toast')) {
  customElements.define('app-toast', AppToast);
}