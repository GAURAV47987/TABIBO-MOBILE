import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Mail } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { listMyPendingInvites, acceptTripInvite, declineTripInvite } from "../lib/supabase";
import { haptics } from "../lib/haptics";

type Invite = { collaborator_id: string; trip_id: string; destination_name: string; role: string; invited_by_email: string };

// A small "you've been invited" list on Home — invites are never
// auto-accepted, so this is the only place they surface until the user
// explicitly says yes.
export default function PendingInvites() {
  const navigation = useNavigation<any>();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listMyPendingInvites()
      .then(setInvites)
      .catch(() => setInvites([]));
  }, []);

  useFocusEffect(refresh);

  const accept = async (invite: Invite) => {
    setBusyId(invite.collaborator_id);
    try {
      await acceptTripInvite(invite.trip_id);
      haptics.success();
      refresh();
      navigation.navigate("TripHub", { tripId: invite.trip_id });
    } catch (e) {
      haptics.error();
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (invite: Invite) => {
    setBusyId(invite.collaborator_id);
    try {
      await declineTripInvite(invite.trip_id);
      haptics.select();
      refresh();
    } catch (e) {
      haptics.error();
    } finally {
      setBusyId(null);
    }
  };

  if (!invites || invites.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {invites.map((invite) => (
        <View key={invite.collaborator_id} style={styles.card}>
          <Mail size={16} color={colors.stamp} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.text}>
              <Text style={styles.bold}>{invite.invited_by_email}</Text> invited you to{" "}
              <Text style={styles.bold}>{invite.destination_name}</Text> as {invite.role === "editor" ? "an editor" : "a viewer"}
            </Text>
            {busyId === invite.collaborator_id ? (
              <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primaryBg} />
            ) : (
              <View style={styles.row}>
                <TouchableOpacity style={styles.acceptButton} onPress={() => accept(invite)}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineButton} onPress={() => decline(invite)}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(2), marginBottom: spacing(4) },
  card: {
    flexDirection: "row",
    gap: spacing(2.5),
    padding: spacing(3.5),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stamp,
  },
  text: { fontSize: 13, color: colors.textBody, lineHeight: 19 },
  bold: { fontWeight: "600", color: colors.textPrimary },
  row: { flexDirection: "row", gap: spacing(2), marginTop: spacing(2.5) },
  acceptButton: { paddingHorizontal: spacing(3.5), paddingVertical: spacing(1.5), borderRadius: radius.md, backgroundColor: colors.stamp },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  declineButton: { paddingHorizontal: spacing(3.5), paddingVertical: spacing(1.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  declineText: { color: colors.textBody, fontSize: 13, fontWeight: "500" },
});
