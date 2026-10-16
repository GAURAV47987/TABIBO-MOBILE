import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { colors, radius, spacing } from "../theme";
import { TRIP_TEMPLATES } from "../lib/templates";
import PlaceBanner from "../components/PlaceBanner";

export default function HomeScreen({ navigation }: any) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.greeting}>Your next adventure starts here.</Text>
      <Text style={styles.heading}>Where do you want to go next?</Text>

      <View style={styles.grid}>
        {TRIP_TEMPLATES.map((t) => {
          const totalDays = t.stops.reduce((sum, s) => sum + s.days, 0);
          return (
            <TouchableOpacity key={t.id} style={styles.tile} onPress={() => navigation.navigate("TemplatePreview", { template: t })}>
              <PlaceBanner placeName={t.stops[0].name} height={140}>
                <View style={styles.tileText}>
                  <Text style={styles.tileTitle} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tileDays}>{totalDays} days</Text>
                </View>
              </PlaceBanner>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing(3) },
  heading: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing(2) },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(3) },
  tile: { width: "47%", borderRadius: radius.lg, overflow: "hidden" },
  tileText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing(3) },
  tileTitle: { color: "#fff", fontWeight: "600", fontSize: 14 },
  tileDays: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
});
