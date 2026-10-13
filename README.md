# TABIGO Mobile

The native iOS/Android app for TABIGO, built with React Native + Expo —
a real app, not a wrapper around the web app. Shares the same Supabase
backend (database, auth, storage, edge functions) as
[the web app](https://gaurav47987.github.io/TABIGO/), so every trip, every
account, and every feature works the same on both — this is a second
client for the same product, not a separate one.

## Why React Native, not Capacitor

Capacitor wraps the existing web app in a native shell — the UI still
renders as web content. React Native is different in kind: it compiles
to real native UI components (`UIView` on iOS, `View` on Android), the
same approach Instagram, Discord, Shopify, and Wanderlog itself use for
real production apps. This repo rebuilds TABIGO's screens from scratch
using React Native's own components, reusing the data layer and business
logic (Supabase queries, trip/stop/itinerary model) conceptually from the
web app, not the UI code itself.

## Status

Early scaffold. What's working so far:

- Supabase client (`src/lib/supabase.ts`) wired to the same project as
  the web app, with session persistence via AsyncStorage (the RN
  equivalent of the browser's localStorage).
- A real, working **Auth screen** (`src/screens/AuthScreen.tsx`) — sign
  up, sign in, email confirmation flow — ported from the web app's logic.
- A session-aware navigation shell (`App.tsx`): shows the Auth screen
  when signed out, a bottom tab bar (Home / Trips / Explore, placeholder
  screens for now) when signed in.
- Theme tokens (`src/theme.ts`) — the same Postcard Pop palette as the
  web app's `src/index.css`, ported to a plain object since React Native
  has no CSS custom properties. Keep both in sync if the palette changes.
- `eas.json` configured for cloud builds via Expo's EAS Build — this
  project doesn't require a Mac to produce iOS builds; EAS Build compiles
  on Apple's required infrastructure remotely.

## Not built yet

Every real screen beyond Auth: Home (template browsing), Trips grid,
Trip Hub (Itinerary/Budget/Convert/Map/Pack), the New Trip wizard,
Template Preview, Profile, Admin. These get rebuilt one at a time,
reusing the web app's Supabase query shapes and business logic as the
reference implementation.

## Setup

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (fastest way to iterate during
development), or press `i`/`a` to open an iOS/Android simulator if you
have one set up locally.

## Building for real devices / app store submission

```bash
npx eas build --platform ios --profile preview     # TestFlight-ready build
npx eas build --platform android --profile preview # internal testing build
npx eas submit --platform ios
npx eas submit --platform android
```

Requires an [expo.dev](https://expo.dev) account (free) linked via
`npx eas login`, and — before actual App Store/Play Store submission —
an Apple Developer Program membership ($99/year) and a Google Play
Developer account ($25 one-time).
