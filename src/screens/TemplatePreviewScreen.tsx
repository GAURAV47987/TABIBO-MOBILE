import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { X, Camera, Utensils, Sparkles } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { createTrip, updateTrip } from "../lib/supabase";
import { buildDatedStops } from "../lib/stops";
import { enumerateDates } from "../lib/dates";
import PlaceBanner from "../components/PlaceBanner";
import DateField from "../components/DateField";

export default function TemplatePreviewScreen({ route, navigation }: any) {
  const { template } = route.params;
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totalDays = template.stops.reduce((sum: number, s: any) => sum + s.days, 0);

  const useTemplate = async () => {
    if (!startDate) return;
    setBusy(true);
    setError("");
    try {
      const dated = buildDatedStops(template.stops, startDate);
      const endDate = dated[dated.length - 1].endDate;
      const calendarDates = enumerateDates(startDate, endDate);
      const itinerary: any[] = [];
      template.days.forEach((day: any) => {
        const date = calendarDates[day.day - 1];
        if (!date) return;
        day.items.forEach((item: any) => {
          itinerary.push({ id: randomUUID(), date, ...item });
        });
      });
      const trip = await createTrip({
        destinationName: template.name,
        lat: dated[0].lat,
        lng: dated[0].lng,
        startDate,
        endDate,
        homeCurrency: "USD",
        stops: dated,
      });
      await updateTrip(trip.id, { itinerary });
      navigation.replace("MainTabs", { screen: "Trips" });
    } catch (err: any) {
      setError(err.message || "Could not create trip");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
        <PlaceBanner placeName={template.stops[0].name} height={180}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <X size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{template.name}</Text>
            <Text style={styles.bannerDays}>{totalDays} days</Text>
          </View>
        </PlaceBanner>

        <View style={{ padding: spacing(4) }}>
          <Text style={styles.tagline}>{template.tagline}</Text>
          <Text style={styles.stopsLine}>{template.stops.map((s: any) => `${s.name} (${s.days}d)`).join(" → ")}</Text>

          {template.days.map((day: any) => (
            <View key={day.day} style={styles.dayCard}>
              <Text style={styles.dayTitle}>Day {day.day}</Text>
              <View style={{ gap: spacing(2) }}>
                {day.items.map((item: any, i: number) => (
                  <View key={i} style={styles.item}>
                    <View style={styles.itemRow}>
                      {item.type === "photo" && <Camera size={14} color={colors.stamp} />}
                      {item.type === "food" && <Utensils size={14} color={colors.textSecondary} />}
                      {item.time ? <Text style={styles.itemTime}>{item.time}</Text> : null}
                      <Text style={styles.itemTitle}>{item.title}</Text>
                    </View>
                    {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>When are you starting?</Text>
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <DateField value={startDate} onChange={setStartDate} />
          </View>
          <TouchableOpacity style={[styles.useButton, (busy || !startDate) && { opacity: 0.5 }]} onPress={useTemplate} disabled={busy || !startDate}>
            <Sparkles size={14} color="#fff" />
            <Text style={styles.useButtonText}>{busy ? "Creating…" : "Use this"}</Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: { position: "absolute", top: spacing(3), right: spacing(3), zIndex: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, padding: spacing(1.5) },
  bannerText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing(4) },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  bannerDays: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  tagline: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing(3) },
  stopsLine: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(5) },
  dayCard: { padding: spacing(4), borderRadius: radius.lg, marginBottom: spacing(3), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dayTitle: { fontWeight: "600", color: colors.textPrimary, marginBottom: spacing(2) },
  item: { paddingHorizontal: spacing(3), paddingVertical: spacing(2), borderRadius: radius.md, backgroundColor: colors.bg },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  itemTime: { fontWeight: "600", color: colors.textBody },
  itemTitle: { color: colors.textBody, flexShrink: 1 },
  itemNotes: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLabel: { fontSize: 14, color: colors.textTertiary, marginBottom: spacing(1) },
  footerRow: { flexDirection: "row", gap: spacing(2), alignItems: "center" },
  useButton: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), backgroundColor: colors.stamp, borderRadius: radius.md, paddingHorizontal: spacing(4), paddingVertical: spacing(2.8) },
  useButtonText: { color: "#fff", fontWeight: "600" },
  errorText: { color: colors.stamp, fontSize: 13, marginTop: spacing(2) },
});
