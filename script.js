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
if (dateInput) dateInput.min = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const rideForm = document.querySelector('#ride-form');
const rideMessage = document.querySelector('#form-message');
const rideSubmit = rideForm?.querySelector('[type="submit"]');
const bookingConfig = window.DREAM_TRANSIT_CONFIG ?? {};
const bookingClient = bookingConfig.bookingEnabled === true && window.supabase?.createClient && bookingConfig.supabaseUrl && bookingConfig.supabaseAnonKey
  ? window.supabase.createClient(bookingConfig.supabaseUrl, bookingConfig.supabaseAnonKey)
  : null;

if (rideForm) {
  const honeypotLabel = document.createElement('label');
  honeypotLabel.className = 'form-honeypot';
  honeypotLabel.setAttribute('aria-hidden', 'true');
  honeypotLabel.append(document.createTextNode('Leave this field empty'));
  const honeypot = document.createElement('input');
  honeypot.name = 'website';
  honeypot.tabIndex = -1;
  honeypot.autocomplete = 'off';
  honeypotLabel.append(honeypot);
  rideSubmit?.before(honeypotLabel);

  const setupAlert = document.querySelector('.demo-alert');
  if (bookingClient) {
    setupAlert?.remove();
    const legalText = rideForm.querySelector('.form-legal');
    if (legalText) legalText.textContent = 'Please share only information needed to arrange transportation. Your request is not a confirmed ride.';
  } else {
    if (setupAlert) setupAlert.textContent = 'Secure booking setup is not complete yet. Do not submit personal information. Please call 206-822-5188 to request a ride.';
    if (rideSubmit) {
      rideSubmit.disabled = true;
      rideSubmit.textContent = 'Booking setup pending';
    }
  }

  rideForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!bookingClient) return;

    rideSubmit.disabled = true;
    rideMessage.textContent = 'Sending your request securely...';
    const formData = new FormData(rideForm);
    const payload = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      service: formData.get('service'),
      date: formData.get('date'),
      time: formData.get('time'),
      pickup: formData.get('pickup'),
      destination: formData.get('destination'),
      roundTrip: formData.get('roundTrip') === 'yes',
      notes: formData.get('notes'),
      website: formData.get('website'),
    };

    try {
      const { data, error } = await bookingClient.functions.invoke('submit-ride-request', { body: payload });
      if (error) throw error;
      rideForm.reset();
      if (dateInput) dateInput.min = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
      rideMessage.textContent = 'Thank you! Your ride request was submitted successfully. The Dream Transit team will contact you shortly to confirm your ride. This is not a confirmed ride until we reach out.';
    } catch {
      rideMessage.textContent = 'We could not submit your request. Please call 206-822-5188.';
    } finally {
      rideSubmit.disabled = false;
    }
  });
}
