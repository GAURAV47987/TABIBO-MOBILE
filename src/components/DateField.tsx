import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, radius, spacing } from "../theme";

// value/onChange use the same "YYYY-MM-DD" string shape as the rest of
// the app (trip.start_date etc.) — this just wraps the native date
// picker UI around that string.
export default function DateField({ value, onChange, placeholder = "Select a date" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(value + "T00:00:00") : new Date();

  const handleChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed") return;
    if (selected) {
      const iso = selected.toISOString().slice(0, 10);
      onChange(iso);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={handleChange}
        />
      )}
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
