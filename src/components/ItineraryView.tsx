import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Camera, MapPin, Utensils } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { enumerateDates } from "../lib/dates";
import { getEffectiveStops, getStopForDate } from "../lib/stops";
import ItemModal from "./ItemModal";
import AIGenerateCard from "./AIGenerateCard";

function formatDay(dateStr: string, dayNumber: number) {
  const d = new Date(dateStr + "T00:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const monthDay = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Day ${dayNumber} · ${weekday}, ${monthDay}`;
}

function SetDatesPrompt({ onSet }: { onSet: (startDate: string) => Promise<void> }) {
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!startDate) return;
    setBusy(true);
    await onSet(startDate);
    setBusy(false);
  };

  return (
    <View style={styles.datesCard}>
      <Text style={styles.datesTitle}>When are you going?</Text>
      <Text style={styles.datesSubtitle}>Add a start date to build your day-by-day itinerary.</Text>
      <TextInput
        style={styles.dateInput}
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textFaint}
      />
      <TouchableOpacity style={[styles.saveDatesButton, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.saveDatesText}>{busy ? "Saving…" : "Save dates"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function DayCard({
  date,
  dayNumber,
  stopName,
  items,
  onAdd,
  onEdit,
}: {
  date: string;
  dayNumber: number;
  stopName?: string | null;
  items: any[];
  onAdd: (date: string) => void;
  onEdit: (item: any) => void;
}) {
  const sorted = [...items].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={styles.dayTitle}>{formatDay(date, dayNumber)}</Text>
          {stopName ? <Text style={styles.dayStop}>{stopName}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => onAdd(date)}>
          <Text style={styles.addLink}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <Text style={styles.emptyDay}>Nothing planned yet.</Text>
      ) : (
        <View style={{ gap: spacing(2) }}>
          {sorted.map((item) => (
            <TouchableOpacity key={item.id} style={styles.item} onPress={() => onEdit(item)}>
              <View style={styles.itemRow}>
                {item.type === "photo" && <Camera size={14} color={colors.stamp} />}
                {item.type === "food" && <Utensils size={14} color={colors.textSecondary} />}
                {item.time ? <Text style={styles.itemTime}>{item.time}</Text> : null}
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.lat != null && <MapPin size={12} color={colors.textMuted} />}
              </View>
              {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ItineraryView({ trip, onSave, onSetDates }: { trip: any; onSave: (items: any[]) => void; onSetDates: (startDate: string) => Promise<void> }) {
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  if (!trip.start_date) {
    return <SetDatesPrompt onSet={onSetDates} />;
  }

  const items = trip.itinerary || [];
  const days = enumerateDates(trip.start_date, trip.end_date);
  const stops = getEffectiveStops(trip);
  const showStopLabel = stops.length > 1;

  const closeModal = () => {
    setModalDate(null);
    setEditingItem(null);
  };

  const handleSave = (fields: any) => {
    let next;
    if (fields.id) {
      next = items.map((it: any) => (it.id === fields.id ? { ...it, ...fields } : it));
    } else {
      next = [...items, { ...fields, id: randomUUID() }];
    }
    onSave(next);
    closeModal();
  };

  const handleDelete = (id: string) => {
    onSave(items.filter((it: any) => it.id !== id));
    closeModal();
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <AIGenerateCard trip={trip} onGenerated={(newItems) => onSave([...items, ...newItems])} />

      {days.map((date, i) => (
        <DayCard
          key={date}
          date={date}
          dayNumber={i + 1}
          stopName={showStopLabel ? getStopForDate(stops, date)?.name : null}
          items={items.filter((it: any) => it.date === date)}
          onAdd={(d) => setModalDate(d)}
          onEdit={(item) => {
            setModalDate(item.date);
            setEditingItem(item);
          }}
        />
      ))}

      {modalDate && (
        <ItemModal date={modalDate} initial={editingItem} onSave={handleSave} onDelete={handleDelete} onClose={closeModal} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  datesCard: {
    margin: spacing(4),
    padding: spacing(4),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.tape,
  },
  datesTitle: { fontWeight: "600", color: colors.textPrimary, marginBottom: spacing(1) },
  datesSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing(3) },
  dateInput: {
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
  saveDatesButton: { backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing(2.5), alignItems: "center" },
  saveDatesText: { color: colors.primaryText, fontWeight: "600" },
  dayCard: {
    padding: spacing(4),
    borderRadius: radius.lg,
    marginBottom: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(2) },
  dayTitle: { fontWeight: "600", color: colors.textPrimary },
  dayStop: { fontSize: 12, color: colors.textMuted },
  addLink: { fontSize: 14, color: colors.textSecondary, textDecorationLine: "underline" },
  emptyDay: { fontSize: 14, color: colors.textFaint },
  item: { paddingHorizontal: spacing(3), paddingVertical: spacing(2), borderRadius: radius.md, backgroundColor: colors.bg },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  itemTime: { fontWeight: "600", color: colors.textBody, marginRight: spacing(1) },
  itemTitle: { color: colors.textBody, flexShrink: 1 },
  itemNotes: { fontSize: 13, color: colors.textSecondary, marginTop: spacing(0.5) },
});
