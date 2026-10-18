async function hmacHex(message: string): Promise<string> {
  const secret = Deno.env.get("CONFIRM_SECRET");
  if (!secret) throw new Error("CONFIRM_SECRET is not configured");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function signRide(rideId: string): Promise<string> {
  return hmacHex(`confirm-ride:${rideId}`);
}

export async function verifyRide(rideId: string, token: string): Promise<boolean> {
  const expected = await signRide(rideId);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function confirmLink(rideId: string): Promise<string> {
  const origin = Deno.env.get("SITE_ORIGIN") ?? "https://dream-transit.com";
  return `${origin}/confirm.html#id=${rideId}&token=${await signRide(rideId)}`;
}
