import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { colors, radius, spacing } from "../theme";
import { signIn, signUp, resetPasswordForEmail } from "../lib/supabase";
import { LegalDocument } from "./LegalScreen";
import type { LegalDocId } from "../lib/legal";

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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

  const submitForgot = async () => {
    setError("");
    setBusy(true);
    try {
      await resetPasswordForEmail(email.trim());
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (mode === "forgot") {
    if (resetSent) {
      return (
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              If an account exists for {email}, we sent a link to reset your password. Open it to set a new password
              on the TABIGO website, then come back here and sign in.
            </Text>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setResetSent(false);
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
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>Enter your account email and we'll send you a link to set a new password.</Text>

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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={submitForgot} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryButtonText}>Send reset link</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              setError("");
              setMode("signin");
            }}
          >
            <Text style={styles.linkText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

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

        {mode === "signin" && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => {
              setError("");
              setMode("forgot");
            }}
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.linkButton} onPress={() => setMode(mode === "signup" ? "signin" : "signup")}>
          <Text style={styles.linkText}>{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>
          By {mode === "signup" ? "creating an account" : "continuing"}, you agree to our{" "}
          <Text style={styles.legalLink} onPress={() => setLegalDoc("terms")}>
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text style={styles.legalLink} onPress={() => setLegalDoc("privacy")}>
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
      <Modal visible={legalDoc !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLegalDoc(null)}>
        {legalDoc && <LegalDocument doc={legalDoc} onClose={() => setLegalDoc(null)} />}
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  legalText: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: spacing(4), lineHeight: 18 },
  legalLink: { color: colors.textSecondary, textDecorationLine: "underline" },
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
