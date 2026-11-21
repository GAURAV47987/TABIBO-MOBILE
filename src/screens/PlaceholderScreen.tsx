import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme, spacing, type Colors } from "../theme";

export default function PlaceholderScreen({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
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
