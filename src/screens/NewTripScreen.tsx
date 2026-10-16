import { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { X, Sparkles } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { createTrip } from "../lib/supabase";
import { searchPlaces } from "../lib/geonames";
import { geocodeDestination } from "../lib/geocode";
import { buildDatedStops } from "../lib/stops";
import { CURRENCIES } from "../lib/constants";
import DateField from "../components/DateField";

export default function NewTripScreen({ navigation }: any) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [days, setDays] = useState("5");
  const [startDate, setStartDate] = useState("");
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<any>(null);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setPicked(null);
    clearTimeout(timerRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(text);
        setSuggestions(results);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const create = async () => {
    setError("");
    setBusy(true);
    try {
      let place = picked;
      if (!place) {
        if (!query.trim()) throw new Error("Enter a destination");
        place = await geocodeDestination(query.trim());
      }
      const stops = [{ name: place.name, lat: place.lat, lng: place.lng, days: Math.max(1, parseInt(days, 10) || 1) }];
      const dated = buildDatedStops(stops, startDate || null);
      const endDate = dated[dated.length - 1]?.endDate || null;
      await createTrip({
        destinationName: place.name,
        lat: dated[0].lat,
        lng: dated[0].lng,
        startDate: startDate || null,
        endDate,
        homeCurrency,
        stops: dated,
      });
      navigation.replace("MainTabs", { screen: "Trips" });
    } catch (err: any) {
      setError(err.message || "Could not create trip");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New trip</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
        <Text style={styles.label}>Where are you going?</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="e.g. Bali, or Japan"
          placeholderTextColor={colors.textFaint}
        />
        {searching && <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primaryBg} />}
        {suggestions.length > 0 && (
          <View style={styles.suggestions}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionBorder]}
                onPress={() => {
                  setPicked(s);
                  setQuery(s.label);
                  setSuggestions([]);
                }}
              >
                <Text style={styles.suggestionText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.label, { marginTop: spacing(4) }]}>How many days?</Text>
        <TextInput
          style={styles.input}
          value={days}
          onChangeText={setDays}
          keyboardType="number-pad"
        />

        <Text style={[styles.label, { marginTop: spacing(4) }]}>Start date (optional)</Text>
        <DateField value={startDate} onChange={setStartDate} placeholder="Not sure yet? Skip this" />

        <Text style={[styles.label, { marginTop: spacing(4) }]}>Home currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing(2) }}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setHomeCurrency(c)}
              style={[styles.currencyChip, homeCurrency === c && styles.currencyChipActive]}
            >
              <Text style={[styles.currencyChipText, homeCurrency === c && styles.currencyChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={[styles.createButton, busy && { opacity: 0.6 }]} onPress={create} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : (
            <>
              <Sparkles size={16} color="#fff" />
              <Text style={styles.createButtonText}>Create trip</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
    paddingBottom: spacing(3),
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  label: { fontSize: 14, color: colors.textTertiary, marginBottom: spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textBody,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 16,
  },
  suggestions: {
    marginTop: spacing(1),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  suggestionRow: { paddingHorizontal: spacing(3), paddingVertical: spacing(2.5) },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  suggestionText: { color: colors.textBody, fontSize: 14 },
  currencyChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing(2),
  },
  currencyChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBg },
  currencyChipText: { fontSize: 13, color: colors.textBody },
  currencyChipTextActive: { color: colors.primaryText, fontWeight: "600" },
  errorText: { color: colors.stamp, fontSize: 13, marginTop: spacing(3) },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    backgroundColor: colors.stamp,
    borderRadius: radius.lg,
    paddingVertical: spacing(3.5),
    marginTop: spacing(5),
  },
  createButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
