import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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

export async function listTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select("id, destination_name, destination_lat, destination_lng, start_date, end_date, stops, photo_url, created_at")
    .order("start_date", { ascending: true, nullsFirst: false });
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
  const { error } = await supabase.from("trips").delete().eq("id", id);
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
