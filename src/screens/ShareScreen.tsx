import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { X, UserPlus, Trash2 } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { inviteTripCollaborator, listTripCollaborators, updateCollaboratorRole, removeCollaborator } from "../lib/supabase";
import { haptics } from "../lib/haptics";
import PressScale from "../components/PressScale";

type Collaborator = { id: string; role: string; status: string; email: string };

export default function ShareScreen({ route, navigation }: any) {
  const { tripId, destinationName } = route.params;
  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    listTripCollaborators(tripId)
      .then(setCollaborators)
      .catch((err: any) => setError(err.message || "Could not load who has access"));
  }, [tripId]);

  useFocusEffect(refresh);

  const invite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      await inviteTripCollaborator(tripId, trimmed, role);
      haptics.success();
      setEmail("");
      refresh();
    } catch (err: any) {
      setError(err.message || "Could not send that invite");
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  const changeRole = (c: Collaborator) => {
    const next = c.role === "editor" ? "viewer" : "editor";
    updateCollaboratorRole(c.id, next)
      .then(() => {
        haptics.select();
        refresh();
      })
      .catch((err: any) => Alert.alert("Couldn't change role", err.message || "Something went wrong"));
  };

  const remove = (c: Collaborator) => {
    Alert.alert("Remove access?", `${c.email} will no longer be able to see this trip.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          haptics.press();
          removeCollaborator(c.id)
            .then(refresh)
            .catch((err: any) => Alert.alert("Couldn't remove", err.message || "Something went wrong"));
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Share trip</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {destinationName}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
        <View style={styles.card}>
          <Text style={styles.label}>Invite by email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="someone@example.com"
            placeholderTextColor={colors.textFaint}
          />

          <View style={styles.roleRow}>
            <TouchableOpacity style={[styles.roleChip, role === "editor" && styles.roleChipActive]} onPress={() => setRole("editor")}>
              <Text style={[styles.roleChipText, role === "editor" && styles.roleChipTextActive]}>Can edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roleChip, role === "viewer" && styles.roleChipActive]} onPress={() => setRole("viewer")}>
              <Text style={[styles.roleChipText, role === "viewer" && styles.roleChipTextActive]}>View only</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PressScale style={[styles.inviteButton, (busy || !email.trim()) && { opacity: 0.6 }]} onPress={invite} disabled={busy || !email.trim()}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <UserPlus size={16} color="#fff" />
                <Text style={styles.inviteButtonText}>Send invite</Text>
              </>
            )}
          </PressScale>
        </View>

        <Text style={styles.sectionTitle}>Who has access</Text>
        {collaborators === null ? (
          <ActivityIndicator color={colors.primaryBg} />
        ) : collaborators.length === 0 ? (
          <Text style={styles.emptyText}>Just you so far.</Text>
        ) : (
          <View style={{ gap: spacing(2) }}>
            {collaborators.map((c) => (
              <View key={c.id} style={styles.collabRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.collabEmail} numberOfLines={1}>
                    {c.email}
                  </Text>
                  <Text style={styles.collabStatus}>{c.status === "pending" ? "Invited — not yet accepted" : c.status === "declined" ? "Declined" : "Has access"}</Text>
                </View>
                <TouchableOpacity onPress={() => changeRole(c)} style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{c.role === "editor" ? "Can edit" : "View only"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={16} color={colors.stamp} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
    paddingBottom: spacing(3),
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: spacing(1), maxWidth: 240 },
  card: {
    padding: spacing(4),
    borderRadius: radius.lg,
    marginBottom: spacing(5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 14, color: colors.textTertiary, marginBottom: spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.textBody,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 16,
    marginBottom: spacing(3),
  },
  roleRow: { flexDirection: "row", gap: spacing(2), marginBottom: spacing(3) },
  roleChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing(2),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  roleChipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBg },
  roleChipText: { fontSize: 13, color: colors.textBody, fontWeight: "500" },
  roleChipTextActive: { color: colors.primaryText },
  errorText: { color: colors.stamp, fontSize: 13, marginBottom: spacing(2) },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1.5),
    backgroundColor: colors.stamp,
    borderRadius: radius.md,
    paddingVertical: spacing(2.8),
  },
  inviteButtonText: { color: "#fff", fontWeight: "600" },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: spacing(2) },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  collabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2),
    padding: spacing(3),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collabEmail: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  collabStatus: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  roleBadge: { paddingHorizontal: spacing(2.5), paddingVertical: spacing(1.5), borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  roleBadgeText: { fontSize: 12, color: colors.textBody, fontWeight: "500" },
});
