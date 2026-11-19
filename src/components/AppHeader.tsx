import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { User } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";

// Shared top bar for the Home and Trips tabs — mirrors the web Dashboard's
// header (logo + profile button, admin link added once isAdmin lands here).
export default function AppHeader() {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.row}>
      <Text style={styles.logo}>TABIGO</Text>
      <TouchableOpacity
        onPress={() => navigation.getParent()?.navigate("Profile")}
        style={styles.profileButton}
        accessibilityLabel="Profile"
      >
        <User size={16} color={colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
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
