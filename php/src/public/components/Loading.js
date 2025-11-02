class AppLoading extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/styles/LoadingComponent.css">
      <img src="/uploads/loading/loading-icon.svg" alt="Loading Icon" class="loading-icon">
      <h2 id="loadingTitle" class="loading-title">Memuat...</h2>
      <p id="loadingSubtitle" class="loading-subtitle">Tunggu sebentar...</p>
    `;
    this.titleEl = this.shadowRoot.getElementById('loadingTitle');
    this.subtitleEl = this.shadowRoot.getElementById('loadingSubtitle');
  }

  connectedCallback() {
    window.addEventListener('show-loading', this.handleShow.bind(this));
    window.addEventListener('hide-loading', this.handleHide.bind(this));
  }
  
  disconnectedCallback() {
    window.removeEventListener('show-loading', this.handleShow.bind(this));
    window.removeEventListener('hide-loading', this.handleHide.bind(this));
  }

  handleShow(e) {
    const { title, subtitle } = e.detail;
    this.show(title, subtitle);
  }

  handleHide() {
    this.hide();
  }

  show(title = 'Memuat...', subtitle = 'Tunggu sebentar...') {
    this.titleEl.textContent = title;
    this.subtitleEl.textContent = subtitle;
    this.setAttribute('open', ''); // Menambahkan atribut 'open'
  }

  hide() {
    this.removeAttribute('open'); // Menghapus atribut 'open'
  }
}

if (!customElements.get('app-loading')) {
  customElements.define('app-loading', AppLoading);
}