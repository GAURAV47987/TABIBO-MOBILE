// In-app Terms of Service and Privacy Policy.
//
// DRAFTS — written to match what the app actually does today, but have
// them reviewed (ideally by a lawyer) before launch, and fill in the two
// placeholders below. The App Store and Play Console submission forms
// also ask for a public URL for the privacy policy: host this same text
// (e.g. as a page on the web app) and paste that URL into both stores.
//
// If you add a data flow (new third-party API, analytics, payments,
// trip sharing…), update the Privacy Policy in the same change.

export const LEGAL_CONTACT_EMAIL = "patelgaurav77@gmail.com";
export const LEGAL_GOVERNING_LAW = "Australia";
export const LEGAL_EFFECTIVE_DATE = "November 19, 2026";

export type LegalSection = { heading: string; body: string };
export type LegalDoc = { title: string; sections: LegalSection[] };

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  sections: [
    {
      heading: "1. Agreement",
      body: `These Terms govern your use of the TABIGO mobile app and web app ("TABIGO", "we", "us"). By creating an account or using TABIGO you agree to these Terms and to our Privacy Policy. If you don't agree, don't use TABIGO.`,
    },
    {
      heading: "2. Your account",
      body: `You must provide a valid email address and keep your password secure. You're responsible for activity on your account. You must be at least 13 years old (or the minimum age required in your country) to use TABIGO. You can delete your account at any time from Profile → Delete account, which permanently removes your account and all your trips, documents and photos.`,
    },
    {
      heading: "3. Your content",
      body: `You keep ownership of everything you add — trips, itineraries, budgets, packing lists, documents and photos ("Your Content"). You give us a limited licence to store, process and display Your Content solely to operate TABIGO for you. Don't upload anything you don't have the right to share, or anything illegal, harmful or infringing.`,
    },
    {
      heading: "4. AI-generated suggestions",
      body: `TABIGO can generate itinerary and place suggestions using a third-party AI model. Suggestions may be inaccurate, outdated or unsuitable. Always check opening hours, prices, safety, visa and entry requirements, and bookings yourself before relying on them.`,
    },
    {
      heading: "5. Travel information is not advice",
      body: `Maps, directions, weather, exchange rates and other information in TABIGO come from third-party sources and are provided for convenience only, without any guarantee of accuracy. TABIGO is not a travel agent and does not make bookings on your behalf. Keep your own copies of important documents such as tickets and passports.`,
    },
    {
      heading: "6. Acceptable use",
      body: `Don't misuse TABIGO: no attempts to access other people's data, disrupt or overload the service, reverse-engineer it except where the law allows, or use it to break any law.`,
    },
    {
      heading: "7. Availability and changes",
      body: `We may change, suspend or discontinue any part of TABIGO at any time. We may update these Terms; if the changes are material we'll let you know in the app. Continuing to use TABIGO after an update means you accept the new Terms.`,
    },
    {
      heading: "8. Termination",
      body: `You can stop using TABIGO and delete your account at any time. We may suspend or close accounts that violate these Terms.`,
    },
    {
      heading: "9. Disclaimer and limitation of liability",
      body: `TABIGO is provided "as is" and "as available", without warranties of any kind. To the fullest extent permitted by law, we are not liable for any indirect, incidental or consequential damages, or for missed travel, bookings, losses or costs arising from your use of TABIGO. Nothing in these Terms limits liability that cannot be limited by law.`,
    },
    {
      heading: "10. Apple App Store",
      body: `If you downloaded TABIGO from the Apple App Store, these Terms are between you and us, not Apple. Apple has no obligation to provide support or maintenance for TABIGO and is not responsible for any claims relating to it. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them.`,
    },
    {
      heading: "11. Governing law",
      body: `These Terms are governed by the laws of ${LEGAL_GOVERNING_LAW}, without regard to conflict-of-law rules.`,
    },
    {
      heading: "12. Contact",
      body: `Questions about these Terms: ${LEGAL_CONTACT_EMAIL}`,
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  sections: [
    {
      heading: "What we collect",
      body: `• Account: your email address and a securely hashed password.
• Trips: destinations, dates, stops, itinerary items, budget entries, packing lists, map pins, and travel documents you add (titles, confirmation numbers, notes, and any photos or PDFs you attach).
• Profile photo, if you choose to add one.
• Crash and error reports: device model, OS and app version, and technical details of the error — used only to fix bugs.
We don't collect your precise location, contacts, or advertising identifiers, and we don't sell your data.`,
    },
    {
      heading: "How we use it",
      body: `Only to run TABIGO for you: to sync your trips between devices, generate suggestions you ask for, show photos, weather and exchange rates, schedule the reminders you turn on, and diagnose crashes.`,
    },
    {
      heading: "Where it's stored",
      body: `Your account and trips are stored with Supabase, our database and file-storage provider. Travel documents are stored in a private bucket that only your account can access. A copy of trips you've opened is also kept on your device so they're viewable offline; it's removed when you sign out or delete your account. Trip reminders are scheduled locally on your device.`,
    },
    {
      heading: "Third-party services",
      body: `To provide features, TABIGO sends the minimum needed to these services:
• Google Gemini (AI) — destination and stop names, when you ask for an itinerary or place suggestions.
• OpenStreetMap Nominatim and GeoNames — place names you search for, to find locations.
• Pexels — place names, to find destination photos.
• Open-Meteo — trip coordinates and dates, for weather.
• Currency rate providers — no personal data.
• Sentry — crash and error reports.
• Apple Maps / Google Maps — only when you tap Directions, which opens that app.
Each provider handles data under its own privacy policy. Some of these providers, including our database host, store or process data outside Australia (for example in the United States); by using TABIGO you consent to that transfer.`,
    },
    {
      heading: "Your choices and rights",
      body: `You can view and edit your data in the app at any time, and delete individual trips or documents. You can permanently delete your account and all associated data from Profile → Delete account; this takes effect immediately and cannot be undone (residual copies in backups are purged on our provider's normal backup cycle). Depending on where you live you may have additional rights (such as access or portability) — contact us to exercise them.`,
    },
    {
      heading: "Children",
      body: `TABIGO isn't directed at children under 13, and we don't knowingly collect their data.`,
    },
    {
      heading: "Changes",
      body: `We'll update this policy when our practices change and show the new effective date below. Material changes will be announced in the app.`,
    },
    {
      heading: "Contact",
      body: `Privacy questions or requests: ${LEGAL_CONTACT_EMAIL}`,
    },
  ],
};

export const LEGAL_DOCS = { terms: TERMS, privacy: PRIVACY };
export type LegalDocId = keyof typeof LEGAL_DOCS;
