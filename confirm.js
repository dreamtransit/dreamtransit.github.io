const config = window.DREAM_TRANSIT_CONFIG ?? {};
const params = new URLSearchParams(location.hash.slice(1));
const details = document.querySelector('#details');
const statusEl = document.querySelector('#status');
const button = document.querySelector('#confirm');

async function callConfirm(action) {
  const response = await fetch(`${config.supabaseUrl}/functions/v1/confirm-ride`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey },
    body: JSON.stringify({ id: params.get('id'), token: params.get('token'), action }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showRide(ride) {
  const rows = [
    ['Customer', ride.name], ['Phone', ride.phone], ['Email', ride.email], ['Service', ride.service],
    ['Date', ride.date], ['Time', ride.time], ['Pickup', ride.pickup], ['Destination', ride.destination],
  ];
  details.replaceChildren(...rows.flatMap(([label, value]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    return [dt, dd];
  }));
}

function showStatus(status) {
  if (status === 'confirmed') statusEl.textContent = 'This ride is confirmed.';
  else if (status === 'cancelled') statusEl.textContent = 'This ride was cancelled.';
  else statusEl.textContent = '';
  button.hidden = status !== 'pending';
}

async function init() {
  if (!params.get('id') || !params.get('token')) {
    statusEl.textContent = 'This confirmation link is not valid.';
    return;
  }
  try {
    const data = await callConfirm('view');
    showRide(data.ride);
    showStatus(data.status);
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

button.addEventListener('click', async () => {
  button.disabled = true;
  statusEl.textContent = 'Confirming...';
  try {
    const data = await callConfirm('confirm');
    showStatus(data.status);
    statusEl.textContent = data.emailSent
      ? 'Ride confirmed. The customer was emailed.'
      : 'Ride confirmed, but the email could not be sent. Please contact the customer.';
  } catch (error) {
    statusEl.textContent = error.message;
    button.disabled = false;
  }
});

init();
