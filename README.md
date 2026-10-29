# Projecta Jobs Marketplace

A responsive dental and medical careers frontend for Iraq, built with React, Vite, Tailwind CSS, Lucide icons, and Supabase Auth. Its slate background, navy navigation, teal actions, left filtering sidebar, and square white cards follow a compact professional job-search layout.

## Develop

Requires Node.js 20.19+ or 22.12+ (validated with Node 24).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`npm run build` produces `dist/`; `npm run preview` serves the production build.

## Authentication

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using your Supabase project URL and public anonymous key. Never use a service role key in the browser. Restart Vite after changing these values.

In the Supabase dashboard, enable Google under Authentication → Providers and configure its OAuth credentials. Add your app origin to Authentication → URL Configuration → Site URL and the redirect allowlist (for local development, `http://localhost:5173`). Configure the provider's authorized callback URL as instructed by Supabase. Create an email/password user in Supabase to use the email sign-in form; this application does not include a registration flow.

Without these variables, the frontend works in demo mode and the sign-in modal explains the missing configuration. Real authentication requires your Supabase project and provider setup.

## Listings and interactions

- Search by title, organization/name, or description; filter by healthcare role, Iraqi city, schedule, and minimum monthly salary. Both listing tabs preserve the filters.
- Switch between job openings and candidates, save listings, and revisit saved listings in either tab.
- Create a listing with an international phone number to enable direct WhatsApp and phone actions; add an optional Telegram username for Telegram contact.
- Demo listings do not contain fabricated phone numbers and are explicitly identified as samples.
- Created listings and saved IDs persist in localStorage on the current browser/device. Listings are **not publicly published**, synced to Supabase, or shared across devices. The post form explicitly explains this scope.

The Supabase integration covers authentication. A public marketplace will additionally need a listings database, access policies, moderation, and backend persistence. No secrets or backend credentials are committed.

## Deploy to Vercel

Import `kararalaa25/projecta-jobs` in Vercel and select the `main` branch. The committed `vercel.json` selects Vite, runs `npm run build`, and publishes `dist/` with an SPA fallback.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment settings before deploying if authentication is required. Without them, the marketplace runs in demo mode. After deployment, add the production origin to the Supabase site URL and redirect allowlist. Listings remain device-local until backend persistence is implemented.
