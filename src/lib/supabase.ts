import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "expo-crypto";
import { cancelAllTripReminders, cancelTripReminders, cancelAbandonedPlanningNudge, cancelPostTripNudge } from "./reminders";

// Same Supabase project as the web app (src/supabase.js in the TABIGO
// repo) — one shared backend behind both the PWA and this native app.
const SUPABASE_URL = "https://lkfyahpzqciruydzwxim.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Q08ycjx2uonvfHwwi62oyQ_9UkmCj1o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  // Confirm the server-side sign-out first — if it fails (offline, say),
  // the session is still live and the local cache/reminders are still
  // valid, so nothing should be thrown away yet.
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await clearLocalUserData();
}

// Everything this device holds about the signed-in user beyond the auth
// session itself: offline trip copies and scheduled trip reminders.
async function clearLocalUserData() {
  await clearTripCache();
  await cancelAllTripReminders();
}

// Permanently deletes the signed-in user's account and everything in it
// (App Store Guideline 5.1.1(v)). Storage files go first through the
// Storage API — SQL can't delete them — then the delete_my_account RPC
// (supabase/add_account_deletion_and_documents.sql) removes the trips and
// the auth user itself.
export async function deleteMyAccount() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const docPaths = await listAllDocumentPaths(user.id);
  if (docPaths.length) {
    const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove(docPaths);
    if (error) throw error;
  }
  // No avatar is fine — remove() just reports nothing removed when the
  // object doesn't exist. A real failure (network, permissions) still
  // needs to stop deletion, same as the documents removal above.
  const { error: avatarError } = await supabase.storage.from(AVATARS_BUCKET).remove([user.id]);
  if (avatarError) throw avatarError;

  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;

  await clearLocalUserData();
  // The user no longer exists server-side, so only clear the local session.
  await supabase.auth.signOut({ scope: "local" });
}

// The actual reset happens on the web app (completing it natively here
// would need deep-link config that's fragile to test before a real EAS
// build exists) — this just emails a link that opens the web app, where
// the user sets a new password, then comes back and signs in here as usual.
export async function resetPasswordForEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://gaurav47987.github.io/TABIGO/",
  });
  if (error) throw error;
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

// Same bucket/filename convention as the web app (src/supabase.js) — the
// object's filename is always the user's own id, so re-uploading replaces
// the old photo and the public URL never changes.
export function getAvatarUrl(userId: string) {
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(userId);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// expo-image-picker hands back a local file URI, not a File/Blob — fetch()
// against that URI and read it as an ArrayBuffer is the standard React
// Native way to get bytes Supabase storage's upload() will accept.
export async function uploadAvatar(uri: string, mimeType: string) {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_AVATAR_SIZE) throw new Error("Photo is too large (max 5MB)");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(user.id, arrayBuffer, {
    upsert: true,
    contentType: mimeType,
  });
  if (error) throw error;
  return getAvatarUrl(user.id);
}

export async function getCurrentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export function onAuthStateChange(callback: (session: any) => void) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}

export async function createTrip({
  destinationName,
  lat,
  lng,
  startDate,
  endDate,
  homeCurrency,
  stops,
}: {
  destinationName: string;
  lat: number;
  lng: number;
  startDate?: string | null;
  endDate?: string | null;
  homeCurrency?: string;
  stops?: any[];
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination_name: destinationName,
      destination_lat: lat,
      destination_lng: lng,
      start_date: startDate || null,
      end_date: endDate || null,
      home_currency: homeCurrency || "USD",
      stops: stops || [],
      itinerary: [],
      budget: [],
      packing: {},
      map_pins: [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Offline copies -------------------------------------------------------
// The last successfully loaded trips list and each opened trip are kept in
// AsyncStorage, so the itinerary (and documents' confirmation numbers)
// stay viewable with no signal. Cleared on sign-out / account deletion.
const TRIP_CACHE_PREFIX = "tripCache:";
const TRIP_LIST_CACHE_KEY = TRIP_CACHE_PREFIX + "list";

async function clearTripCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(TRIP_CACHE_PREFIX)));
  } catch (e) {}
}

async function readCache(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeCache(key: string, value: any) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

export type Cached<T> = { data: T; fromCache: boolean };

export async function loadTrips(): Promise<Cached<any[]>> {
  try {
    const data = await listTrips();
    writeCache(TRIP_LIST_CACHE_KEY, data);
    return { data, fromCache: false };
  } catch (err) {
    const cached = await readCache(TRIP_LIST_CACHE_KEY);
    if (cached) return { data: cached, fromCache: true };
    throw err;
  }
}

export async function loadTrip(id: string): Promise<Cached<any>> {
  try {
    const data = await getTrip(id);
    writeCache(TRIP_CACHE_PREFIX + id, data);
    return { data, fromCache: false };
  } catch (err) {
    const cached = await readCache(TRIP_CACHE_PREFIX + id);
    if (cached) return { data: cached, fromCache: true };
    throw err;
  }
}

// Keeps the offline copy in step with a successful edit.
export async function patchCachedTrip(id: string, fields: Record<string, any>) {
  const cached = await readCache(TRIP_CACHE_PREFIX + id);
  if (cached) writeCache(TRIP_CACHE_PREFIX + id, { ...cached, ...fields });
}

export async function listTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select("id, user_id, destination_name, destination_lat, destination_lng, start_date, end_date, stops, photo_url, created_at")
    .order("start_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

// Admin-only: every trip from every user, with the owner's email. The
// admin_list_trips function checks the caller's email server-side before
// returning anything, so this fails for anyone else regardless of what
// the client sends.
export async function listAllTripsAsAdmin() {
  const { data, error } = await supabase.rpc("admin_list_trips");
  if (error) throw error;
  return data;
}

export async function getTrip(id: string) {
  const { data, error } = await supabase.from("trips").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function updateTrip(id: string, fields: Record<string, any>) {
  const { error } = await supabase
    .from("trips")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTrip(id: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const paths = await listDocumentPaths(user.id, id);
    if (paths.length) {
      const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
      if (error) throw error;
    }
  }
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw error;
  AsyncStorage.removeItem(TRIP_CACHE_PREFIX + id).catch(() => {});
  await cancelTripReminders(id);
  await cancelAbandonedPlanningNudge(id);
  await cancelPostTripNudge(id);
}

// ---- Sharing / collaboration -----------------------------------------
// See supabase/add_trip_collaborators.sql (in the TABIGO web repo) — every
// write here goes through a security-definer RPC, never a direct table
// write, so a client can only ever read a collaborator row, not tamper
// with its own role while accepting an invite.

export type TripRole = "owner" | "editor" | "viewer";

// Whichever of owner/editor/viewer is most permissive for this trip and
// session — "viewer" if an accepted collaborator row exists but isn't
// resolved yet, since that's the safe default while loading.
export async function getMyTripRole(trip: { id: string; user_id: string }): Promise<TripRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "viewer";
  if (trip.user_id === user.id) return "owner";
  const { data } = await supabase
    .from("trip_collaborators")
    .select("role")
    .eq("trip_id", trip.id)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  return data?.role === "editor" ? "editor" : "viewer";
}

export async function inviteTripCollaborator(tripId: string, email: string, role: "editor" | "viewer") {
  const { error } = await supabase.rpc("invite_trip_collaborator", { p_trip_id: tripId, p_email: email, p_role: role });
  if (error) throw error;
}

export async function updateCollaboratorRole(collaboratorId: string, role: "editor" | "viewer") {
  const { error } = await supabase.rpc("update_trip_collaborator_role", { p_collaborator_id: collaboratorId, p_role: role });
  if (error) throw error;
}

export async function removeCollaborator(collaboratorId: string) {
  const { error } = await supabase.rpc("remove_trip_collaborator", { p_collaborator_id: collaboratorId });
  if (error) throw error;
}

export async function listTripCollaborators(tripId: string) {
  const { data, error } = await supabase.rpc("list_trip_collaborators", { p_trip_id: tripId });
  if (error) throw error;
  return data as { id: string; role: string; status: string; email: string }[];
}

export async function listMyPendingInvites() {
  const { data, error } = await supabase.rpc("list_my_pending_invites");
  if (error) throw error;
  return data as { collaborator_id: string; trip_id: string; destination_name: string; role: string; invited_by_email: string }[];
}

export async function acceptTripInvite(tripId: string) {
  const { error } = await supabase.rpc("accept_trip_invite", { p_trip_id: tripId });
  if (error) throw error;
}

export async function declineTripInvite(tripId: string) {
  const { error } = await supabase.rpc("decline_trip_invite", { p_trip_id: tripId });
  if (error) throw error;
}

export async function leaveTrip(tripId: string) {
  const { error } = await supabase.rpc("leave_trip", { p_trip_id: tripId });
  if (error) throw error;
}

// ---- Trip documents -------------------------------------------------------
// Private bucket; files live at "<user id>/<trip id>/<uuid>-<name>" (see
// supabase/add_account_deletion_and_documents.sql for the RLS policies).
// Metadata (title, confirmation number…) lives in trips.documents.
const DOCUMENTS_BUCKET = "trip-documents";
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB, matches the bucket limit

// A failed list() must not be mistaken for "no documents" — deleteMyAccount
// and deleteTrip both rely on an empty array here meaning there is
// genuinely nothing to remove, so a real error has to throw instead.
async function listDocumentPaths(userId: string, tripId: string) {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).list(`${userId}/${tripId}`, { limit: 1000 });
  if (error) throw error;
  return (data || []).map((f) => `${userId}/${tripId}/${f.name}`);
}

async function listAllDocumentPaths(userId: string) {
  const { data: folders, error } = await supabase.storage.from(DOCUMENTS_BUCKET).list(userId, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const folder of folders || []) {
    paths.push(...(await listDocumentPaths(userId, folder.name)));
  }
  return paths;
}

export async function uploadTripDocument(tripId: string, file: { uri: string; name: string; mimeType: string }) {
  const response = await fetch(file.uri);
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOCUMENT_SIZE) throw new Error("File is too large (max 10MB)");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const path = `${user.id}/${tripId}/${randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, arrayBuffer, {
    contentType: file.mimeType,
  });
  if (error) throw error;
  return path;
}

export async function getTripDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteTripDocumentFile(path: string) {
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) throw error;
}

// Shared app-wide photo cache (see supabase/add_place_photos_cache.sql in
// the web repo) — a photo found for one trip is reused by every trip,
// any user, asking about the same place name from then on.
export async function getCachedPlacePhoto(name: string) {
  const { data, error } = await supabase.from("place_photos").select("photo_url").eq("name", name).maybeSingle();
  if (error) return undefined;
  return data ? data.photo_url : undefined;
}

export async function cachePlacePhoto(name: string, photoUrl: string) {
  await supabase.from("place_photos").upsert({ name, photo_url: photoUrl, resolved_at: new Date().toISOString() });
}

async function friendlyFunctionError(error: any) {
  try {
    const body = await error?.context?.json();
    if (body?.error) return new Error(body.error);
  } catch (e) {}
  return error;
}

// Deployed under the name "rapid-function" (its creation template's route
// stuck even after the function was renamed) — same backend function the
// web app calls.
export async function generateItinerary({ stops }: { stops: { name: string; days: number }[] }) {
  const { data, error } = await supabase.functions.invoke("rapid-function", { body: { stops } });
  if (error) throw await friendlyFunctionError(error);
  if (data?.error) throw new Error(data.error);
  return data; // { days: [{ day, items: [{ time, title, notes, type }] }] }
}

// Shared cache (place_suggestions table) the same way place_photos is —
// only the first person asking about a destination pays the Gemini-call
// cost, everyone after gets it instantly. Same backend function as web.
export async function suggestPopularPlaces(destination: string) {
  const key = destination.trim().toLowerCase();
  try {
    const { data: cached } = await supabase.from("place_suggestions").select("places").eq("name", key).maybeSingle();
    if (cached) return cached.places;
  } catch (e) {
    // Shared cache unreachable — fall through to a live call.
  }

  const { data, error } = await supabase.functions.invoke("rapid-function", {
    body: { mode: "suggest_places", destination },
  });
  if (error) throw await friendlyFunctionError(error);
  if (data?.error) throw new Error(data.error);
  const places = data.places; // [{ name, reason }]
  supabase.from("place_suggestions").upsert({ name: key, places }).then(
    () => {},
    () => {}
  );
  return places;
}
