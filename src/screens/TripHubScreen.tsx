import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, Wallet, ArrowLeftRight, Map as MapIcon, Luggage } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { getTrip, updateTrip } from "../lib/supabase";
import { getEffectiveStops, buildDatedStops } from "../lib/stops";
import PlaceBanner from "../components/PlaceBanner";
import ItineraryView from "../components/ItineraryView";
import BudgetView from "../components/BudgetView";
import ConvertView from "../components/ConvertView";

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
];

export default function TripHubScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { tripId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [tab, setTab] = useState("itinerary");

  useFocusEffect(
    useCallback(() => {
      getTrip(tripId).then(setTrip);
    }, [tripId])
  );

  const save = (field: string) => (value: any) => {
    setTrip((t: any) => ({ ...t, [field]: value }));
    updateTrip(tripId, { [field]: value });
  };

  const setTripDates = async (startDate: string) => {
    const stops = getEffectiveStops(trip).map((s: any) => ({ name: s.name, lat: s.lat, lng: s.lng, days: s.days || 1 }));
    const dated = buildDatedStops(stops, startDate);
    const endDate = dated[dated.length - 1]?.endDate || null;
    setTrip((t: any) => ({ ...t, start_date: startDate, end_date: endDate, stops: dated }));
    await updateTrip(tripId, { start_date: startDate, end_date: endDate, stops: dated });
  };

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
            updateTrip(tripId, { photo_url: url });
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

      <View style={{ flex: 1 }}>
        {tab === "itinerary" && <ItineraryView trip={trip} onSave={save("itinerary")} onSetDates={setTripDates} />}
        {tab === "budget" && <BudgetView trip={trip} onSave={save("budget")} />}
        {tab === "convert" && <ConvertView homeCurrency={trip.home_currency || "USD"} />}
        {(tab === "map" || tab === "pack") && (
          <View style={styles.center}>
            <Text style={styles.comingSoon}>{TRIP_TABS.find((t) => t.id === tab)?.label} is coming soon.</Text>
          </View>
        )}
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
