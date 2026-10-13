import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

export default function PlaceholderScreen({ label }: { label: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(4),
  },
  text: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});
