# Nailly

An iPhone-first Expo prototype for exploring nail designs and discovering the artists behind them.

## Run on an iPhone with Expo Go

1. Install Node.js LTS and clone this repository in PyCharm on Windows.
2. Run `npm install`.
3. Copy `.env.example` to `.env`. The project URL and publishable key are public client configuration; never put a secret or service-role key in an Expo variable.
4. Run `npx expo start`. Scan the QR code with your iPhone camera and open Expo Go. Keep the computer and iPhone on the same Wi-Fi network. If discovery fails, try `npx expo start --tunnel`.

The app initially displays sample cards. Photo selection happens on-device; no photo is uploaded. Similarity ranking, user accounts, artist uploads, availability and real bookings are not implemented yet. The appointment button only shows an explanation.

## Supabase

The client reads published `portfolio_looks` joined to `studios` if those tables exist and contain data. Otherwise it shows sample cards. The reviewed schema and RLS policies are in `supabase/migrations/20260929180000_initial.sql`. Apply the migration in the project's SQL Editor before using real portfolio data. This repository connection does not automatically apply SQL to Supabase. Never use the service-role key in the mobile app.
