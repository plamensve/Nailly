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

## Visual similarity service

A Python OpenCLIP service is in `matching_service/`. It embeds photos with ViT-B-32 and searches 512-dimensional vectors in Supabase pgvector. This is a deployment component: the app uses it only after an HTTPS URL is provided in `EXPO_PUBLIC_MATCH_API_URL` and the third migration (`20260929220000_visual_search.sql`) has been applied. It has **not** been deployed to a server.

On a trusted server with enough memory for PyTorch and the model:

```bash
cd matching_service
python -m venv .venv
pip install -r requirements.txt
# Supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY via the host's secret manager.
uvicorn app:app --host 0.0.0.0 --port 8000
python backfill.py
```

The service verifies Supabase user tokens before search and studio ownership before indexing. Keep the service-role key on the server only. Use HTTPS, request rate limits and monitoring before public launch. A 10,000-image portfolio can be queried through the vector index after existing images have been embedded; the model still needs real manicure test photos and relevance evaluation before the results are treated as a product-quality recommendation.
