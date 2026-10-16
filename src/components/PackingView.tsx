import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Luggage, CheckCircle2, Circle } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { buildPackingCategories } from "../lib/constants";
import { getTripClimate } from "../lib/weather";
import ProgressRing from "./ProgressRing";

export default function PackingView({ trip, onSave }: { trip: any; onSave: (packing: Record<string, boolean>) => void }) {
  const checklist = trip.packing || {};
  const [climate, setClimate] = useState<any>(undefined); // undefined = loading, null = unavailable

  useEffect(() => {
    if (!trip.start_date) {
      setClimate(null);
      return;
    }
    let cancelled = false;
    setClimate(undefined);
    getTripClimate(trip.destination_lat, trip.destination_lng, trip.start_date, trip.end_date)
      .then((c: any) => !cancelled && setClimate(c))
      .catch(() => !cancelled && setClimate(null));
    return () => {
      cancelled = true;
    };
  }, [trip.destination_lat, trip.destination_lng, trip.start_date, trip.end_date]);

  const categories = useMemo(() => buildPackingCategories(climate || null), [climate]);

  const totalItems = useMemo(() => categories.reduce((sum, cat) => sum + cat.items.length, 0), [categories]);
  const checkedCount = useMemo(() => {
    let count = 0;
    categories.forEach((cat) => {
      cat.items.forEach((item) => {
        if (checklist[`pack-${cat.id}-${item}`]) count++;
      });
    });
    return count;
  }, [categories, checklist]);

  const pct = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  const toggle = (key: string) => onSave({ ...checklist, [key]: !checklist[key] });

  const climateNote = !trip.start_date
    ? "Add your trip dates in the Itinerary tab to get a climate-aware packing list."
    : climate === undefined
    ? "Checking the weather for this trip…"
    : climate === null || climate.avgHigh == null
    ? "Couldn't get weather data for this destination — showing a general list."
    : climate.source === "forecast"
    ? `Based on the live forecast (avg high ${Math.round(climate.avgHigh)}°C).`
    : `Based on typical weather for these dates (avg high ${Math.round(climate.avgHigh)}°C).`;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.climateNote}>{climateNote}</Text>

      <View style={styles.progressRow}>
        <ProgressRing pct={pct} />
        <View>
          <Text style={styles.progressCount}>
            {checkedCount} / {totalItems} packed
          </Text>
          <Text style={styles.progressHint}>Tap items below to check them off.</Text>
        </View>
      </View>

      {categories.map((cat) => (
        <View key={cat.id} style={{ marginBottom: spacing(5) }}>
          <View style={styles.sectionHeader}>
            <Luggage size={15} color={colors.textPrimary} />
            <Text style={styles.sectionTitle}>{cat.title}</Text>
          </View>
          <View style={{ gap: spacing(1.5) }}>
            {cat.items.map((item) => {
              const key = `pack-${cat.id}-${item}`;
              const checked = !!checklist[key];
              return (
                <TouchableOpacity key={key} style={styles.row} onPress={() => toggle(key)}>
                  {checked ? <CheckCircle2 size={16} color={colors.primaryBg} /> : <Circle size={16} color={colors.iconEmpty} />}
                  <Text style={[styles.rowText, checked && styles.rowTextChecked]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  climateNote: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing(4) },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing(4), marginBottom: spacing(5) },
  progressCount: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  progressHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginBottom: spacing(2) },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { fontSize: 14, color: colors.textBody },
  rowTextChecked: { color: colors.textFaint, textDecorationLine: "line-through" },
});
