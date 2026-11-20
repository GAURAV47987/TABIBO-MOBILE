import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform, Alert, BackHandler } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Plus, Trash2, Navigation } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { geocodeDestination } from "../lib/geocode";
import { getEffectiveStops } from "../lib/stops";

const STOP_COLOR = "#B23A2E";
const ITINERARY_COLOR = "#C9A227";
const PIN_COLOR = "#2C5F7C";

type LatLng = { lat: number; lng: number };

// Hands off to the phone's own maps app for real turn-by-turn directions
// (walking/transit/driving, live traffic, offline maps if downloaded) —
// no routing API key or cost on our side. With no origin, both apps
// start from the user's current location.
function openDirections(to: LatLng, from?: LatLng | null) {
  const dest = `${to.lat},${to.lng}`;
  const url =
    Platform.OS === "ios"
      ? `https://maps.apple.com/?daddr=${dest}${from ? `&saddr=${from.lat},${from.lng}` : ""}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}${from ? `&origin=${from.lat},${from.lng}` : ""}`;
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open maps"));
}

function shortDay(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TripMapView({ trip, onSave, canEdit = true }: { trip: any; onSave: (pins: any[]) => void; canEdit?: boolean }) {
  const pins = trip.map_pins || [];
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const stops = getEffectiveStops(trip);
  const mapRef = useRef<MapView>(null);
  const nameRef = useRef<any>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!showAdd) return;
    const t = setTimeout(() => nameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [showAdd]);

  useEffect(() => {
    if (!showAdd) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setShowAdd(false);
      return true;
    });
    return () => sub.remove();
  }, [showAdd]);

  const itineraryStops = useMemo(
    () =>
      (trip.itinerary || [])
        .filter((it: any) => it.lat != null && it.lng != null)
        .sort((a: any, b: any) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99"))),
    [trip.itinerary]
  );

  // Routes only connect stops within the same day — the last stop of day 1
  // and the first of day 2 aren't a leg anyone actually travels.
  const byDay = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const it of itineraryStops) (groups[it.date] ||= []).push(it);
    return groups;
  }, [itineraryStops]);
  const dayKeys = Object.keys(byDay).sort();
  const activeDay = selectedDay && byDay[selectedDay] ? selectedDay : null;
  const visibleStops = activeDay ? byDay[activeDay] : itineraryStops;

  const selectDay = (day: string | null) => {
    setSelectedDay(day);
    const pts = (day ? byDay[day] : itineraryStops).map((it: any) => ({ latitude: it.lat, longitude: it.lng }));
    if (pts.length) {
      mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    }
  };

  const addPin = async () => {
    if (!name.trim()) return;
    setError("");
    setBusy(true);
    try {
      const place = await geocodeDestination(name);
      onSave([...pins, { id: randomUUID(), name, lat: place.lat, lng: place.lng }]);
      setName("");
      setShowAdd(false);
    } catch (err: any) {
      setError(err.message || "Could not find that place");
    } finally {
      setBusy(false);
    }
  };

  const removePin = (id: string) => onSave(pins.filter((p: any) => p.id !== id));

  if (!trip.destination_lat) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No location set for this trip yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: trip.destination_lat,
          longitude: trip.destination_lng,
          latitudeDelta: stops.length > 1 ? 6 : 0.3,
          longitudeDelta: stops.length > 1 ? 6 : 0.3,
        }}
      >
        {stops.length > 1 ? (
          <>
            {stops.map((s: any, i: number) => (
              <Marker key={s.id || i} coordinate={{ latitude: s.lat, longitude: s.lng }} title={`${i + 1}. ${s.name}`} description={`${s.days} day(s)`} pinColor={STOP_COLOR} />
            ))}
            <Polyline coordinates={stops.map((s: any) => ({ latitude: s.lat, longitude: s.lng }))} strokeColor={STOP_COLOR} strokeWidth={2} lineDashPattern={[6, 6]} />
          </>
        ) : (
          <Marker coordinate={{ latitude: trip.destination_lat, longitude: trip.destination_lng }} title={trip.destination_name} pinColor={STOP_COLOR} />
        )}

        {pins.map((p: any) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.name} pinColor={PIN_COLOR} />
        ))}

        {visibleStops.map((item: any) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat, longitude: item.lng }}
            title={item.title}
            description={[shortDay(item.date), item.time].filter(Boolean).join(" · ")}
            pinColor={ITINERARY_COLOR}
          />
        ))}
        {(activeDay ? [activeDay] : dayKeys).map((day) =>
          byDay[day].length > 1 ? (
            <Polyline
              key={day}
              coordinates={byDay[day].map((it: any) => ({ latitude: it.lat, longitude: it.lng }))}
              strokeColor={ITINERARY_COLOR}
              strokeWidth={3}
            />
          ) : null
        )}
      </MapView>

      {(itineraryStops.length > 0 || pins.length > 0) && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STOP_COLOR }]} />
            <Text style={styles.legendText}>Stops</Text>
          </View>
          {itineraryStops.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ITINERARY_COLOR }]} />
              <Text style={styles.legendText}>Itinerary plan</Text>
            </View>
          )}
          {pins.length > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PIN_COLOR }]} />
              <Text style={styles.legendText}>Your pins</Text>
            </View>
          )}
        </View>
      )}

      {dayKeys.length > 0 && (
        <View style={styles.directionsCard}>
          <Text style={styles.directionsTitle}>Directions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing(2), paddingBottom: spacing(2) }}>
            <TouchableOpacity style={[styles.dayChip, !activeDay && styles.dayChipActive]} onPress={() => selectDay(null)}>
              <Text style={[styles.dayChipText, !activeDay && { color: colors.primaryText }]}>All days</Text>
            </TouchableOpacity>
            {dayKeys.map((day) => (
              <TouchableOpacity key={day} style={[styles.dayChip, activeDay === day && styles.dayChipActive]} onPress={() => selectDay(day)}>
                <Text style={[styles.dayChipText, activeDay === day && { color: colors.primaryText }]}>{shortDay(day)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {activeDay ? (
            <View style={{ gap: spacing(1.5) }}>
              {byDay[activeDay].map((it: any, i: number) => {
                const prev = i > 0 ? byDay[activeDay][i - 1] : null;
                return (
                  <TouchableOpacity key={it.id} style={styles.legRow} onPress={() => openDirections(it, prev)}>
                    <Text style={styles.legIndex}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legTitle} numberOfLines={1}>
                        {it.title}
                      </Text>
                      <Text style={styles.legFrom} numberOfLines={1}>
                        {prev ? `from ${prev.title}` : "from your location"}
                        {it.time ? ` · ${it.time}` : ""}
                      </Text>
                    </View>
                    <Navigation size={16} color={colors.stamp} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.legFrom}>Pick a day to get step-by-step directions between its stops.</Text>
          )}
        </View>
      )}

      {canEdit && (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
          <Plus size={16} color={colors.textPrimary} />
          <Text style={styles.addButtonText}>Add a place to the map</Text>
        </TouchableOpacity>
      )}

      {pins.length > 0 && (
        <View style={{ gap: spacing(2) }}>
          {pins.map((p: any) => (
            <View key={p.id} style={styles.pinRow}>
              <Text style={styles.pinName}>{p.name}</Text>
              {canEdit && (
                <TouchableOpacity onPress={() => removePin(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={15} color={colors.stamp} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

    </ScrollView>

      {showAdd && (
        <View style={styles.modalWrap}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Add a place</Text>
              <TextInput
                ref={nameRef}
                style={styles.input}
                placeholder="e.g. Uluwatu Temple"
                placeholderTextColor={colors.textFaint}
                value={name}
                onChangeText={setName}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAdd(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitButton, busy && { opacity: 0.6 }]} onPress={addPin} disabled={busy}>
                  <Text style={styles.submitText}>{busy ? "Finding…" : "Add pin"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.textSecondary },
  map: { width: "100%", height: 280, borderRadius: radius.lg, marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
  directionsCard: {
    padding: spacing(3),
    borderRadius: radius.lg,
    marginBottom: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  directionsTitle: { fontWeight: "600", color: colors.textPrimary, marginBottom: spacing(2) },
  dayChip: { paddingHorizontal: spacing(3), paddingVertical: spacing(1.5), borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  dayChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBg },
  dayChipText: { fontSize: 13, color: colors.textSecondary },
  legRow: { flexDirection: "row", alignItems: "center", gap: spacing(3), paddingVertical: spacing(2), paddingHorizontal: spacing(2), borderRadius: radius.md, backgroundColor: colors.bg },
  legIndex: { width: 20, textAlign: "center", fontWeight: "700", color: ITINERARY_COLOR },
  legTitle: { color: colors.textBody, fontWeight: "500" },
  legFrom: { fontSize: 12, color: colors.textMuted },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing(3), marginBottom: spacing(3) },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    borderRadius: radius.lg,
    paddingVertical: spacing(2.5),
    marginBottom: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addButtonText: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinName: { fontSize: 14, color: colors.textBody },
  modalWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: spacing(4) },
  modalCard: { width: "100%", maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing(6), borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing(4) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.textBody,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 16,
    marginBottom: spacing(3),
  },
  errorText: { color: colors.stamp, fontSize: 13, marginBottom: spacing(3) },
  modalButtons: { flexDirection: "row", gap: spacing(2) },
  cancelButton: { flex: 1, paddingVertical: spacing(2.5), borderRadius: radius.md, alignItems: "center", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { color: colors.textBody, fontWeight: "600" },
  submitButton: { flex: 1, paddingVertical: spacing(2.5), borderRadius: radius.md, alignItems: "center", backgroundColor: colors.primaryBg },
  submitText: { color: colors.primaryText, fontWeight: "600" },
});
