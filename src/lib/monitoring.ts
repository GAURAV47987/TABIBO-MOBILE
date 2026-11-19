import * as Sentry from "@sentry/react-native";

// Crash and error reporting via Sentry. Inert until a DSN is configured:
// set EXPO_PUBLIC_SENTRY_DSN (in .env locally, and as an EAS environment
// variable for builds — see README "Crash reporting"). Expo inlines
// EXPO_PUBLIC_* values at build time.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = !!DSN;

export function initMonitoring() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    enabled: !__DEV__,
    environment: __DEV__ ? "development" : "production",
    // Trips, documents and emails are personal data — never attach IPs,
    // request bodies or other PII to error reports.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

// Attach only the opaque user id, so a crash can be traced to an account
// on request without sending the email address to Sentry.
export function setMonitoringUser(userId: string | null) {
  if (!DSN) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export const wrapRoot = Sentry.wrap;
