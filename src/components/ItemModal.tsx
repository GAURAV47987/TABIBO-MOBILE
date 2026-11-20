import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, BackHandler } from "react-native";
import { colors, radius, spacing } from "../theme";
import { geocodeDestination } from "../lib/geocode";
import TimeField from "./TimeField";

// Deliberately NOT RN's core <Modal>: Expo Go's own native Modal host has a
// use-after-free crash (objc_retain on a deallocated object, confirmed from
// a device crash log) that reproduces exactly with a focused TextInput
// inside it. A plain absolutely-positioned overlay, rendered by the parent
// screen outside its ScrollView, gives the same full-screen popup without
// going anywhere near that native code path.

export default function ItemModal({
  date,
  initial,
  onSave,
  onDelete,
  onClose,
  readOnly = false,
}: {
  date: string;
  initial?: any;
  onSave: (fields: any) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [time, setTime] = useState(initial?.time || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [location, setLocation] = useState(initial?.location || "");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState("");
  const titleRef = useRef<any>(null);

  useEffect(() => {
    if (readOnly) return;
    const t = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [readOnly]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const submit = async () => {
    if (!title.trim()) return;
    const trimmedLocation = location.trim();
    let lat = initial?.lat ?? null;
    let lng = initial?.lng ?? null;

    if (trimmedLocation !== (initial?.location || "")) {
      if (!trimmedLocation) {
        lat = null;
        lng = null;
      } else {
        setGeocoding(true);
        setGeocodeError("");
        try {
          const place = await geocodeDestination(trimmedLocation);
          lat = place.lat;
          lng = place.lng;
        } catch (err) {
          lat = null;
          lng = null;
          setGeocodeError("Couldn't find that place — saved without a map pin.");
        } finally {
          setGeocoding(false);
        }
      }
    }

    onSave({ id: initial?.id, date, time, title: title.trim(), notes: notes.trim(), location: trimmedLocation, lat, lng });
  };

  return (
    <View style={styles.overlayWrap}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{readOnly ? "Plan details" : initial ? "Edit plan" : "Add to itinerary"}</Text>

          <Text style={styles.label}>Time (optional)</Text>
          <View style={{ marginBottom: spacing(3) }}>
            {readOnly ? <Text style={styles.readOnlyValue}>{time || "—"}</Text> : <TimeField value={time} onChange={setTime} placeholder="Select a time" />}
          </View>

          <Text style={styles.label}>What's happening?</Text>
          {readOnly ? (
            <Text style={[styles.readOnlyValue, { marginBottom: spacing(3) }]}>{title}</Text>
          ) : (
            <TextInput
              ref={titleRef}
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Uluwatu temple sunset"
              placeholderTextColor={colors.textFaint}
            />
          )}

          {(!readOnly || notes) && (
            <>
              <Text style={styles.label}>Notes (optional)</Text>
              {readOnly ? (
                <Text style={[styles.readOnlyValue, { marginBottom: spacing(3) }]}>{notes}</Text>
              ) : (
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholderTextColor={colors.textFaint}
                />
              )}
            </>
          )}

          {(!readOnly || location) && (
            <>
              <Text style={styles.label}>Location (optional — drops a pin on the Map)</Text>
              {readOnly ? (
                <Text style={[styles.readOnlyValue, { marginBottom: spacing(3) }]}>{location}</Text>
              ) : (
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Uluwatu Temple, Bali"
                  placeholderTextColor={colors.textFaint}
                />
              )}
            </>
          )}
          {geocodeError ? <Text style={styles.errorText}>{geocodeError}</Text> : null}

          {readOnly ? (
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.row}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={geocoding}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={submit} disabled={geocoding}>
                  <Text style={styles.saveText}>{geocoding ? "Finding place…" : "Save"}</Text>
                </TouchableOpacity>
              </View>

              {initial && (
                <TouchableOpacity style={styles.deleteLink} onPress={() => onDelete(initial.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(4),
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing(6),
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing(4),
  },
  label: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: spacing(1),
  },
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
  readOnlyValue: {
    fontSize: 16,
    color: colors.textBody,
    marginBottom: spacing(3),
  },
  errorText: {
    color: colors.stamp,
    fontSize: 12,
    marginTop: -spacing(2),
    marginBottom: spacing(3),
  },
  row: {
    flexDirection: "row",
    gap: spacing(2),
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.textBody,
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing(2.5),
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.primaryBg,
  },
  saveText: {
    color: colors.primaryText,
    fontWeight: "600",
  },
  deleteLink: {
    marginTop: spacing(3),
    alignItems: "center",
  },
  deleteText: {
    color: colors.stamp,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
