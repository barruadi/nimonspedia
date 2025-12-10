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
      <style>
        .toast-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.35); 
            backdrop-filter: blur(1px); 
            z-index: 999998 !important; 
            display: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .toast-backdrop.is-open {
            display: block;
            opacity: 1;
        }

        .toast {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 1rem;
            position: fixed;
            top: 1.5rem;
            left: 50%;
            transform: translate(-50%, -150%); 
            padding: 1rem 1.5rem;
            background-color: #ffffff;
            color: #111827;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 
                        0 4px 6px rgba(0, 0, 0, 0.1);
            font-size: 0.875rem;
            font-weight: 500;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
            z-index: 999999 !important;
            max-width: 90%;
            width: auto;
            min-width: 320px;
            transition: transform 0.3s ease, opacity 0.3s ease;
            opacity: 0;
            visibility: hidden;
        }
        .toast.is-open {
            transform: translate(-50%, 0);
            opacity: 1;
            visibility: visible;
        }

        .toast-icon {
            width: 48px;
            height: 48px;
            flex-shrink: 0;
        }

        .toast-message {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            flex: 1;
        }

        #toastPrimaryMessage { 
            color: #111827;
            font-weight: 600;
            font-size: 0.9375rem;
        }

        #toastSecondaryMessage {
            color: #6b7280;
            font-size: 0.8125rem;
        }

        .toast-close-btn {
            padding: 0.5rem 1rem;
            background-color: #05AA5B;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 0.8125rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
            flex-shrink: 0;
            white-space: nowrap;
        }
        .toast-close-btn:hover {
            background-color: #059669;
        }
        .toast.error .toast-close-btn {
            background-color: #ef4444;
        }
        .toast.error .toast-close-btn:hover {
            background-color: #dc2626;
        }
      </style>
      
      <div id="toastBackdrop" class="toast-backdrop"></div>
      <div id="toast" class="toast">
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="11" stroke="#05AA5B" stroke-width="2"/>
          <path d="M8 12l2 2 4-4" stroke="#05AA5B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
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

    // Update icon color based on type
    const icon = this.shadowRoot.querySelector('.toast-icon path');
    const iconCircle = this.shadowRoot.querySelector('.toast-icon circle');
    if (type === 'error') {
      iconCircle.setAttribute('stroke', '#ef4444');
      icon.setAttribute('stroke', '#ef4444');
    } else {
      iconCircle.setAttribute('stroke', '#05AA5B');
      icon.setAttribute('stroke', '#05AA5B');
    }

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
}
