import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { enumerateDates } from "./dates";

// Local, on-device reminders for itinerary items — no push server needed.
// Each timed itinerary item gets a heads-up LEAD_MINUTES before it starts;
// the first timed item of each day reads "Day N starts in 1 hour".
//
// Times are interpreted in the phone's current time zone, which is what a
// phone shows once it's landed at the destination.
//
// iOS keeps at most 64 pending local notifications per app, so each trip
// schedules only its next MAX_PER_TRIP reminders; the list is re-synced
// whenever the itinerary changes or the trip is opened.

const LEAD_MINUTES = 60;
const MAX_PER_TRIP = 30;
const CHANNEL_ID = "trip-reminders";
const KEY_PREFIX = "reminders:";

type ReminderState = { enabled: boolean; ids: string[] };

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

function buildReminders(trip: any) {
  const items = (trip.itinerary || []).filter((it: any) => it.date && it.time);
  const days = trip.start_date && trip.end_date ? enumerateDates(trip.start_date, trip.end_date) : [];
  const firstTimeByDate: Record<string, string> = {};
  for (const it of items) {
    if (!firstTimeByDate[it.date] || it.time < firstTimeByDate[it.date]) firstTimeByDate[it.date] = it.time;
  }

  const now = Date.now();
  return items
    .map((it: any) => {
      const startsAt = toLocalDate(it.date, it.time);
      if (!startsAt) return null;
      const fireAt = new Date(startsAt.getTime() - LEAD_MINUTES * 60 * 1000);
      if (fireAt.getTime() <= now) return null;
      const dayIndex = days.indexOf(it.date);
      const isDayStart = firstTimeByDate[it.date] === it.time && dayIndex >= 0;
      return {
        fireAt,
        title: isDayStart ? `Day ${dayIndex + 1} starts in 1 hour` : `In 1 hour: ${it.title}`,
        body: `${it.time} · ${isDayStart ? it.title : trip.destination_name}`,
        tripId: trip.id,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.fireAt.getTime() - b.fireAt.getTime())
    .slice(0, MAX_PER_TRIP) as { fireAt: Date; title: string; body: string; tripId: string }[];
}

async function cancelIds(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

// Re-schedules a trip's reminders from its current itinerary. No-op if the
// user hasn't turned reminders on for this trip. Returns how many are set.
export async function syncTripReminders(trip: any) {
  const state = await readState(trip.id);
  if (!state.enabled) return 0;
  initNotifications();
  await cancelIds(state.ids);
  const ids: string[] = [];
  for (const r of buildReminders(trip)) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { tripId: r.tripId } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.fireAt,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
    } catch (e) {}
  }
  await writeState(trip.id, { enabled: true, ids });
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
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(KEY_PREFIX)));
  } catch (e) {}
}
