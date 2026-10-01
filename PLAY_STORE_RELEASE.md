# Nailly Google Play release checklist

Nailly Android package: **com.nailly.app**  
Release version: **1.0.0**  
Initial versionCode: **1**

## Build configuration

- Production output: Android App Bundle (AAB)
- Preview output: APK for device testing
- Main icon: `assets/icon.png`
- Adaptive foreground: `assets/android-adaptive-foreground.png`
- Adaptive background: `#fce8e4`
- Splash: official Nailly wordmark on `#fffaf7`

## Build commands

```bash
npm ci
npm run check
npx expo-doctor@latest
npm run build:android:preview
npm run build:android:production
```

## Google Play Console setup

Create the app as **Nailly** and use package name:

```text
com.nailly.app
```

Public URLs:

- Privacy Policy: https://naillyapp.com/privacy.html
- Support: https://naillyapp.com/support.html
- Account deletion: https://naillyapp.com/delete-account.html
- Terms: https://naillyapp.com/terms.html

## Store listing preparation

Prepare:

- App name: Nailly
- Short description
- Full description
- App icon
- Feature graphic
- Phone screenshots
- Category
- Contact email
- Privacy Policy URL

## App content / policy forms

Complete in Play Console:

- Data safety
- Ads declaration
- App access
- Content rating
- Target audience and content
- News apps declaration if shown
- Government apps declaration if shown
- Financial features declaration if shown
- Account deletion declaration

Nailly has account creation, so the account deletion URL and in-app deletion flow must remain available.

## Testing requirement for new personal accounts

For a new personal Play Console developer account created after 13 November 2023, Google currently requires a **closed test with at least 12 testers continuously opted in for 14 days** before applying for production access.

Start with Internal testing for quick installation, then create the required Closed testing track as soon as the store setup is complete.

## Device verification

New personal developer accounts may also be required to verify access to a real Android device using the Google Play Console mobile app before public release.

## Production sequence

1. Register/verify Play Console developer account.
2. Create Nailly app entry.
3. Complete store listing and policy forms.
4. Upload production AAB to Closed testing.
5. Keep at least 12 testers opted in continuously for 14 days.
6. Apply for production access.
7. After approval, create Production release.
