import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, Wallet, ArrowLeftRight, Map as MapIcon, Luggage, FileText, WifiOff } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { loadTrip, updateTrip, patchCachedTrip } from "../lib/supabase";
import { syncTripReminders } from "../lib/reminders";
import { getEffectiveStops, buildDatedStops } from "../lib/stops";
import PlaceBanner from "../components/PlaceBanner";
import ItineraryView from "../components/ItineraryView";
import BudgetView from "../components/BudgetView";
import ConvertView from "../components/ConvertView";
import TripMapView from "../components/TripMapView";
import PackingView from "../components/PackingView";
import DocumentsView from "../components/DocumentsView";

function dateRangeLabel(start?: string | null, end?: string | null) {
  return start && end ? `${start} — ${end}` : "Dates not set yet";
}

function photoQuery(trip: any) {
  return getEffectiveStops(trip)[0]?.name || trip.destination_name;
}

const TRIP_TABS = [
  { id: "itinerary", label: "Itinerary", Icon: Calendar },
  { id: "budget", label: "Budget", Icon: Wallet },
  { id: "convert", label: "Convert", Icon: ArrowLeftRight },
  { id: "map", label: "Map", Icon: MapIcon },
  { id: "pack", label: "Pack", Icon: Luggage },
  { id: "docs", label: "Docs", Icon: FileText },
];

export default function TripHubScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [tab, setTab] = useState("itinerary");
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadTrip(tripId).then(
        ({ data, fromCache }) => {
          setTrip(data);
          setOffline(fromCache);
          setLoadError("");
          syncTripReminders(data);
        },
        (err) => setLoadError(err.message || "Could not load this trip")
      );
    }, [tripId])
  );

  // Optimistic: the UI updates immediately; if the write fails (usually no
  // signal) the change is rolled back and the user is told, rather than it
  // silently vanishing on the next reload.
  const persist = async (fields: Record<string, any>) => {
    const before = trip;
    const next = { ...trip, ...fields };
    setTrip(next);
    try {
      await updateTrip(tripId, fields);
      patchCachedTrip(tripId, fields);
      setOffline(false);
      if ("itinerary" in fields || "start_date" in fields) syncTripReminders(next);
    } catch (err: any) {
      setTrip(before);
      setOffline(true);
      Alert.alert("Not saved", "You appear to be offline. Your trip is viewable, but changes need a connection.");
      throw err;
    }
  };

  const save = (field: string) => (value: any) => {
    persist({ [field]: value }).catch(() => {});
  };

  const setTripDates = async (startDate: string) => {
    const stops = getEffectiveStops(trip).map((s: any) => ({ name: s.name, lat: s.lat, lng: s.lng, days: s.days || 1 }));
    const dated = buildDatedStops(stops, startDate);
    const endDate = dated[dated.length - 1]?.endDate || null;
    await persist({ start_date: startDate, end_date: endDate, stops: dated }).catch(() => {});
  };

  if (!trip && loadError) {
    return (
      <SafeAreaView style={styles.center}>
        <WifiOff size={28} color={colors.textMuted} />
        <Text style={[styles.comingSoon, { marginTop: spacing(2), textAlign: "center", paddingHorizontal: spacing(6) }]}>
          {loadError}. Open this trip once while online to keep a copy for offline use.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing(4) }}>
          <Text style={{ color: colors.textSecondary, textDecorationLine: "underline" }}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryBg} size="large" />
      </View>
    );
  }

  const stops = getEffectiveStops(trip);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.bannerWrap}>
        <PlaceBanner
          placeName={photoQuery(trip)}
          savedUrl={trip.photo_url}
          onResolved={(url) => {
            setTrip((t: any) => ({ ...t, photo_url: url }));
            updateTrip(tripId, { photo_url: url }).catch(() => {});
          }}
          height={160}
          style={{ borderRadius: radius.lg }}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← My trips</Text>
          </TouchableOpacity>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{trip.destination_name}</Text>
            <Text style={styles.bannerDate}>{dateRangeLabel(trip.start_date, trip.end_date)}</Text>
            {stops.length > 1 && (
              <Text style={styles.bannerStops} numberOfLines={1}>
                {stops.map((s: any) => `${s.name} (${s.days}d)`).join(" → ")}
              </Text>
            )}
          </View>
        </PlaceBanner>
      </View>

      {offline && (
        <View style={styles.offlineBar}>
          <WifiOff size={14} color={colors.textSecondary} />
          <Text style={styles.offlineText}>Offline — showing your saved copy</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tab === "itinerary" && <ItineraryView trip={trip} onSave={save("itinerary")} onSetDates={setTripDates} />}
        {tab === "budget" && <BudgetView trip={trip} onSave={save("budget")} />}
        {tab === "convert" && <ConvertView homeCurrency={trip.home_currency || "USD"} />}
        {tab === "map" && <TripMapView trip={trip} onSave={save("map_pins")} />}
        {tab === "pack" && <PackingView trip={trip} onSave={save("packing")} />}
        {tab === "docs" && <DocumentsView trip={trip} offline={offline} onSave={(docs) => persist({ documents: docs })} />}
      </View>

      <View style={styles.tabBar}>
        {TRIP_TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.Icon;
          return (
            <TouchableOpacity key={t.id} style={styles.tabButton} onPress={() => setTab(t.id)}>
              <Icon size={20} color={active ? colors.stamp : colors.textMuted} strokeWidth={active ? 2.5 : 2} />
              <Text style={[styles.tabLabel, { color: active ? colors.stamp : colors.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bannerWrap: { margin: spacing(4) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  comingSoon: { color: colors.textSecondary },
  backButton: { position: "absolute", top: spacing(3), left: spacing(3), zIndex: 10 },
  backText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  bannerText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing(4) },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  bannerDate: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2 },
  bannerStops: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  offlineBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    marginHorizontal: spacing(4),
    marginTop: -spacing(2),
    marginBottom: spacing(1),
  },
  offlineText: { fontSize: 12, color: colors.textSecondary },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing(1.5),
    paddingBottom: spacing(1),
  },
  tabButton: { flex: 1, alignItems: "center", gap: 2, paddingVertical: spacing(1) },
  tabLabel: { fontSize: 11, fontWeight: "500" },
});
