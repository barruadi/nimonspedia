class AppNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <nav style="padding:10px;border-bottom:1px solid #ddd;display:flex;gap:12px">
        <a data-nav href="/home">Home</a>
        <a data-nav href="/login">Login</a>
        <a data-nav href="/register">Register</a>
      </nav>
    `;
  }
}

customElements.define('app-navbar', AppNavbar);