type BookingNotification = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  service: string;
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  destination: string;
  roundTrip: boolean;
  mobilityNeeds: string[];
  mobilityNotes: string;
  notes: string;
};

function getEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
  };
  return runtime.Deno?.env?.get?.(name);
}

function formatPhone(phone: string): string {
  const cleaned = phone.trim().replace(/[\s().-]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = getEnv("RESEND_API_KEY");
  const from = getEnv("EMAIL_FROM");
  if (!apiKey || !from) {
    console.error("Email skipped: RESEND_API_KEY or EMAIL_FROM is not set.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!response.ok) console.error(`Resend failed (${response.status}):`, (await response.text()).slice(0, 300));
  return response.ok;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = getEnv("TWILIO_ACCOUNT_SID");
  const authToken = getEnv("TWILIO_AUTH_TOKEN");
  const from = getEnv("TWILIO_FROM_PHONE");
  if (!accountSid || !authToken || !from) return false;

  const credentials = btoa(`${accountSid}:${authToken}`);
  const payload = new URLSearchParams({ To: formatPhone(to), From: from, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    },
  );
  return response.ok;
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function pendingTeamEmail(booking: BookingNotification, confirmUrl?: string): string {
  const time = formatTime(booking.pickupTime);
  return [
    "NEW RIDE REQUEST (Pending - not confirmed)",
    "",
    `First name: ${booking.firstName}`,
    `Last name: ${booking.lastName}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone}`,
    `Service: ${booking.service}`,
    `Date: ${booking.pickupDate}`,
    `Time: ${time}`,
    `Pickup address: ${booking.pickupAddress}`,
    `Destination: ${booking.destination}`,
    `Round trip: ${booking.roundTrip ? "Yes" : "No"}`,
    `Notes: ${booking.notes || "None provided"}`,
    "",
    `Request ID: ${booking.id}`,
    "Contact the customer directly to confirm details and availability.",
    ...(confirmUrl ? ["", "CONFIRM THIS RIDE (emails the customer a confirmation):", confirmUrl] : []),
  ].join("\n");
}

export function pendingTeamSms(booking: BookingNotification): string {
  return `New Dream Transit ride request ${booking.id}: ${booking.firstName} ${booking.lastName}, ${booking.service}, ${booking.pickupDate} at ${booking.pickupTime}. Not confirmed; see email for details.`;
}

export function customerReceivedEmail(booking: BookingNotification): string {
  return [
    `Hello ${booking.firstName},`,
    "",
    "Thank you for choosing Dream Transit. We received your ride request.",
    "",
    `Service: ${booking.service}`,
    `Requested date/time: ${booking.pickupDate} ${booking.pickupTime}`,
    `Pickup: ${booking.pickupAddress}`,
    `Destination: ${booking.destination}`,
    "",
    "Our team will send you a confirmation by email or call you shortly. This is not a confirmed ride until we reach out.",
    "",
    "Questions? Call 206-822-5188.",
    "Dream Transit",
  ].join("\n");
}

export function confirmedCustomerEmail(
  booking: Pick<BookingNotification, "firstName" | "service" | "pickupDate" | "pickupTime" | "pickupAddress" | "destination">,
): string {
  return [
    `Hello ${booking.firstName},`,
    "",
    "Your Dream Transit ride is confirmed.",
    "",
    `Service: ${booking.service}`,
    `Date: ${booking.pickupDate}`,
    `Time: ${formatTime(booking.pickupTime)}`,
    `Pickup: ${booking.pickupAddress}`,
    `Destination: ${booking.destination}`,
    "",
    "Need to change something? Call 206-822-5188.",
    "Dream Transit",
  ].join("\n");
}
