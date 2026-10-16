import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";
import { generateItinerary } from "../lib/supabase";
import { getEffectiveStops } from "../lib/stops";
import { enumerateDates } from "../lib/dates";
import { randomUUID } from "expo-crypto";

export default function AIGenerateCard({ trip, onGenerated }: { trip: any; onGenerated: (items: any[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const effectiveStops = getEffectiveStops(trip);
      const dates = enumerateDates(trip.start_date, trip.end_date);
      const totalDays = dates.length;
      const result = await generateItinerary({
        stops: effectiveStops.map((s: any) => ({ name: s.name, days: s.days || totalDays })),
      });
      const newItems: any[] = [];
      (result.days || []).forEach((day: any) => {
        const date = dates[day.day - 1];
        if (!date) return;
        (day.items || []).forEach((item: any) => {
          newItems.push({
            id: randomUUID(),
            date,
            time: item.time || "",
            title: item.title || "",
            notes: item.notes || "",
            type: item.type || "activity",
          });
        });
      });
      onGenerated(newItems);
    } catch (err: any) {
      setError(err.message || "Could not generate itinerary");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>✨ Generate itinerary with AI</Text>
      <Text style={styles.subtitle}>Draft a full day-by-day plan for this trip automatically, including a must-visit photo spot.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.button, busy && { opacity: 0.6 }]} onPress={generate} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Generating…" : "Generate itinerary"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing(4),
    borderRadius: radius.lg,
    marginBottom: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.tape,
  },
  title: {
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing(1),
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing(3),
  },
  error: {
    color: colors.stamp,
    fontSize: 13,
    marginBottom: spacing(3),
  },
  button: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: "center",
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: "600",
  },
});
