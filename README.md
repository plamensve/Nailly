# Nailly

An iPhone-first nail artist marketplace built with Expo, React Native, TypeScript and Supabase.

## Start on Windows and iPhone

1. Pull the latest `main` branch in PyCharm and install Node.js LTS.
2. Run `npm install` in the repository root.
3. Copy `.env.example` to `.env`. The existing publishable key is client-side configuration. Never put a service-role key in the app.
4. Run `npx expo start` and scan the QR code with the iPhone camera. If the devices cannot connect on the same Wi-Fi, use `npx expo start --tunnel`.

## Database setup

Run these SQL files **in order** in the Supabase project's SQL Editor, once each:

1. `supabase/migrations/20260929180000_initial.sql` (skip if its four tables already exist and this migration ran successfully).
2. `supabase/migrations/20260929210000_marketplace.sql`.

The second migration adds the user profile trigger, saved looks, availability, booking controls, storage bucket and RLS policies. GitHub does not apply these migrations to your Supabase project automatically. If email confirmation is enabled in Supabase Auth, new users must confirm their address before signing in. Artist photos are public once published.

## Current features

- Email/password client and artist registration and persistent sign-in.
- Public studio portfolio, search by design/studio/city, favorites for signed-in users.
- Studio creation/editing, photo upload, starting price, future 60-minute appointment slots.
- Client appointment requests, artist confirmation, cancellation, and double-booking protection.
- On-device inspiration photo selection.

Visual similarity ranking is **not yet implemented**: the photo is not uploaded and results remain a chronological gallery. Production release still needs a deployed image embedding service, search evaluation, more booking controls, testing on real iPhones and App Store preparation. Sample data is no longer shown; studios must publish portfolio looks for Discover to populate.
