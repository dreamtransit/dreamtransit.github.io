import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleOptions, jsonResponse } from "../_shared/http.ts";
import { verifyRide } from "../_shared/confirmToken.ts";
import { confirmedCustomerEmail, sendEmail } from "../_shared/notifications.ts";

const columns = "id, first_name, last_name, email, phone, service, pickup_date, pickup_time, pickup_address, destination, status";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed." }, 405);

  try {
    const input = await request.json();
    const id = typeof input.id === "string" ? input.id : "";
    const token = typeof input.token === "string" ? input.token : "";
    const action = input.action === "confirm" ? "confirm" : "view";

    if (!/^[0-9a-f-]{36}$/i.test(id) || !token || !(await verifyRide(id, token))) {
      return jsonResponse(request, { error: "This confirmation link is not valid." }, 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing");
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: ride, error } = await admin.from("ride_requests").select(columns).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!ride) return jsonResponse(request, { error: "Ride request not found." }, 404);

    const summary = {
      name: `${ride.first_name} ${ride.last_name}`,
      phone: ride.phone,
      email: ride.email,
      service: ride.service,
      date: ride.pickup_date,
      time: ride.pickup_time,
      pickup: ride.pickup_address,
      destination: ride.destination,
    };
    if (action === "view") return jsonResponse(request, { ok: true, status: ride.status, ride: summary });

    // Only the pending row is updated, so a repeated click never re-sends the email.
    const { data: updated, error: updateError } = await admin
      .from("ride_requests")
      .update({ status: "confirmed" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (updateError) throw updateError;
    if (!updated?.length) return jsonResponse(request, { ok: true, status: ride.status, emailSent: false, ride: summary });

    const emailSent = await sendEmail(
      ride.email,
      "Your Dream Transit ride is confirmed",
      confirmedCustomerEmail({
        firstName: ride.first_name,
        service: ride.service,
        pickupDate: ride.pickup_date,
        pickupTime: ride.pickup_time,
        pickupAddress: ride.pickup_address,
        destination: ride.destination,
      }),
    );
    return jsonResponse(request, { ok: true, status: "confirmed", emailSent, ride: summary });
  } catch (error) {
    console.error("Confirm ride failed:", error instanceof Error ? error.message : "unknown error");
    return jsonResponse(request, { error: "Something went wrong. Please try again." }, 500);
  }
});
