import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { enumerateDates } from "./dates";

// Local, on-device trip notifications — no push server needed. Under the
// "Reminders" toggle (syncTripReminders), a trip with dates gets three
// kinds, all sharing one capped, deduped schedule:
//   - a heads-up LEAD_MINUTES before each timed itinerary item
//   - a DIGEST_HOUR morning summary of each day's plan (specially worded
//     "starts today" on day 1)
//   - a PACK_REMINDER_HOUR reminder the evening before departure
// Two more fire automatically for every trip, independent of that toggle,
// since they're not itinerary-specific: a one-time "still planning?" nudge
// if a trip goes unplanned for a few days, and a "welcome back" nudge the
// day after a trip ends.
//
// Times are interpreted in the phone's current time zone, which is what a
// phone shows once it's landed at the destination.
//
// iOS keeps at most 64 pending local notifications per app, so each trip's
// Reminders schedules only its next MAX_PER_TRIP within whatever budget is
// left under MAX_APP_WIDE; the list is re-synced whenever the itinerary
// changes or the trip is opened. The lifecycle nudges below are one each,
// so they're not folded into that same per-trip budget check — a small
// simplification given there are far fewer of them than item reminders.

const LEAD_MINUTES = 60;
const DIGEST_HOUR = 7;
const PACK_REMINDER_HOUR = 18;
const MAX_PER_TRIP = 30;
const MAX_APP_WIDE = 64;
const CHANNEL_ID = "trip-reminders";
const KEY_PREFIX = "reminders:";
const PLANNING_NUDGE_PREFIX = "planningNudge:";
const POSTTRIP_NUDGE_PREFIX = "posttripNudge:";
const PLANNING_NUDGE_DELAY_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

type ReminderState = { enabled: boolean; ids: string[]; signature?: string };

let initialized = false;

export function initNotifications() {
  if (initialized) return;
  initialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    // Android 13+ won't show the permission prompt until a channel exists.
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Trip reminders",
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

async function readState(tripId: string): Promise<ReminderState> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + tripId);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { enabled: false, ids: [] };
}

async function writeState(tripId: string, state: ReminderState) {
  try {
    if (!state.enabled && state.ids.length === 0) await AsyncStorage.removeItem(KEY_PREFIX + tripId);
    else await AsyncStorage.setItem(KEY_PREFIX + tripId, JSON.stringify(state));
  } catch (e) {}
}

export async function areTripRemindersEnabled(tripId: string) {
  return (await readState(tripId)).enabled;
}

async function ensurePermission() {
  initNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function toLocalDate(date: string, time: string) {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(date + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

// How many reminders every *other* trip currently has scheduled, so one
// trip's sync can stay within the shared app-wide cap instead of only
// capping itself.
async function countOtherTripReminders(excludeTripId: string) {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const tripKeys = keys.filter((k) => k.startsWith(KEY_PREFIX) && k !== KEY_PREFIX + excludeTripId);
    if (!tripKeys.length) return 0;
    const entries = await AsyncStorage.multiGet(tripKeys);
    return entries.reduce((sum, [, raw]) => {
      if (!raw) return sum;
      try {
        const state: ReminderState = JSON.parse(raw);
        return sum + (state.ids?.length || 0);
      } catch (e) {
        return sum;
      }
    }, 0);
  } catch (e) {
    return 0;
  }
}

function signatureOf(reminders: { fireAt: Date; title: string }[]) {
  return reminders.map((r) => `${r.fireAt.getTime()}|${r.title}`).join(";");
}

function buildReminders(trip: any, limit: number) {
  const now = Date.now();
  const allItems = trip.itinerary || [];
  const timedItems = allItems.filter((it: any) => it.date && it.time);
  const days = trip.start_date && trip.end_date ? enumerateDates(trip.start_date, trip.end_date) : [];
  const entries: { fireAt: Date; title: string; body: string; tripId: string }[] = [];

  // 1) Heads-up LEAD_MINUTES before each timed item.
  for (const it of timedItems) {
    const startsAt = toLocalDate(it.date, it.time);
    if (!startsAt) continue;
    const fireAt = new Date(startsAt.getTime() - LEAD_MINUTES * 60 * 1000);
    if (fireAt.getTime() <= now) continue;
    entries.push({ fireAt, title: `In 1 hour: ${it.title}`, body: `${it.time} · ${trip.destination_name}`, tripId: trip.id });
  }

  // 2) One morning digest per day that's still ahead, summarizing the plan.
  const itemsByDate: Record<string, any[]> = {};
  for (const it of allItems) {
    if (!it.date) continue;
    (itemsByDate[it.date] ||= []).push(it);
  }
  days.forEach((date, i) => {
    const fireAt = toLocalDate(date, `${String(DIGEST_HOUR).padStart(2, "0")}:00`);
    if (!fireAt || fireAt.getTime() <= now) return;
    const dayItems = (itemsByDate[date] || []).slice().sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const isFirstDay = i === 0;
    let title: string;
    let body: string;
    if (dayItems.length === 0) {
      title = isFirstDay ? `Your trip to ${trip.destination_name} starts today!` : `Day ${i + 1} is wide open`;
      body = isFirstDay ? "Safe travels! Nothing's on the plan yet — add something from the Itinerary tab." : "Nothing planned — tap to add something.";
    } else {
      const first = dayItems[0];
      title = isFirstDay
        ? `Your trip to ${trip.destination_name} starts today!`
        : `Day ${i + 1}: ${dayItems.length} thing${dayItems.length > 1 ? "s" : ""} planned`;
      body = first.time ? `First up: ${first.time} · ${first.title}` : first.title;
    }
    entries.push({ fireAt, title, body, tripId: trip.id });
  });

  // 3) Pack reminder, the evening before departure.
  if (trip.start_date) {
    const dayBefore = new Date(new Date(trip.start_date + "T00:00:00").getTime() - 24 * 60 * 60 * 1000);
    const fireAt = new Date(dayBefore);
    fireAt.setHours(PACK_REMINDER_HOUR, 0, 0, 0);
    if (fireAt.getTime() > now) {
      entries.push({
        fireAt,
        title: `Pack for ${trip.destination_name} — you leave tomorrow!`,
        body: "Check your packing list before you go.",
        tripId: trip.id,
      });
    }
  }

  return entries.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, limit);
}

async function cancelIds(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

// Re-schedules a trip's reminders from its current itinerary. No-op if the
// user hasn't turned reminders on for this trip, and a no-op if nothing
// about the reminder set would actually change (e.g. a focus-triggered
// resync with no itinerary edits). Returns how many are set.
export async function syncTripReminders(trip: any) {
  const state = await readState(trip.id);
  if (!state.enabled) return 0;
  initNotifications();

  const otherCount = await countOtherTripReminders(trip.id);
  const budget = Math.max(0, Math.min(MAX_PER_TRIP, MAX_APP_WIDE - otherCount));
  const reminders = buildReminders(trip, budget);
  const signature = signatureOf(reminders);

  if (signature === state.signature && state.ids.length === reminders.length) {
    return state.ids.length;
  }

  await cancelIds(state.ids);
  const scheduled = await Promise.all(
    reminders.map((r) =>
      Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { tripId: r.tripId } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.fireAt,
          channelId: CHANNEL_ID,
        },
      }).catch(() => null)
    )
  );
  const ids = scheduled.filter((id): id is string => !!id);
  await writeState(trip.id, { enabled: true, ids, signature });
  return ids.length;
}

// Returns false if the user declined notification permission.
export async function enableTripReminders(trip: any) {
  if (!(await ensurePermission())) return { ok: false, count: 0 };
  const state = await readState(trip.id);
  await writeState(trip.id, { ...state, enabled: true });
  const count = await syncTripReminders(trip);
  return { ok: true, count };
}

export async function cancelTripReminders(tripId: string) {
  const state = await readState(tripId);
  await cancelIds(state.ids);
  await writeState(tripId, { enabled: false, ids: [] });
}

export async function cancelAllTripReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(
      keys.filter((k) => k.startsWith(KEY_PREFIX) || k.startsWith(PLANNING_NUDGE_PREFIX) || k.startsWith(POSTTRIP_NUDGE_PREFIX))
    );
  } catch (e) {}
}

async function hasNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  return current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

// Fires once, a few days after a trip is created with no start date yet,
// nudging the user back to finish planning it. Never prompts for
// permission itself — only schedules if it's already granted, since this
// runs automatically rather than from an explicit user action. Cancelled
// the moment a start date gets set (see cancelAbandonedPlanningNudge).
export async function scheduleAbandonedPlanningNudge(trip: any) {
  await cancelAbandonedPlanningNudge(trip.id);
  if (trip.start_date) return;
  if (!(await hasNotificationPermission())) return;
  initNotifications();
  const fireAt = new Date(Date.now() + PLANNING_NUDGE_DELAY_MS);
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Still planning?",
        body: `Your trip to ${trip.destination_name} is waiting to be finished — add dates to start building the itinerary.`,
        data: { tripId: trip.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
    });
    await AsyncStorage.setItem(PLANNING_NUDGE_PREFIX + trip.id, id);
  } catch (e) {}
}

export async function cancelAbandonedPlanningNudge(tripId: string) {
  try {
    const id = await AsyncStorage.getItem(PLANNING_NUDGE_PREFIX + tripId);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(PLANNING_NUDGE_PREFIX + tripId);
    }
  } catch (e) {}
}

// Fires the day after a trip ends, nudging the user back into the app to
// plan the next one. Rescheduled whenever end_date changes; same
// permission rule as the planning nudge above.
export async function schedulePostTripNudge(trip: any) {
  await cancelPostTripNudge(trip.id);
  if (!trip.end_date) return;
  if (!(await hasNotificationPermission())) return;
  initNotifications();
  const fireAt = new Date(trip.end_date + "T00:00:00");
  fireAt.setDate(fireAt.getDate() + 1);
  fireAt.setHours(11, 0, 0, 0);
  if (fireAt.getTime() <= Date.now()) return;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Welcome back from ${trip.destination_name}!`,
        body: "Ready to plan your next adventure?",
        data: {},
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
    });
    await AsyncStorage.setItem(POSTTRIP_NUDGE_PREFIX + trip.id, id);
  } catch (e) {}
}

export async function cancelPostTripNudge(tripId: string) {
  try {
    const id = await AsyncStorage.getItem(POSTTRIP_NUDGE_PREFIX + tripId);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(POSTTRIP_NUDGE_PREFIX + tripId);
    }
  } catch (e) {}
}
