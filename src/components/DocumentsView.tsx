import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { Plane, BedDouble, Ticket, IdCard, ShieldCheck, FileText, Paperclip, Plus, X, Copy } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { uploadTripDocument, getTripDocumentUrl, deleteTripDocumentFile } from "../lib/supabase";

// Booking confirmations, tickets, passport scans… Text fields (title,
// confirmation number, notes) live on the trip row, so they're available
// offline from the cached trip. Attached files sit in a private storage
// bucket and are opened through short-lived signed URLs.

const KINDS = [
  { id: "flight", label: "Flight", Icon: Plane },
  { id: "hotel", label: "Stay", Icon: BedDouble },
  { id: "booking", label: "Booking", Icon: Ticket },
  { id: "id", label: "ID / Passport", Icon: IdCard },
  { id: "insurance", label: "Insurance", Icon: ShieldCheck },
  { id: "other", label: "Other", Icon: FileText },
];

type DocFile = { path: string; name: string; mimeType: string };
type TripDoc = { id: string; kind: string; title: string; reference?: string; notes?: string; file?: DocFile | null };
type PendingFile = { uri: string; name: string; mimeType: string };

function kindOf(id: string) {
  return KINDS.find((k) => k.id === id) || KINDS[KINDS.length - 1];
}

function DocModal({
  trip,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  trip: any;
  initial: TripDoc | null;
  onClose: () => void;
  onSave: (doc: TripDoc) => Promise<void>;
  onDelete: (doc: TripDoc) => Promise<void>;
}) {
  const [kind, setKind] = useState(initial?.kind || "flight");
  const [title, setTitle] = useState(initial?.title || "");
  const [reference, setReference] = useState(initial?.reference || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [file, setFile] = useState<DocFile | null>(initial?.file || null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(fromCamera ? "Camera access is needed to take a photo." : "Photo library access is needed to attach a photo.");
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    setPending({ uri: asset.uri, name: asset.fileName || `photo-${Date.now()}.jpg`, mimeType: asset.mimeType || "image/jpeg" });
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    setPending({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "application/octet-stream" });
  };

  const chooseAttachment = () => {
    Alert.alert("Attach", undefined, [
      { text: "Take photo", onPress: () => pickPhoto(true) },
      { text: "Photo library", onPress: () => pickPhoto(false) },
      { text: "PDF or file", onPress: pickFile },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const submit = async () => {
    if (!title.trim()) {
      setError("Give it a name, e.g. \"Flight to Lisbon\".");
      return;
    }
    setError("");
    setBusy(true);
    try {
      let nextFile = file;
      if (pending) {
        const path = await uploadTripDocument(trip.id, pending);
        nextFile = { path, name: pending.name, mimeType: pending.mimeType };
      }
      // The old file is only removed once the trip row no longer points at it.
      const replacedPath = initial?.file?.path && initial.file.path !== nextFile?.path ? initial.file.path : null;
      await onSave({
        id: initial?.id || randomUUID(),
        kind,
        title: title.trim(),
        reference: reference.trim(),
        notes: notes.trim(),
        file: nextFile,
      });
      if (replacedPath) deleteTripDocumentFile(replacedPath).catch(() => {});
    } catch (err: any) {
      setError(err.message || "Could not save");
      setBusy(false);
    }
  };

  const remove = () => {
    if (!initial) return;
    Alert.alert("Delete document?", `"${initial.title}" and its attachment will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await onDelete(initial);
          } catch (err: any) {
            setError(err.message || "Could not delete");
            setBusy(false);
          }
        },
      },
    ]);
  };

  const attachedName = pending?.name || file?.name;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{initial ? "Edit document" : "Add document"}</Text>
            <TouchableOpacity onPress={onClose} disabled={busy}>
              <X size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.kindRow}>
              {KINDS.map((k) => {
                const active = k.id === kind;
                return (
                  <TouchableOpacity key={k.id} style={[styles.kindChip, active && styles.kindChipActive]} onPress={() => setKind(k.id)}>
                    <k.Icon size={14} color={active ? colors.primaryText : colors.textSecondary} />
                    <Text style={[styles.kindText, active && { color: colors.primaryText }]}>{k.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. TAP flight to Lisbon" placeholderTextColor={colors.textFaint} />

            <Text style={styles.label}>Confirmation / booking number</Text>
            <TextInput
              style={styles.input}
              value={reference}
              onChangeText={setReference}
              placeholder="e.g. X7K2QP"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Check-in time, seat, address…"
              placeholderTextColor={colors.textFaint}
              multiline
            />

            {attachedName ? (
              <View style={styles.attachedRow}>
                <Paperclip size={14} color={colors.textSecondary} />
                <Text style={styles.attachedName} numberOfLines={1}>
                  {attachedName}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setPending(null);
                    setFile(null);
                  }}
                >
                  <Text style={styles.link}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.attachButton} onPress={chooseAttachment}>
                <Paperclip size={16} color={colors.textPrimary} />
                <Text style={styles.attachText}>Attach photo or PDF</Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={[styles.primaryButton, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryButtonText}>Save</Text>}
            </TouchableOpacity>
            {initial && (
              <TouchableOpacity onPress={remove} disabled={busy} style={{ alignItems: "center", paddingVertical: spacing(3) }}>
                <Text style={{ color: colors.stamp, fontWeight: "600" }}>Delete</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function DocumentsView({ trip, offline, onSave }: { trip: any; offline: boolean; onSave: (docs: TripDoc[]) => Promise<void> }) {
  const docs: TripDoc[] = trip.documents || [];
  const [editing, setEditing] = useState<TripDoc | null | undefined>(undefined);
  const [opening, setOpening] = useState<string | null>(null);

  const saveDoc = async (doc: TripDoc) => {
    const exists = docs.some((d) => d.id === doc.id);
    await onSave(exists ? docs.map((d) => (d.id === doc.id ? doc : d)) : [...docs, doc]);
    setEditing(undefined);
  };

  const deleteDoc = async (doc: TripDoc) => {
    await onSave(docs.filter((d) => d.id !== doc.id));
    if (doc.file?.path) deleteTripDocumentFile(doc.file.path).catch(() => {});
    setEditing(undefined);
  };

  const openFile = async (doc: TripDoc) => {
    if (!doc.file) return;
    setOpening(doc.id);
    try {
      await Linking.openURL(await getTripDocumentUrl(doc.file.path));
    } catch (err: any) {
      Alert.alert("Couldn't open file", offline ? "Attachments need a connection to open." : err.message || "Something went wrong");
    } finally {
      setOpening(null);
    }
  };

  const copyRef = async (ref: string) => {
    await Clipboard.setStringAsync(ref);
    Alert.alert("Copied", ref);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <TouchableOpacity
        style={[styles.addButton, offline && { opacity: 0.5 }]}
        disabled={offline}
        onPress={() => setEditing(null)}
      >
        <Plus size={18} color="#fff" strokeWidth={3} />
        <Text style={styles.addButtonText}>ADD DOCUMENT</Text>
      </TouchableOpacity>

      {docs.length === 0 ? (
        <Text style={styles.empty}>
          Keep flight and hotel confirmations, tickets, and a copy of your passport here. Confirmation numbers stay available offline.
        </Text>
      ) : (
        <View style={{ gap: spacing(2) }}>
          {docs.map((doc) => {
            const k = kindOf(doc.kind);
            return (
              <TouchableOpacity key={doc.id} style={styles.card} onPress={() => (offline ? null : setEditing(doc))} activeOpacity={offline ? 1 : 0.7}>
                <View style={styles.cardRow}>
                  <k.Icon size={18} color={colors.stamp} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{doc.title}</Text>
                    <Text style={styles.cardKind}>{k.label}</Text>
                  </View>
                </View>
                {doc.reference ? (
                  <TouchableOpacity style={styles.refRow} onPress={() => copyRef(doc.reference!)}>
                    <Text style={styles.refText} selectable>
                      {doc.reference}
                    </Text>
                    <Copy size={13} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
                {doc.notes ? <Text style={styles.notes}>{doc.notes}</Text> : null}
                {doc.file ? (
                  <TouchableOpacity style={styles.fileRow} onPress={() => openFile(doc)}>
                    {opening === doc.id ? <ActivityIndicator size="small" color={colors.textSecondary} /> : <Paperclip size={13} color={colors.textSecondary} />}
                    <Text style={styles.link} numberOfLines={1}>
                      {doc.file.name}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {editing !== undefined && (
        <DocModal trip={trip} initial={editing} onClose={() => setEditing(undefined)} onSave={saveDoc} onDelete={deleteDoc} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    backgroundColor: colors.primaryBg,
    borderRadius: radius.lg,
    paddingVertical: spacing(3),
    marginBottom: spacing(4),
  },
  addButtonText: { color: "#fff", fontWeight: "700", letterSpacing: 0.5 },
  empty: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: spacing(2) },
  card: { padding: spacing(4), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  cardTitle: { fontWeight: "600", color: colors.textPrimary },
  cardKind: { fontSize: 12, color: colors.textMuted },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    alignSelf: "flex-start",
    marginTop: spacing(2),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  refText: { fontSize: 16, fontWeight: "700", letterSpacing: 1, color: colors.textBody, fontVariant: ["tabular-nums"] },
  notes: { fontSize: 13, color: colors.textSecondary, marginTop: spacing(2) },
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginTop: spacing(2) },
  link: { color: colors.textSecondary, fontSize: 13, textDecorationLine: "underline", flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing(5),
    paddingBottom: spacing(8),
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(4) },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2), marginBottom: spacing(4) },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1),
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  kindChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBg },
  kindText: { fontSize: 13, color: colors.textSecondary },
  label: { fontSize: 14, color: colors.textTertiary, marginBottom: spacing(1) },
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
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    marginBottom: spacing(3),
  },
  attachText: { color: colors.textPrimary, fontWeight: "500" },
  attachedRow: { flexDirection: "row", alignItems: "center", gap: spacing(2), marginBottom: spacing(3) },
  attachedName: { flex: 1, color: colors.textBody, fontSize: 14 },
  error: { color: colors.stamp, fontSize: 13, marginBottom: spacing(3) },
  primaryButton: { backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing(3), alignItems: "center" },
  primaryButtonText: { color: colors.primaryText, fontWeight: "600" },
});
