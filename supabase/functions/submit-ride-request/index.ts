import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/http.ts";
import { pendingTeamEmail, pendingTeamSms, sendEmail, sendSms } from "../_shared/notifications.ts";

const services = new Set([
  "Non-emergency medical transportation",
  "Wheelchair transportation",
  "Senior & private-pay rides",
  "Private transportation",
  "Hospital discharge transportation",
  "Private-pay school transportation",
]);
const mobilityOptions = new Set(["wheelchair", "walker", "boarding_assistance", "service_animal", "other"]);

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function fingerprint(address: string): Promise<string> {
  const salt = Deno.env.get("RATE_LIMIT_SALT");
  if (!salt) throw new Error("RATE_LIMIT_SALT is not configured");
  const input = new TextEncoder().encode(`${salt}:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed." }, 405);

  try {
    const input = await request.json();
    if (clean(input.website, 200)) return jsonResponse(request, { ok: true }, 202);

    const firstName = clean(input.firstName, 80);
    const lastName = clean(input.lastName, 80);
    const email = clean(input.email, 254).toLowerCase();
    const phone = clean(input.phone, 32);
    const service = clean(input.service, 80);
    const pickupDate = clean(input.date, 10);
    const pickupTime = clean(input.time, 5);
    const pickupAddress = clean(input.pickup, 250);
    const destination = clean(input.destination, 250);
    const mobilityNeeds = Array.isArray(input.mobilityNeeds)
      ? input.mobilityNeeds.filter((item: unknown): item is string => typeof item === "string" && mobilityOptions.has(item))
      : [];
    const mobilityNotes = clean(input.mobilityNotes, 500);
    const notes = clean(input.notes, 1000);

    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(request, { error: "Enter a valid name and email address." }, 400);
    }
    if (phone.replace(/\D/g, "").length < 7 || !services.has(service)) {
      return jsonResponse(request, { error: "Enter a valid phone number and choose a service." }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !/^\d{2}:\d{2}$/.test(pickupTime)) {
      return jsonResponse(request, { error: "Enter a valid pickup date and time." }, 400);
    }
    const [year, month, day] = pickupDate.split("-").map(Number);
    const [hour, minute] = pickupTime.split(":").map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    const validDate = parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day;
    if (!validDate || hour > 23 || minute > 59) {
      return jsonResponse(request, { error: "Enter a valid pickup date and time." }, 400);
    }
    if (pickupDate < new Date().toISOString().slice(0, 10) || pickupAddress.length < 3 || destination.length < 3) {
      return jsonResponse(request, { error: "Enter a future date and complete pickup and destination addresses." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing");
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { data: allowed, error: rateError } = await admin.rpc("consume_booking_rate_limit", {
      p_ip_fingerprint: await fingerprint(address),
    });
    if (rateError) throw rateError;
    if (!allowed) return jsonResponse(request, { error: "Too many requests. Please wait before submitting again." }, 429);

    const { data, error } = await admin.from("ride_requests").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      service,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      pickup_address: pickupAddress,
      destination,
      round_trip: input.roundTrip === true,
      mobility_needs: mobilityNeeds,
      mobility_notes: mobilityNotes,
      notes,
      status: "pending",
    }).select("id, first_name, last_name, email, phone, service, pickup_date, pickup_time, pickup_address, destination, round_trip, mobility_needs, mobility_notes, notes, status").single();
    if (error) throw error;

    const booking = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      service: data.service,
      pickupDate: data.pickup_date,
      pickupTime: data.pickup_time,
      pickupAddress: data.pickup_address,
      destination: data.destination,
      roundTrip: data.round_trip,
      mobilityNeeds: data.mobility_needs,
      mobilityNotes: data.mobility_notes,
      notes: data.notes,
    };
    const teamEmail = Deno.env.get("TEAM_NOTIFICATION_EMAIL");
    const teamPhone = Deno.env.get("TEAM_NOTIFICATION_PHONE");
    const notificationResults = await Promise.allSettled([
      teamEmail ? sendEmail(teamEmail, "New Dream Transit ride request", pendingTeamEmail(booking)) : Promise.resolve(false),
      teamPhone ? sendSms(teamPhone, pendingTeamSms(booking)) : Promise.resolve(false),
    ]);
    const notificationsSent = notificationResults.filter((result) => result.status === "fulfilled" && result.value).length;
    if (notificationsSent < 2) console.error("One or more team booking notifications were not sent.");

    return jsonResponse(request, { ok: true, requestId: booking.id, status: "pending", notificationsSent }, 201);
  } catch (error) {
    console.error("Ride request submission failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse(request, { error: "We could not submit your request. Please call Dream Transit." }, 500);
  }
});
