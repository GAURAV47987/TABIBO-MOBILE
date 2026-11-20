import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { X, Check, Plus, Sparkles } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { createTrip, suggestPopularPlaces } from "../lib/supabase";
import { searchPlaces } from "../lib/geonames";
import { geocodeDestination } from "../lib/geocode";
import { buildDatedStops } from "../lib/stops";
import { getTripClimate } from "../lib/weather";
import { CURRENCIES } from "../lib/constants";
import DateField from "../components/DateField";
import PlaceBanner from "../components/PlaceBanner";
import PressScale from "../components/PressScale";
import { haptics } from "../lib/haptics";
import { scheduleAbandonedPlanningNudge, schedulePostTripNudge } from "../lib/reminders";

const STEPS = ["Destination", "Dates", "Route", "Add-ons"];

type Stop = { name: string; lat: number; lng: number; days: number };

function PlaceAutocomplete({
  value,
  onChangeText,
  onPick,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onPick: (place: { name: string; lat: number; lng: number }) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<any>(null);

  const handleInput = (text: string) => {
    onChangeText(text);
    clearTimeout(timerRef.current);
    setError("");
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchPlaces(text);
        setSuggestions(results);
        if (!results.length) setError("No matches found for that search.");
      } catch (err: any) {
        setSuggestions([]);
        setError(err.message || "Place search failed");
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        autoFocus={autoFocus}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={handleInput}
      />
      {loading && <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primaryBg} />}
      {!loading && error ? <Text style={styles.hintText}>{error}</Text> : null}
      {!loading && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestionRow, i < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => {
                onPick(s);
                setSuggestions([]);
              }}
            >
              <Text style={styles.suggestionText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function JourneyStrip({ stops, onChangeDays, onRemove }: { stops: Stop[]; onChangeDays: (i: number, delta: number) => void; onRemove: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing(1) }}>
      {stops.map((s, i) => (
        <View key={`${s.name}-${i}`} style={styles.stopWrap}>
          <View style={styles.stopDot} />
          <Text style={styles.stopName} numberOfLines={2}>{s.name}</Text>
          <View style={styles.stopDaysRow}>
            <TouchableOpacity style={styles.stepperButton} onPress={() => onChangeDays(i, -1)}>
              <Text style={styles.stepperText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stopDaysLabel}>{s.days}d</Text>
            <TouchableOpacity style={styles.stepperButton} onPress={() => onChangeDays(i, 1)}>
              <Text style={styles.stepperText}>+</Text>
            </TouchableOpacity>
          </View>
          {stops.length > 1 && (
            <TouchableOpacity onPress={() => onRemove(i)}>
              <Text style={styles.removeLink}>remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

export default function NewTripScreen({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [stops, setStops] = useState<Stop[]>([]);
  const [pendingName, setPendingName] = useState("");
  const [addingStop, setAddingStop] = useState(false);
  const [newStopName, setNewStopName] = useState("");
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [totalDays, setTotalDays] = useState(7);
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [climate, setClimate] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [geocodingName, setGeocodingName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const changeDays = (i: number, delta: number) => {
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, days: Math.max(1, s.days + delta) } : s)));
  };
  const removeStop = (i: number) => setStops((prev) => prev.filter((_, idx) => idx !== i));

  const pickFirstPlace = (place: { name: string; lat: number; lng: number }) => {
    setError("");
    setStops([{ name: place.name, lat: place.lat, lng: place.lng, days: 3 }]);
    setStep(2);
  };

  const continueStep1 = async () => {
    if (!pendingName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const place = await geocodeDestination(pendingName.trim());
      setStops([{ name: pendingName.trim(), lat: place.lat, lng: place.lng, days: 3 }]);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Could not find that place");
    } finally {
      setBusy(false);
    }
  };

  const addStop = async (place: { name: string; lat: number; lng: number }) => {
    setStops((prev) => [...prev, { name: place.name, lat: place.lat, lng: place.lng, days: 2 }]);
    setAddingStop(false);
    setNewStopName("");
  };

  useEffect(() => {
    if (step !== 2 || !startDate || !stops[0]) {
      setClimate(null);
      return;
    }
    let cancelled = false;
    const dated = buildDatedStops(stops, startDate);
    getTripClimate(stops[0].lat, stops[0].lng, startDate, dated[dated.length - 1].endDate)
      .then((c: any) => !cancelled && setClimate(c))
      .catch(() => !cancelled && setClimate(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, startDate]);

  useEffect(() => {
    if (step !== 4 || suggestions !== null || !stops[0]) return;
    setSuggestLoading(true);
    setSuggestError("");
    suggestPopularPlaces(stops[0].name)
      .then(setSuggestions)
      .catch((err: any) => setSuggestError(err.message || "Could not load suggestions"))
      .finally(() => setSuggestLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const toggleSuggestion = async (place: { name: string; reason: string }) => {
    const already = stops.some((s) => s.name === place.name);
    if (already) {
      setStops((prev) => prev.filter((s) => s.name !== place.name));
      return;
    }
    setGeocodingName(place.name);
    try {
      const geo = await geocodeDestination(place.name);
      setStops((prev) => [...prev, { name: place.name, lat: geo.lat, lng: geo.lng, days: 2 }]);
    } catch (err) {
      // Couldn't geocode this suggestion — leave it unselected.
    } finally {
      setGeocodingName(null);
    }
  };

  const finalize = async () => {
    setBusy(true);
    setError("");
    try {
      const dated = buildDatedStops(stops, startDate || null);
      const endDate = dated[dated.length - 1]?.endDate || null;
      const autoName = stops.length <= 2 ? stops.map((s) => s.name).join(" → ") : `${stops[0].name} +${stops.length - 1} more`;
      const trip = await createTrip({
        destinationName: tripName.trim() || autoName,
        lat: dated[0].lat,
        lng: dated[0].lng,
        startDate: startDate || null,
        endDate,
        homeCurrency,
        stops: dated,
      });
      scheduleAbandonedPlanningNudge(trip);
      schedulePostTripNudge(trip);
      haptics.success();
      navigation.replace("MainTabs", { screen: "Trips" });
    } catch (err: any) {
      setError(err.message || "Could not create trip");
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  const climateNote =
    climate && climate.avgHigh != null
      ? `Expect around ${Math.round(climate.avgHigh)}°C${climate.rainyDays > 0 ? ", some rain" : ", mostly dry"}.`
      : null;

  const daysPlanned = stops.reduce((sum, s) => sum + s.days, 0);
  const daysPlannedNote =
    daysPlanned === totalDays
      ? `${daysPlanned} of ${totalDays} days planned — nice, that's all of it.`
      : daysPlanned < totalDays
      ? `${daysPlanned} of ${totalDays} days planned — ${totalDays - daysPlanned} day${totalDays - daysPlanned === 1 ? "" : "s"} left to assign.`
      : `${daysPlanned} of ${totalDays} days planned — ${daysPlanned - totalDays} day${daysPlanned - totalDays === 1 ? "" : "s"} over; that's fine, your trip will just run a bit longer.`;

  // Moving from Dates to Route: only the single default stop exists so
  // far (nothing split out yet), so hand it the full day count the user
  // just chose — it's then theirs to redistribute as they add stops.
  // Once they've already split days across more than one stop, this step
  // leaves that allocation alone rather than clobbering it on Back/Next.
  const continueToRoute = () => {
    if (stops.length === 1) setStops([{ ...stops[0], days: totalDays }]);
    setStep(3);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>
          Step {step} of {STEPS.length} · {STEPS[step - 1]}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressRow}>
        {STEPS.map((label, i) => (
          <View key={label} style={[styles.progressBar, { backgroundColor: i < step ? colors.stamp : colors.border }]} />
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(20) }}>
        {step === 1 && (
          <View>
            <Text style={styles.title}>Where are you going?</Text>
            <Text style={styles.subtitle}>Type a city, or a whole country to see its biggest cities.</Text>
            <PlaceAutocomplete autoFocus placeholder="e.g. Bali, or Japan" value={pendingName} onChangeText={setPendingName} onPick={pickFirstPlace} />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.title}>When are you going?</Text>

            <Text style={styles.label}>Trip name (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={stops.map((s) => s.name).join(" → ")}
              placeholderTextColor={colors.textFaint}
              value={tripName}
              onChangeText={setTripName}
            />

            <Text style={[styles.label, { marginTop: spacing(3) }]}>Start date (optional)</Text>
            <DateField value={startDate} onChange={setStartDate} placeholder="Not sure yet? Skip this" />
            {climateNote ? (
              <Text style={styles.hintText}>☀ {climateNote}</Text>
            ) : (
              <Text style={styles.hintText}>Not sure yet? Skip this — you can add dates later from the trip's Itinerary tab.</Text>
            )}

            <Text style={[styles.label, { marginTop: spacing(3) }]}>How many days is this trip?</Text>
            <View style={styles.totalDaysRow}>
              <TouchableOpacity style={styles.stepperButton} onPress={() => setTotalDays((d) => Math.max(1, d - 1))}>
                <Text style={styles.stepperText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.totalDaysLabel}>{totalDays} day{totalDays === 1 ? "" : "s"}</Text>
              <TouchableOpacity style={styles.stepperButton} onPress={() => setTotalDays((d) => d + 1)}>
                <Text style={styles.stepperText}>+</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>Next, you'll split these days across every place you're visiting.</Text>

            <Text style={[styles.label, { marginTop: spacing(3) }]}>Home currency (for budget totals)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CURRENCIES.map((c: string) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setHomeCurrency(c)}
                  style={[styles.currencyChip, homeCurrency === c && styles.currencyChipActive]}
                >
                  <Text style={[styles.currencyChipText, homeCurrency === c && styles.currencyChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.title}>Your route</Text>
            <View style={{ marginBottom: spacing(4), borderRadius: radius.lg, overflow: "hidden" }}>
              <PlaceBanner placeName={stops[0]?.name} height={150} />
            </View>
            <Text style={styles.hintText}>{daysPlannedNote}</Text>

            <JourneyStrip stops={stops} onChangeDays={changeDays} onRemove={removeStop} />

            {addingStop ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2), marginTop: spacing(2) }}>
                <View style={{ flex: 1 }}>
                  <PlaceAutocomplete autoFocus placeholder="e.g. Paris" value={newStopName} onChangeText={setNewStopName} onPick={addStop} />
                </View>
                <TouchableOpacity onPress={() => setAddingStop(false)}>
                  <X size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addStopLink} onPress={() => setAddingStop(true)}>
                <Plus size={14} color={colors.textSecondary} />
                <Text style={styles.addStopText}>Add another stop</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.title}>Popular add-ons</Text>
            <Text style={styles.subtitle}>Tap a stamp to add it to your route — collect as many as you like.</Text>

            {suggestLoading && <ActivityIndicator color={colors.primaryBg} style={{ marginBottom: spacing(3) }} />}
            {suggestError ? <Text style={styles.errorText}>{suggestError}</Text> : null}

            {suggestions && suggestions.length > 0 && (
              <View style={styles.suggestGrid}>
                {suggestions.map((place) => {
                  const added = stops.some((s) => s.name === place.name);
                  const loadingThis = geocodingName === place.name;
                  return (
                    <TouchableOpacity
                      key={place.name}
                      style={[styles.suggestTile, added && styles.suggestTileActive]}
                      onPress={() => toggleSuggestion(place)}
                      disabled={loadingThis}
                    >
                      <View style={styles.suggestTileHeader}>
                        <Text style={[styles.suggestTileName, added && { color: colors.stamp }]} numberOfLines={1}>
                          {place.name}
                        </Text>
                        {added && <Check size={14} color={colors.stamp} />}
                      </View>
                      <Text style={styles.suggestTileReason} numberOfLines={2}>
                        {loadingThis ? "Adding…" : place.reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {suggestions && suggestions.length === 0 && !suggestLoading && (
              <Text style={styles.subtitle}>No suggestions this time — that's fine, your route is ready as-is.</Text>
            )}

            <JourneyStrip stops={stops} onChangeDays={changeDays} onRemove={removeStop} />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(step - 1)}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        {step === 1 && (
          <TouchableOpacity
            style={[styles.nextButton, (busy || !pendingName.trim()) && { opacity: 0.6 }]}
            onPress={continueStep1}
            disabled={busy || !pendingName.trim()}
          >
            {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.nextButtonText}>Continue</Text>}
          </TouchableOpacity>
        )}
        {step === 2 && (
          <TouchableOpacity style={styles.nextButton} onPress={continueToRoute}>
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
        {step === 3 && (
          <TouchableOpacity style={[styles.nextButton, stops.length === 0 && { opacity: 0.6 }]} onPress={() => setStep(4)} disabled={stops.length === 0}>
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
        {step === 4 && (
          <PressScale style={[styles.createButton, busy && { opacity: 0.6 }]} onPress={finalize} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Sparkles size={14} color="#fff" />
                <Text style={styles.createButtonText}>Create trip</Text>
              </>
            )}
          </PressScale>
        )}
      </View>
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
    paddingBottom: spacing(2),
  },
  stepLabel: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  progressRow: { flexDirection: "row", gap: spacing(1.5), paddingHorizontal: spacing(4), marginBottom: spacing(2) },
  progressBar: { flex: 1, height: 6, borderRadius: 999 },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing(1) },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing(4) },
  label: { fontSize: 14, color: colors.textTertiary, marginBottom: spacing(1) },
  hintText: { fontSize: 12, color: colors.textMuted, marginTop: spacing(1), marginBottom: spacing(2) },
  errorText: { fontSize: 13, color: colors.stamp, marginTop: spacing(2) },
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
  stopWrap: { alignItems: "center", width: 92, marginRight: spacing(3) },
  stopDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.stamp, marginBottom: spacing(1) },
  stopName: { fontSize: 12, fontWeight: "500", color: colors.textPrimary, textAlign: "center" },
  stopDaysRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginTop: spacing(1.5) },
  stepperButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperText: { fontSize: 13, color: colors.textPrimary },
  stopDaysLabel: { fontSize: 12, color: colors.textMuted },
  removeLink: { fontSize: 10, color: colors.stamp, textDecorationLine: "underline", marginTop: spacing(1) },
  addStopLink: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginTop: spacing(2) },
  addStopText: { fontSize: 14, color: colors.textSecondary },
  totalDaysRow: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  totalDaysLabel: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, minWidth: 64 },
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
  suggestGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2), marginBottom: spacing(2) },
  suggestTile: {
    width: "47%",
    padding: spacing(3),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestTileActive: { backgroundColor: "#FBEAF0", borderColor: colors.stamp, borderWidth: 1.5 },
  suggestTileHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(1) },
  suggestTileName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, flexShrink: 1 },
  suggestTileReason: { fontSize: 12, color: colors.textSecondary },
  footer: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(4),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButtonText: { color: colors.textBody, fontWeight: "600" },
  nextButton: { flex: 1, paddingVertical: spacing(2.5), borderRadius: radius.md, alignItems: "center", backgroundColor: colors.primaryBg },
  nextButtonText: { color: colors.primaryText, fontWeight: "600" },
  createButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
    backgroundColor: colors.stamp,
  },
  createButtonText: { color: "#fff", fontWeight: "700" },
});
