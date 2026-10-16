import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Plus, Trash2 } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { geocodeDestination } from "../lib/geocode";
import { getEffectiveStops } from "../lib/stops";

const STOP_COLOR = "#B23A2E";
const ITINERARY_COLOR = "#C9A227";
const PIN_COLOR = "#2C5F7C";

export default function TripMapView({ trip, onSave }: { trip: any; onSave: (pins: any[]) => void }) {
  const pins = trip.map_pins || [];
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const stops = getEffectiveStops(trip);

  const itineraryStops = useMemo(
    () =>
      (trip.itinerary || [])
        .filter((it: any) => it.lat != null && it.lng != null)
        .sort((a: any, b: any) => (a.date + (a.time || "99:99")).localeCompare(b.date + (b.time || "99:99"))),
    [trip.itinerary]
  );

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
    <View style={{ flex: 1, padding: spacing(4) }}>
      <MapView
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

        {itineraryStops.map((item: any, i: number) => (
          <Marker key={item.id} coordinate={{ latitude: item.lat, longitude: item.lng }} title={`${i + 1}. ${item.title}`} description={item.time || ""} pinColor={ITINERARY_COLOR} />
        ))}
        {itineraryStops.length > 1 && (
          <Polyline coordinates={itineraryStops.map((it: any) => ({ latitude: it.lat, longitude: it.lng }))} strokeColor={ITINERARY_COLOR} strokeWidth={2} />
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

      <TouchableOpacity style={styles.addButton} onPress={() => setShowAdd(true)}>
        <Plus size={16} color={colors.textPrimary} />
        <Text style={styles.addButtonText}>Add a place to the map</Text>
      </TouchableOpacity>

      {pins.length > 0 && (
        <View style={{ gap: spacing(2) }}>
          {pins.map((p: any) => (
            <View key={p.id} style={styles.pinRow}>
              <Text style={styles.pinName}>{p.name}</Text>
              <TouchableOpacity onPress={() => removePin(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={15} color={colors.stamp} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a place</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Uluwatu Temple"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoFocus
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: colors.textSecondary },
  map: { width: "100%", height: 280, borderRadius: radius.lg, marginBottom: spacing(3), borderWidth: 1, borderColor: colors.border },
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
