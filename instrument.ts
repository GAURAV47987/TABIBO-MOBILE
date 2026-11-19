// Imported first in index.ts, before App — so Sentry is live before any of
// App.tsx's own imports (react-navigation, expo-notifications, the
// Supabase client, etc.) run, and can catch a throw during their
// module-evaluation, not just render-phase errors caught later by
// Sentry.wrap around the root component.
import { initMonitoring } from "./src/lib/monitoring";

initMonitoring();
