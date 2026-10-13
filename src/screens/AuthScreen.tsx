import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { colors, radius, spacing } from "../theme";
import { signIn, signUp } from "../lib/supabase";

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password);
        setConfirmSent(true);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {email}. Tap it, then come back and sign in.
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              setConfirmSent(false);
              setMode("signin");
            }}
          >
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>TABIGO</Text>
        <Text style={styles.subtitle}>Plan any trip, anywhere.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.textFaint}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryButtonText}>{mode === "signup" ? "Create account" : "Sign in"}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => setMode(mode === "signup" ? "signin" : "signup")}>
          <Text style={styles.linkText}>{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing(6),
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing(1),
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing(6),
  },
  label: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: spacing(1),
  },
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
  error: {
    color: colors.stamp,
    fontSize: 14,
    marginBottom: spacing(3),
  },
  primaryButton: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: "center",
    marginTop: spacing(1),
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: spacing(4),
    alignItems: "center",
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
