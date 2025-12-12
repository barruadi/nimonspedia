class AppToast extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this.autoHideTimer = null;
    this.isShowing = false;
    this.queue = [];
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

    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    this.backdrop.addEventListener('click', () => this.hide());

    const oldHandler = this._showHandler;
    if (oldHandler) {
      window.removeEventListener('show-toast', oldHandler);
    }

    this._showHandler = this.handleShowEvent.bind(this);
    window.addEventListener('show-toast', this._showHandler);

    console.log('Toast component connected');
  }

  disconnectedCallback() {
    if (this._showHandler) {
      window.removeEventListener('show-toast', this._showHandler);
    }
    this.closeBtn?.removeEventListener('click', this.hideHandler);
    this.backdrop?.removeEventListener('click', this.hideHandler);
    
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
    
    console.log('Toast component disconnected');
  }

  handleShowEvent(e) {
    const { primary, secondary = '', type = 'success' } = e.detail;
    
    const isDuplicate = this.queue.some(item => 
      item.primary === primary && 
      item.secondary === secondary && 
      item.type === type
    );
    
    if (isDuplicate) {
      console.warn('Duplicate toast ignored:', primary);
      return;
    }
    
    this.show(primary, secondary, type);
  }

  show(primary, secondary, type) {
    if (this.isShowing) {
      console.log('Toast busy, queueing:', primary);
      this.queue.push({ primary, secondary, type });
      return;
    }
    
    this.isShowing = true;
    
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }

    this.primaryEl.textContent = primary;
    this.secondaryEl.textContent = secondary;
    this.toast.className = 'toast ' + type;

    this.backdrop.classList.add('is-open');
    this.toast.classList.add('is-open');

    console.log('Toast shown:', primary);

    this.autoHideTimer = setTimeout(() => {
      this.hide();
      
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        setTimeout(() => {
          this.show(next.primary, next.secondary, next.type);
        }, 300);
      }
    }, 5000);
  }

  hide() {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    
    this.backdrop.classList.remove('is-open');
    this.toast.classList.remove('is-open');
    
    setTimeout(() => {
      this.isShowing = false;
    }, 300);
    
    console.log('Toast hidden');
  }
}

if (!customElements.get('app-toast')) {
  customElements.define('app-toast', AppToast);
  console.log('AppToast custom element defined');
} else {
  console.warn('AppToast already defined');
}