# Dream Transit Website

Responsive transportation website starter for Dream Transit. Public branding omits “LLC” as requested.

## Preview locally
Serve the folder over HTTP so the Supabase browser SDK and functions can run:

```sh
python3 -m http.server 5500
```

Then open `http://localhost:5500`. Until Supabase is configured, the booking form stays disabled and clearly says that no customer data will be submitted.

## Files
- `index.html` — public page and ride-request form
- `styles.css` — responsive styling
- `script.js` — mobile navigation and booking form integration
- `supabase/` — database migration and Edge Functions
- `supabase-config.js` — public Supabase URL and publishable key only
- `assets/` — local photos used by the website

## Photo credit
Accessible-van photo by [Dave Garcia on Pexels](https://www.pexels.com/photo/accessibility-van-with-wheelchair-lift-in-action-35831410/).

## Booking system setup
The website is static, so booking writes and team notifications run through a Supabase Edge Function. The browser receives only the Supabase project URL and publishable key; Row Level Security denies browser access to booking data. Requests are stored with Pending status, and the team receives the booking details by email and SMS. There is no staff dashboard, approval workflow, or customer notification. Never put a Supabase service-role key, Resend key, or Twilio token in `supabase-config.js` or any other frontend file.

1. Create a Supabase project and install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Put the project's URL and public anon key in `supabase-config.js`:

```js
window.DREAM_TRANSIT_CONFIG = Object.freeze({
	supabaseUrl: "https://YOUR_PROJECT.supabase.co",
	supabaseAnonKey: "YOUR_PUBLIC_PUBLISHABLE_KEY",
	bookingEnabled: false,
});
```

3. Link this folder, apply the migration, and deploy the notification function. The CLI will prompt for your database password; enter it in the terminal and do not share it in chat:

```sh
npx --yes supabase login
npx --yes supabase link --project-ref YOUR_PROJECT_REF
npx --yes supabase db push
npx --yes supabase functions deploy submit-ride-request
```

4. Configure function secrets in the Supabase project. Use real values in your local terminal, never in committed files:

```sh
npx --yes supabase secrets set \
	SITE_ORIGIN=https://dream-transit.com \
	RATE_LIMIT_SALT=GENERATE_A_LONG_RANDOM_SECRET \
	RESEND_API_KEY=YOUR_RESEND_API_KEY \
	EMAIL_FROM="Dream Transit <rides@YOUR_VERIFIED_DOMAIN>" \
	TEAM_NOTIFICATION_EMAIL=info@dream-transit.com \
	TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID \
	TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN \
	TWILIO_FROM_PHONE=YOUR_TWILIO_NUMBER \
	TEAM_NOTIFICATION_PHONE=+12068225188
```

`RESEND_API_KEY` and a verified `EMAIL_FROM` are required for email. Twilio credentials and phone numbers are required for SMS. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; do not copy the service-role key into the website.

Keep `bookingEnabled` set to `false` until the migration, Edge Function, Resend email, and Twilio SMS are configured and tested. Then set it to `true` in `supabase-config.js` to enable submissions. Confirm that the team email and phone values above are correct before enabling the form.

## Privacy and launch checklist
The form stores customer contact details, addresses, requested ride details, and selected mobility assistance. The form warns customers not to enter diagnoses or unnecessary medical details. Set a retention/deletion policy, review access and notification recipients, test email/SMS delivery, and review applicable privacy requirements before accepting real requests. This code alone does not make the service HIPAA-compliant; if HIPAA applies, use appropriately eligible services under the required agreements.

Review all service descriptions, accessibility claims, operating hours, rates, service area, privacy terms, and contact details before publishing. The office address is shown as `1221 S Main St` without an unverified city or ZIP code.
