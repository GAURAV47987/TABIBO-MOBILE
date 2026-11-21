import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { X, Check, Plus, Sparkles } from "lucide-react-native";
import { useTheme, radius, spacing, type Colors } from "../theme";
import { createTrip, suggestPopularPlaces } from "../lib/supabase";
import { searchPlaces } from "../lib/geonames";
import { geocodeDestination } from "../lib/geocode";
import { buildDatedStops } from "../lib/stops";
import { toISODateLocal } from "../lib/dates";
import { getTripClimate } from "../lib/weather";
import { CURRENCIES } from "../lib/constants";
import DateField from "../components/DateField";
import PressScale from "../components/PressScale";
import { haptics } from "../lib/haptics";
import { scheduleAbandonedPlanningNudge, schedulePostTripNudge } from "../lib/reminders";

const STEPS = ["Destination", "Route", "Add-ons"];

type Stop = {
  name: string;
  lat: number;
  lng: number;
  days: number;
  isCountry?: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

function addDaysToDate(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISODateLocal(d);
}

function daysBetween(startStr: string, endStr: string) {
  const a = new Date(startStr + "T00:00:00").getTime();
  const b = new Date(endStr + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000) + 1;
}

function PlaceAutocomplete({
  value,
  onChangeText,
  onPick,
  placeholder,
  autoFocus,
  prefillFrom,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onPick: (place: { name: string; lat: number; lng: number; isCountry?: boolean }) => void;
  placeholder: string;
  autoFocus?: boolean;
  // When set (the trip's known country) and nothing's been typed yet, the
  // suggestions list pre-fills with that country's biggest cities instead
  // of waiting for 2+ characters — picking a city shouldn't require
  // re-typing the country you already told it.
  prefillFrom?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!prefillFrom || value) return;
    setLoading(true);
    searchPlaces(prefillFrom)
      .then((results) => setSuggestions(results.filter((r: any) => !r.isCountry)))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState(1);
  const [stops, setStops] = useState<Stop[]>([]);
  // The step-1 pick's own identity, kept even after a real city replaces it
  // as stops[0] — still needed for the "Japan — N day trip" header, the
  // add-city dropdown prefill, and restoring the placeholder if every city
  // gets removed. Only set when that pick was a whole country, not a city.
  const [countryContext, setCountryContext] = useState<{ name: string; lat: number; lng: number } | null>(null);
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

  // Removing the last real city would otherwise leave an empty, dead-end
  // route — fall back to the whole-country placeholder when there is one.
  const removeStop = (i: number) => {
    setStops((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length === 0 && countryContext) {
        return [{ name: countryContext.name, lat: countryContext.lat, lng: countryContext.lng, days: totalDays, isCountry: true }];
      }
      return next;
    });
  };

  // A real city's own From/To dates are the source of truth once set —
  // `days` is kept in sync purely for the progress bar and the small "Xd"
  // badge, never the other way around.
  const setCityDate = (i: number, field: "startDate" | "endDate", value: string) => {
    setStops((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const next = { ...s, [field]: value };
        if (next.startDate && next.endDate) {
          const span = daysBetween(next.startDate, next.endDate);
          if (span > 0) next.days = span;
        }
        return next;
      })
    );
  };

  // Picking a place no longer advances the step — destination, dates and
  // currency all live on step 1 together now, so this just reveals the
  // rest of that page's fields in place.
  const pickFirstPlace = (place: { name: string; lat: number; lng: number; isCountry?: boolean }) => {
    setError("");
    setStops([{ name: place.name, lat: place.lat, lng: place.lng, days: 3, isCountry: place.isCountry }]);
    setCountryContext(place.isCountry ? { name: place.name, lat: place.lat, lng: place.lng } : null);
  };

  const continueStep1 = async () => {
    if (!pendingName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const place = await geocodeDestination(pendingName.trim());
      setStops([{ name: pendingName.trim(), lat: place.lat, lng: place.lng, days: 3 }]);
      setCountryContext(null);
    } catch (err: any) {
      setError(err.message || "Could not find that place");
    } finally {
      setBusy(false);
    }
  };

  // The first real city REPLACES the whole-country placeholder outright
  // (rather than sitting alongside it) — that's what stops "Japan: 7d" and
  // "Tokyo: 2d" from both counting toward the total at once. Every
  // subsequent city is appended normally. New cities default to starting
  // right after the previous one ends (or the trip's own start date, for
  // the first), spanning 2 days — a starting point the From/To pickers
  // are free to override, including leaving a gap for travel days.
  const addStop = async (place: { name: string; lat: number; lng: number }) => {
    const isFirstRealCity = stops.length === 1 && !!stops[0]?.isCountry;
    const prevCity = isFirstRealCity ? null : stops[stops.length - 1];
    const defaultStart = isFirstRealCity ? startDate || null : prevCity?.endDate ? addDaysToDate(prevCity.endDate, 1) : null;
    const defaultEnd = defaultStart ? addDaysToDate(defaultStart, 1) : null;
    const newCity: Stop = {
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      days: defaultStart && defaultEnd ? daysBetween(defaultStart, defaultEnd) : 2,
      startDate: defaultStart,
      endDate: defaultEnd,
    };
    setStops((prev) => (isFirstRealCity ? [newCity] : [...prev, newCity]));
    setAddingStop(false);
    setNewStopName("");
  };

  useEffect(() => {
    if (step !== 1 || !startDate || !stops[0]) {
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
    if (step !== 3 || suggestions !== null || !stops[0]) return;
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
      setStops((prev) => {
        const next = prev.filter((s) => s.name !== place.name);
        if (next.length === 0 && countryContext) {
          return [{ name: countryContext.name, lat: countryContext.lat, lng: countryContext.lng, days: totalDays, isCountry: true }];
        }
        return next;
      });
      return;
    }
    setGeocodingName(place.name);
    try {
      const geo = await geocodeDestination(place.name);
      // Same replace-the-placeholder rule as the Route step's addStop: if
      // someone skips straight to Add-ons without breaking the country
      // down first, picking a suggestion here shouldn't recreate the
      // "Japan: 7d" + "Kyoto: 2d" double-count it fixes there.
      setStops((prev) => {
        const isFirstRealCity = prev.length === 1 && !!prev[0]?.isCountry;
        const prevCity = isFirstRealCity ? null : prev[prev.length - 1];
        const defaultStart = isFirstRealCity ? startDate || null : prevCity?.endDate ? addDaysToDate(prevCity.endDate, 1) : null;
        const defaultEnd = defaultStart ? addDaysToDate(defaultStart, 1) : null;
        const newCity: Stop = {
          name: place.name,
          lat: geo.lat,
          lng: geo.lng,
          days: defaultStart && defaultEnd ? daysBetween(defaultStart, defaultEnd) : 2,
          startDate: defaultStart,
          endDate: defaultEnd,
        };
        return isFirstRealCity ? [newCity] : [...prev, newCity];
      });
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
      // Manually-dated cities aren't guaranteed to be in chronological
      // order (or contiguous) the way sequenced stops always are, so the
      // trip's overall span is the min/max across all of them, not just
      // the first/last array entries.
      const starts = dated.map((s: any) => s.startDate).filter(Boolean) as string[];
      const ends = dated.map((s: any) => s.endDate).filter(Boolean) as string[];
      const overallStart = starts.length ? starts.reduce((min, d) => (d < min ? d : min)) : startDate || null;
      const overallEnd = ends.length ? ends.reduce((max, d) => (d > max ? d : max)) : null;
      const autoName = stops.length <= 2 ? stops.map((s) => s.name).join(" → ") : `${stops[0].name} +${stops.length - 1} more`;
      const trip = await createTrip({
        destinationName: tripName.trim() || autoName,
        lat: dated[0].lat,
        lng: dated[0].lng,
        startDate: overallStart,
        endDate: overallEnd,
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

  // Moving from step 1 to Route: only the single default stop exists so
  // far (nothing split out yet), so hand it the full day count the user
  // just chose — it's then theirs to redistribute as they add stops.
  // Once they've already split days across more than one stop, this step
  // leaves that allocation alone rather than clobbering it on Back/Next.
  const continueToRoute = () => {
    if (stops.length === 1) setStops([{ ...stops[0], days: totalDays }]);
    setStep(2);
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

            {stops[0] ? (
              <View style={styles.pickedPlaceRow}>
                <Text style={styles.pickedPlaceText}>
                  Going to <Text style={{ fontWeight: "700" }}>{stops[0].name}</Text>
                </Text>
                <TouchableOpacity onPress={() => setStops([])}>
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <PlaceAutocomplete autoFocus placeholder="e.g. Bali, or Japan" value={pendingName} onChangeText={setPendingName} onPick={pickFirstPlace} />
            )}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {stops[0] && (
              <View style={{ marginTop: spacing(4) }}>
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
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.title}>Which cities will you visit?</Text>
            <Text style={styles.subtitle}>
              {stops.length > 1
                ? `Nice — here's how your ${totalDays} day${totalDays === 1 ? "" : "s"} break down.`
                : `Split your ${totalDays} day${totalDays === 1 ? "" : "s"} across every stop — add as many cities as you like.`}
            </Text>
            {countryContext && <Text style={styles.countryHeader}>{countryContext.name} · {totalDays} day trip</Text>}

            {stops.length === 1 && (
              <View style={styles.calloutBox}>
                <View style={styles.calloutIcon}>
                  <Plus size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calloutTitle}>Start by adding a city</Text>
                  <Text style={styles.calloutText}>e.g. Sydney, Melbourne, Perth — tap the button below to search.</Text>
                </View>
              </View>
            )}

            <View style={styles.progressCard}>
              <View style={styles.progressCardRow}>
                <Text style={styles.progressCardLabel}>Days planned</Text>
                <Text style={[styles.progressCardValue, daysPlanned > totalDays && { color: colors.stamp }]}>
                  {daysPlanned} of {totalDays}
                  {daysPlanned === totalDays ? " — all set" : ""}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, (daysPlanned / totalDays) * 100)}%` },
                    daysPlanned > totalDays && { backgroundColor: colors.stamp },
                  ]}
                />
              </View>
            </View>

            <View style={{ gap: spacing(2.5) }}>
              {stops.map((s, i) => {
                // Nothing broken down yet: show the whole-country placeholder
                // exactly as before, with its own day stepper. The moment a
                // real city exists, it replaces this row outright (see
                // addStop) — real cities never share space with it, so
                // there's no "Japan: 7d + Tokyo: 2d" double count.
                const isPlaceholder = stops.length === 1 && !!s.isCountry;
                if (isPlaceholder) {
                  return (
                    <View key={`${s.name}-${i}`} style={styles.stopCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2.5), flexShrink: 1 }}>
                        <View style={styles.stopCardDot} />
                        <View style={{ flexShrink: 1 }}>
                          <Text style={styles.stopCardName}>{s.name}</Text>
                          <Text style={styles.stopCardHint}>Whole country — add cities to break this down</Text>
                        </View>
                      </View>
                      <View style={styles.stopCardStepper}>
                        <TouchableOpacity style={styles.stepperButton} onPress={() => changeDays(i, -1)}>
                          <Text style={styles.stepperText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stopCardDays}>{s.days}d</Text>
                        <TouchableOpacity style={styles.stepperButton} onPress={() => changeDays(i, 1)}>
                          <Text style={styles.stepperText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }
                return (
                  <View key={`${s.name}-${i}`} style={styles.cityDateCard}>
                    <View style={styles.cityDateHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2.5) }}>
                        <View style={styles.stopCardDot} />
                        <Text style={styles.stopCardName}>{s.name}</Text>
                        <Text style={styles.cityDateBadge}>{s.days}d</Text>
                      </View>
                      {(stops.length > 1 || countryContext) && (
                        <TouchableOpacity onPress={() => removeStop(i)}>
                          <Text style={styles.stopCardRemove}>Remove</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={styles.cityDateRow}>
                      <Text style={styles.cityDateLabel}>From</Text>
                      <DateField value={s.startDate || ""} onChange={(v) => setCityDate(i, "startDate", v)} placeholder="Select a date" />
                    </View>
                    <View style={[styles.cityDateRow, { marginTop: spacing(3) }]}>
                      <Text style={styles.cityDateLabel}>To</Text>
                      <DateField value={s.endDate || ""} onChange={(v) => setCityDate(i, "endDate", v)} placeholder="Select a date" />
                    </View>
                  </View>
                );
              })}
            </View>

            {addingStop ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(2), marginTop: spacing(3) }}>
                <View style={{ flex: 1 }}>
                  <PlaceAutocomplete
                    autoFocus
                    placeholder="e.g. Paris"
                    value={newStopName}
                    onChangeText={setNewStopName}
                    onPick={addStop}
                    prefillFrom={countryContext?.name}
                  />
                </View>
                <TouchableOpacity onPress={() => setAddingStop(false)}>
                  <X size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ) : stops.length === 1 ? (
              <TouchableOpacity style={styles.addCityButtonBold} onPress={() => setAddingStop(true)}>
                <Plus size={18} color={colors.primaryBg} />
                <Text style={styles.addCityButtonBoldText}>Add a city</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.addCityButtonLight} onPress={() => setAddingStop(true)}>
                <Plus size={16} color={colors.textTertiary} />
                <Text style={styles.addCityButtonLightText}>Add another city</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {step === 3 && (
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
        {step === 1 && !stops[0] && (
          <TouchableOpacity
            style={[styles.nextButton, (busy || !pendingName.trim()) && { opacity: 0.6 }]}
            onPress={continueStep1}
            disabled={busy || !pendingName.trim()}
          >
            {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.nextButtonText}>Continue</Text>}
          </TouchableOpacity>
        )}
        {step === 1 && stops[0] && (
          <TouchableOpacity style={styles.nextButton} onPress={continueToRoute}>
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
        {step === 2 && (
          <TouchableOpacity style={[styles.nextButton, stops.length === 0 && { opacity: 0.6 }]} onPress={() => setStep(3)} disabled={stops.length === 0}>
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
        {step === 3 && (
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

const getStyles = (colors: Colors) =>
  StyleSheet.create({
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
  pickedPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  pickedPlaceText: { fontSize: 15, color: colors.textBody },
  changeLink: { fontSize: 13, color: colors.stamp, textDecorationLine: "underline" },
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
  calloutBox: {
    flexDirection: "row",
    gap: spacing(3),
    alignItems: "flex-start",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.stamp,
    backgroundColor: "#FFF4F7",
    borderRadius: radius.lg,
    padding: spacing(4),
    marginBottom: spacing(4),
  },
  calloutIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.stamp, alignItems: "center", justifyContent: "center" },
  calloutTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  calloutText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  progressCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(4),
  },
  progressCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing(2) },
  progressCardLabel: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  progressCardValue: { fontSize: 13, color: colors.textMuted },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primaryBg },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
  },
  stopCardDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.stamp },
  stopCardName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  stopCardRemove: { fontSize: 12, color: colors.stamp, textDecorationLine: "underline", marginTop: 2 },
  stopCardHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stopCardStepper: { flexDirection: "row", alignItems: "center", gap: spacing(2) },
  stopCardDays: { fontSize: 13, color: colors.textTertiary, minWidth: 18, textAlign: "center" },
  countryHeader: { fontSize: 13, color: colors.textMuted, marginTop: -spacing(2), marginBottom: spacing(4) },
  cityDateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
  },
  cityDateHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(3) },
  cityDateBadge: { fontSize: 12, color: colors.textMuted, marginLeft: spacing(1) },
  cityDateRow: {},
  cityDateLabel: { fontSize: 12, color: colors.textTertiary, marginBottom: spacing(1) },
  addCityButtonBold: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    borderWidth: 2,
    borderColor: colors.primaryBg,
    backgroundColor: "#F3F0FF",
    borderRadius: radius.lg,
    paddingVertical: spacing(3.5),
    marginTop: spacing(3),
  },
  addCityButtonBoldText: { fontSize: 15, fontWeight: "700", color: colors.primaryBg },
  addCityButtonLight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing(3.5),
    marginTop: spacing(3),
  },
  addCityButtonLightText: { fontSize: 14, fontWeight: "600", color: colors.textTertiary },
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
