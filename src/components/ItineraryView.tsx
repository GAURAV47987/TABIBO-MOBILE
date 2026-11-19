import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, LayoutAnimation } from "react-native";
import { Camera, MapPin, Utensils, Bell, BellOff, Printer } from "lucide-react-native";
import { areTripRemindersEnabled, enableTripReminders, cancelTripReminders } from "../lib/reminders";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { enumerateDates } from "../lib/dates";
import { getEffectiveStops, getStopForDate } from "../lib/stops";
import { escapeHtml, exportHtmlAsPdf } from "../lib/pdf";
import { haptics } from "../lib/haptics";
import ItemModal from "./ItemModal";
import AIGenerateCard from "./AIGenerateCard";
import DateField from "./DateField";

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
      <View style={{ marginBottom: spacing(3) }}>
        <DateField value={startDate} onChange={setStartDate} placeholder="Select a start date" />
      </View>
      <TouchableOpacity style={[styles.saveDatesButton, (busy || !startDate) && { opacity: 0.6 }]} onPress={submit} disabled={busy || !startDate}>
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

async function exportItineraryPDF(trip: any) {
  const days = enumerateDates(trip.start_date, trip.end_date);
  const stops = getEffectiveStops(trip);
  const items = trip.itinerary || [];
  const dayBlocks = days
    .map((date, i) => {
      const stop = stops.length > 1 ? getStopForDate(stops, date)?.name : null;
      const dayItems = items
        .filter((it: any) => it.date === date)
        .sort((a: any, b: any) => (a.time || "99:99").localeCompare(b.time || "99:99"));
      const rows = dayItems.length
        ? dayItems
            .map(
              (it: any) => `
              <tr>
                <td class="time">${escapeHtml(it.time || "")}</td>
                <td><div class="title">${escapeHtml(it.title)}</div>${it.notes ? `<div class="notes">${escapeHtml(it.notes)}</div>` : ""}${
                  it.location ? `<div class="loc">📍 ${escapeHtml(it.location)}</div>` : ""
                }</td>
              </tr>`
            )
            .join("")
        : `<tr><td></td><td class="empty">Nothing planned</td></tr>`;
      return `
        <section>
          <h2>${escapeHtml(formatDay(date, i + 1))}${stop ? ` <span class="stop">· ${escapeHtml(stop)}</span>` : ""}</h2>
          <table>${rows}</table>
        </section>`;
    })
    .join("");

  const route = stops.length > 1 ? `<p class="meta">${stops.map((s: any) => `${escapeHtml(s.name)} (${s.days}d)`).join(" → ")}</p>` : "";
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #222; padding: 24px; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          .meta { color: #888; font-size: 12px; margin: 0 0 4px; }
          section { page-break-inside: avoid; margin-top: 20px; }
          h2 { font-size: 14px; color: #B23A2E; border-bottom: 1px solid #e5d9c9; padding-bottom: 4px; margin: 0 0 6px; }
          .stop { color: #888; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          td { vertical-align: top; padding: 4px 6px; }
          .time { width: 52px; font-weight: 600; white-space: nowrap; }
          .title { font-weight: 500; }
          .notes, .loc { color: #666; margin-top: 2px; }
          .empty { color: #aaa; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(trip.destination_name)}</h1>
        <p class="meta">${escapeHtml(trip.start_date)} — ${escapeHtml(trip.end_date)} · ${days.length} days</p>
        ${route}
        ${dayBlocks}
      </body>
    </html>`;

  await exportHtmlAsPdf(html, "Itinerary PDF");
}

function Toolbar({ trip }: { trip: any }) {
  const [reminders, setReminders] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    areTripRemindersEnabled(trip.id).then(setReminders);
  }, [trip.id]);

  const toggleReminders = async () => {
    setBusy(true);
    haptics.select();
    try {
      if (reminders) {
        await cancelTripReminders(trip.id);
        setReminders(false);
        return;
      }
      const { ok, count } = await enableTripReminders(trip);
      if (!ok) {
        Alert.alert("Notifications are off", "Allow notifications for TABIGO in Settings to get itinerary reminders.", [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      setReminders(true);
      Alert.alert(
        "Reminders on",
        count > 0
          ? `You'll get a heads-up an hour before each timed plan (${count} upcoming).`
          : "You'll get a heads-up an hour before each timed plan. Add times to your items to schedule them."
      );
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    try {
      await exportItineraryPDF(trip);
    } catch (err: any) {
      Alert.alert("Couldn't export", err.message || "Something went wrong");
    }
  };

  return (
    <View style={styles.toolbar}>
      <TouchableOpacity style={[styles.toolButton, reminders && styles.toolButtonOn]} onPress={toggleReminders} disabled={busy}>
        {reminders ? <Bell size={15} color={colors.primaryText} /> : <BellOff size={15} color={colors.textPrimary} />}
        <Text style={[styles.toolText, reminders && { color: colors.primaryText }]}>{reminders ? "Reminders on" : "Reminders"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolButton} onPress={exportPdf}>
        <Printer size={15} color={colors.textPrimary} />
        <Text style={styles.toolText}>Export PDF</Text>
      </TouchableOpacity>
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    haptics.success();
    onSave(next);
    closeModal();
  };

  const handleDelete = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    haptics.press();
    onSave(items.filter((it: any) => it.id !== id));
    closeModal();
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Toolbar trip={trip} />
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
  toolbar: { flexDirection: "row", gap: spacing(2), marginBottom: spacing(3) },
  toolButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolButtonOn: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBg },
  toolText: { fontSize: 13, fontWeight: "500", color: colors.textPrimary },
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
