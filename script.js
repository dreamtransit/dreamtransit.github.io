const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav-links');
menuButton?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Toggle navigation');
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));
document.querySelector('#year').textContent = new Date().getFullYear();
const dateInput = document.querySelector('input[name="date"]');
if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];
// Intentionally demo-only: this form does not collect, store, or send customer data.
document.querySelector('#ride-form')?.addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#form-message').textContent = 'Preview only: nothing was sent or saved. The secure booking system must be connected before launch.';
});
