# Nailly iOS release checklist

Nailly is configured for the first public release as version **1.0.0** with iOS bundle identifier **com.nailly.app**.

## Required visual assets before the first EAS build

The final Nailly visual direction is approved. The repository still needs the binary PNG files to exist before their `app.json` references are enabled:

- `assets/icon.png` — 1024×1024 PNG app icon.
- `assets/splash-icon.png` — transparent PNG containing the official Nailly wordmark.

The mobile source uses the official wordmark style everywhere: dark burgundy serif `nailly` with a coral dot.

After the assets exist, configure:

```json
"icon": "./assets/icon.png"
```

and add the recommended Expo splash-screen plugin:

```json
[
  "expo-splash-screen",
  {
    "image": "./assets/splash-icon.png",
    "imageWidth": 200,
    "resizeMode": "contain",
    "backgroundColor": "#fffaf7"
  }
]
```

Install it with the SDK-compatible Expo command:

```bash
npx expo install expo-splash-screen
```

Do not validate the final splash screen in Expo Go. Use a preview or production build.

## Environment

Public mobile configuration uses:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_MATCH_API_URL`

No Supabase service-role or secret key may be bundled in the mobile application.

Create the corresponding EAS development/preview/production environment variables before cloud builds.

## Validation before TestFlight

Run:

```bash
npm ci
npm run check
npx expo-doctor
npx expo config --type public
```

Then configure/link the project with EAS if it has not been linked yet:

```bash
npx eas-cli@latest init
```

Build a preview:

```bash
npm run build:ios:preview
```

After QA, build the App Store/TestFlight binary:

```bash
npm run build:ios:production
```

Submit:

```bash
npm run submit:ios
```

## Public URLs

- Support: https://naillyapp.com/support.html
- Privacy: https://naillyapp.com/privacy.html
- Account deletion: https://naillyapp.com/delete-account.html
- Terms: https://naillyapp.com/terms.html
