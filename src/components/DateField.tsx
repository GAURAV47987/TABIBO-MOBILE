import { useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme, radius, spacing, type Colors } from "../theme";
import { toISODateLocal } from "../lib/dates";

// value/onChange use the same "YYYY-MM-DD" string shape as the rest of
// the app (trip.start_date etc.) — this just wraps the native date
// picker UI around that string.
export default function DateField({ value, onChange, placeholder = "Select a date" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(value + "T00:00:00") : new Date();
  // iOS's inline picker fires one onChange immediately when it mounts,
  // reporting whatever date it's showing by default — not a real user
  // pick. Left unguarded, two empty fields opened one after another (e.g.
  // a city's From/To) would both silently collapse onto that same
  // default date before either is actually tapped.
  const justOpenedRef = useRef(false);

  const openPicker = () => {
    justOpenedRef.current = true;
    setShow(true);
  };

  const handleChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed") return;
    if (Platform.OS === "ios" && justOpenedRef.current) {
      justOpenedRef.current = false;
      return;
    }
    if (selected) {
      onChange(toISODateLocal(selected));
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={openPicker}>
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

const getStyles = (colors: Colors) =>
  StyleSheet.create({
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
