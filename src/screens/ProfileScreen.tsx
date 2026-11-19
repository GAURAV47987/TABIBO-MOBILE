import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { User, X } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { signOut, changePassword, getAvatarUrl, uploadAvatar, deleteMyAccount } from "../lib/supabase";
import { isAdmin } from "../lib/admin";
import { haptics } from "../lib/haptics";
import PressScale from "../components/PressScale";

export default function ProfileScreen({ session, navigation }: any) {
  const [avatarUrl, setAvatarUrl] = useState(() => getAvatarUrl(session.user.id));
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);

  // Two-step confirm: account deletion is immediate and irreversible.
  const confirmDeleteAccount = () => {
    haptics.warning();
    Alert.alert(
      "Delete your account?",
      "This permanently deletes your account and everything in it — all trips, itineraries, budgets, documents and photos. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            Alert.alert("Are you absolutely sure?", `Your account ${session.user.email} will be deleted now.`, [
              { text: "Keep my account", style: "cancel" },
              { text: "Delete forever", style: "destructive", onPress: runDeleteAccount },
            ]),
        },
      ]
    );
  };

  const runDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteMyAccount();
      // The auth listener in App.tsx switches to the Auth screen.
    } catch (err: any) {
      setDeleting(false);
      haptics.error();
      Alert.alert("Couldn't delete account", (err.message || "Something went wrong") + "\n\nCheck your connection and try again.");
    }
  };

  const memberSince = session.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError("Photo library access is needed to set a profile photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAvatarError("");
    setAvatarBusy(true);
    try {
      const url = await uploadAvatar(asset.uri, asset.mimeType || "image/jpeg");
      setAvatarUrl(url);
      setAvatarBroken(false);
    } catch (err: any) {
      setAvatarError(err.message || "Could not upload photo");
    } finally {
      setAvatarBusy(false);
    }
  };

  const submitPassword = async () => {
    setError("");
    setSuccess("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await changePassword(newPassword);
      haptics.success();
      setSuccess("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Could not update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
        <View style={{ alignItems: "center", marginBottom: spacing(4) }}>
          <View style={styles.avatarWrap}>
            {!avatarBroken ? (
              <Image
                source={{ uri: avatarUrl }}
                style={StyleSheet.absoluteFill}
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <User size={36} color={colors.iconEmpty} />
              </View>
            )}
            {avatarBusy && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </View>
          <TouchableOpacity onPress={pickAvatar} disabled={avatarBusy}>
            <Text style={styles.linkText}>{avatarBroken ? "Add a photo" : "Change photo"}</Text>
          </TouchableOpacity>
          {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{session.user.email}</Text>
          {memberSince && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing(2) }]}>Member since</Text>
              <Text style={styles.fieldValue}>{memberSince}</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Plan</Text>
          <Text style={styles.fieldValue}>Free</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change password</Text>

          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            placeholderTextColor={colors.textFaint}
          />

          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholderTextColor={colors.textFaint}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <PressScale style={[styles.primaryButton, busy && { opacity: 0.6 }]} onPress={submitPassword} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryButtonText}>Update password</Text>}
          </PressScale>
        </View>

        {isAdmin(session) && (
          <TouchableOpacity style={styles.adminButton} onPress={() => navigation.navigate("Admin")}>
            <Text style={styles.adminButtonText}>Admin: view all trips</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            haptics.warning();
            signOut().catch((err: any) => {
              haptics.error();
              Alert.alert("Couldn't sign out", err.message || "Check your connection and try again.");
            });
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => navigation.navigate("Legal", { doc: "terms" })}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Legal", { doc: "privacy" })}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteAccountButton} onPress={confirmDeleteAccount} disabled={deleting}>
          {deleting ? <ActivityIndicator color={colors.stamp} /> : <Text style={styles.deleteAccountText}>Delete account</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing(4),
    paddingTop: spacing(6),
    paddingBottom: spacing(3),
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing(2),
  },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { color: colors.textSecondary, fontSize: 14, textDecorationLine: "underline" },
  card: {
    padding: spacing(4),
    borderRadius: radius.lg,
    marginBottom: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldLabel: { fontSize: 11, color: colors.textMuted },
  fieldValue: { fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing(3) },
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
  errorText: { color: colors.stamp, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(2) },
  successText: { color: colors.textPrimary, fontSize: 13, marginBottom: spacing(2) },
  primaryButton: { backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing(2.5), alignItems: "center" },
  primaryButtonText: { color: colors.primaryText, fontWeight: "600" },
  adminButton: {
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    alignItems: "center",
    marginBottom: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stamp,
  },
  adminButtonText: { color: colors.stamp, fontWeight: "600" },
  signOutButton: {
    paddingVertical: spacing(3),
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  signOutText: { color: colors.stamp, fontWeight: "600" },
  legalRow: { flexDirection: "row", justifyContent: "center", gap: spacing(6), marginTop: spacing(6) },
  deleteAccountButton: { alignItems: "center", paddingVertical: spacing(4), marginTop: spacing(2), marginBottom: spacing(6) },
  deleteAccountText: { color: colors.stamp, fontSize: 14 },
});
