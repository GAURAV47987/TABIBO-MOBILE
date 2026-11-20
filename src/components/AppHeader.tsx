import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { User } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";

// Shared top bar for the Home and Trips tabs — mirrors the web Dashboard's
// header (logo + profile button, admin link added once isAdmin lands here).
// SafeAreaView (not a plain View) keeps it clear of the notch/status bar —
// a fixed paddingTop here previously rendered under the system clock on
// notched phones.
export default function AppHeader() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView edges={["top"]} style={styles.row}>
      <TouchableOpacity onPress={() => navigation.navigate("Home")} accessibilityLabel="Go to home">
        <Text style={styles.logo}>TABIGO</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.getParent()?.navigate("Profile")}
        style={styles.profileButton}
        accessibilityLabel="Profile"
      >
        <User size={16} color={colors.textPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(3),
  },
  logo: { fontSize: 22, fontWeight: "800", color: colors.primaryBg, letterSpacing: 0.5 },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
