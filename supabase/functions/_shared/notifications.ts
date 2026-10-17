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
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
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

export function pendingTeamEmail(booking: BookingNotification): string {
  return [
    `New ride request ${booking.id} (Pending; not confirmed)`,
    `Customer: ${booking.firstName} ${booking.lastName}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone}`,
    `Service: ${booking.service}`,
    `Pickup: ${booking.pickupAddress}`,
    `Destination: ${booking.destination}`,
    `Requested date/time: ${booking.pickupDate} ${booking.pickupTime}`,
    `Round trip: ${booking.roundTrip ? "Yes" : "No"}`,
    `Mobility assistance: ${booking.mobilityNeeds.join(", ") || "None selected"}`,
    `Mobility details: ${booking.mobilityNotes || "None provided"}`,
    `Additional information: ${booking.notes || "None provided"}`,
    "Contact the customer directly to confirm details and availability.",
  ].join("\n");
}

export function pendingTeamSms(booking: BookingNotification): string {
  return `New Dream Transit ride request ${booking.id}: ${booking.firstName} ${booking.lastName}, ${booking.service}, ${booking.pickupDate} at ${booking.pickupTime}. Not confirmed; see email for details.`;
}
