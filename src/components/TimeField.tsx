import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, radius, spacing } from "../theme";

// value/onChange use the same "HH:MM" (24h) string shape as the rest of
// the app (itinerary item.time etc.) — wraps the native time picker UI
// around that string, same pattern as DateField.
export default function TimeField({ value, onChange, placeholder = "Select a time" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const timeValue = (() => {
    const d = new Date();
    if (value && /^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(":").map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  })();

  const handleChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed") return;
    if (selected) {
      const hh = String(selected.getHours()).padStart(2, "0");
      const mm = String(selected.getMinutes()).padStart(2, "0");
      onChange(`${hh}:${mm}`);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{value || placeholder}</Text>
      </TouchableOpacity>
      {show && <DateTimePicker value={timeValue} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={handleChange} />}
      {Platform.OS === "ios" && show && (
        <TouchableOpacity style={styles.doneButton} onPress={() => setShow(false)}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  valueText: { color: colors.textBody, fontSize: 16 },
  placeholderText: { color: colors.textFaint, fontSize: 16 },
  doneButton: { alignSelf: "flex-end", paddingVertical: spacing(1.5), paddingHorizontal: spacing(3) },
  doneText: { color: colors.primaryBg, fontWeight: "600" },
});
