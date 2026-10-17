const defaultOrigin = "https://dream-transit.com";

export function corsHeaders(request: Request): HeadersInit {
  const configured = Deno.env.get("SITE_ORIGIN") ?? defaultOrigin;
  const allowedOrigins = new Set([
    configured,
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  ]);
  const requestOrigin = request.headers.get("Origin") ?? configured;
  const origin = allowedOrigins.has(requestOrigin) ? requestOrigin : configured;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

export function handleOptions(request: Request): Response {
  return new Response("ok", { headers: corsHeaders(request) });
}
