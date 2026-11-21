import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { X } from "lucide-react-native";
import { useTheme, radius, spacing, type Colors } from "../theme";
import { listAllTripsAsAdmin } from "../lib/supabase";

function dateRangeLabel(start?: string | null, end?: string | null) {
  return start && end ? `${start} — ${end}` : "Dates not set yet";
}

export default function AdminScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listAllTripsAsAdmin()
      .then(setRows)
      .catch((err: any) => setError(err.message || "Could not load admin data"));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin: all trips</Text>
          <Text style={styles.headerSubtitle}>Every trip, every user.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : rows === null ? (
        <ActivityIndicator color={colors.primaryBg} style={{ marginTop: spacing(6) }} />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No trips created yet.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.destination_name}</Text>
              <Text style={styles.cardDate}>{dateRangeLabel(item.start_date, item.end_date)}</Text>
              <Text style={styles.cardEmail}>{item.user_email}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing(4),
      paddingTop: spacing(6),
      paddingBottom: spacing(3),
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
    headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: spacing(1) },
    errorText: { color: colors.stamp, marginHorizontal: spacing(4), marginTop: spacing(4) },
    emptyText: { color: colors.textSecondary, marginHorizontal: spacing(4), marginTop: spacing(4) },
    card: {
      padding: spacing(4),
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
    cardDate: { fontSize: 13, color: colors.textSecondary, marginTop: spacing(0.5) },
    cardEmail: { fontSize: 13, color: colors.textTertiary, marginTop: spacing(1) },
  });
