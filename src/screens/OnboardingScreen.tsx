import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Route, Sparkles, WifiOff } from "lucide-react-native";
import { useTheme, radius, spacing, type Colors } from "../theme";

// First-run walkthrough, shown once per device after signing in. The
// "seen" flag lives in AsyncStorage (see App.tsx), so reinstalling the
// app shows it again — which is fine for a 3-card intro.

const SLIDES = [
  {
    Icon: Route,
    title: "Start with where you're going",
    body: "Tap the + button to create a trip. Add one destination or several stops, and how many days you'll spend in each.",
  },
  {
    Icon: Sparkles,
    title: "Plan every day",
    body: "Each trip gets a day-by-day itinerary — add plans yourself or let AI draft one. Track spending in Budget, pack with a checklist, and see it all on the map.",
  },
  {
    Icon: WifiOff,
    title: "Ready when you land",
    body: "Trips you've opened stay viewable offline. Keep booking confirmations in Docs, turn on reminders, and tap Directions on the map to get between stops.",
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topRow}>
        {!last ? (
          <TouchableOpacity onPress={onDone} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <slide.Icon size={44} color={colors.primaryBg} strokeWidth={1.75} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => (last ? onDone() : setIndex(index + 1))}>
        <Text style={styles.buttonText}>{last ? "Get started" : "Next"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing(6), paddingBottom: spacing(6) },
    topRow: { flexDirection: "row", justifyContent: "flex-end", paddingTop: spacing(2), minHeight: spacing(8) },
    skip: { color: colors.textSecondary, fontSize: 15 },
    content: { flex: 1, alignItems: "center", justifyContent: "center" },
    iconWrap: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing(8),
    },
    title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary, textAlign: "center", marginBottom: spacing(3) },
    body: { fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: "center", maxWidth: 340 },
    dots: { flexDirection: "row", justifyContent: "center", gap: spacing(2), marginBottom: spacing(6) },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.iconEmpty },
    dotActive: { width: 22, backgroundColor: colors.primaryBg },
    button: { backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing(3.5), alignItems: "center" },
    buttonText: { color: colors.primaryText, fontWeight: "700", fontSize: 16 },
  });
