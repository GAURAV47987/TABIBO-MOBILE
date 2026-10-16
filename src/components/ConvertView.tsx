import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { ArrowLeftRight, RefreshCw, Wallet } from "lucide-react-native";
import { colors, radius, spacing } from "../theme";
import { CURRENCIES, CURRENCY_SYMBOL } from "../lib/constants";
import { useFxRates } from "../lib/fx";

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function ConvertView({ homeCurrency }: { homeCurrency: string }) {
  const { rates, updatedAt, status, errorDetail, refetch } = useFxRates();
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState(homeCurrency);
  const [to, setTo] = useState(homeCurrency === "EUR" ? "USD" : "EUR");

  const converted = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const inUsd = from === "USD" ? amt : amt / (rates[from] || 1);
    return to === "USD" ? inUsd : inUsd * (rates[to] || 1);
  }, [amount, from, to, rates]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const otherCurrencies = CURRENCIES.filter((c) => c !== homeCurrency);

  const statusText =
    status === "loading"
      ? "Fetching latest rates…"
      : status === "live"
      ? `Live rates as of ${updatedAt}.`
      : status === "cached"
      ? `Offline — showing rates last updated ${updatedAt}.`
      : "Offline — showing approximate rates.";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <Text style={styles.statusText}>{statusText}</Text>
      {errorDetail ? <Text style={styles.errorText}>Fetch failed: {errorDetail}</Text> : null}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={from} onValueChange={setFrom} style={{ color: colors.textBody }}>
              {CURRENCIES.map((c) => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.swapRow}>
          <TouchableOpacity style={styles.swapButton} onPress={swap}>
            <ArrowLeftRight size={14} color={colors.primaryText} />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Converted</Text>
            <View style={styles.convertedBox}>
              <Text style={styles.convertedText}>
                {CURRENCY_SYMBOL[to]}
                {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={to} onValueChange={setTo} style={{ color: colors.textBody }}>
              {CURRENCIES.map((c) => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={refetch} disabled={status === "loading"}>
          {status === "loading" ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <RefreshCw size={12} color={colors.textMuted} />
          )}
          <Text style={styles.refreshText}>Refresh rates</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Wallet size={15} color={colors.textPrimary} />
        <Text style={styles.sectionTitle}>Quick reference (→ {homeCurrency})</Text>
      </View>
      <View style={{ gap: spacing(2) }}>
        {otherCurrencies.slice(0, 8).map((cur) => (
          <View key={cur} style={styles.refCard}>
            <Text style={styles.refCurrency}>{cur}</Text>
            <View style={styles.refGrid}>
              {QUICK_AMOUNTS.map((amt) => {
                const inUsd = cur === "USD" ? amt : amt / (rates[cur] || 1);
                const inHome = homeCurrency === "USD" ? inUsd : inUsd * (rates[homeCurrency] || 1);
                return (
                  <View key={amt} style={styles.refCell}>
                    <Text style={styles.refFrom}>
                      {CURRENCY_SYMBOL[cur]}
                      {amt}
                    </Text>
                    <Text style={styles.refTo}>
                      {CURRENCY_SYMBOL[homeCurrency]}
                      {inHome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusText: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  errorText: { fontSize: 11, color: colors.stamp, marginBottom: spacing(4) },
  card: {
    borderRadius: radius.lg,
    padding: spacing(4),
    marginBottom: spacing(5),
    marginTop: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", gap: spacing(2), alignItems: "flex-end" },
  label: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: colors.textMuted, marginBottom: spacing(1) },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.textBody,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 18,
  },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: radius.md, overflow: "hidden", minWidth: 110 },
  swapRow: { alignItems: "center", marginVertical: spacing(1) },
  swapButton: { backgroundColor: colors.primaryBg, borderRadius: 999, padding: spacing(2) },
  convertedBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  convertedText: { fontSize: 18, fontWeight: "700", color: colors.textBody },
  refreshButton: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), alignSelf: "center", marginTop: spacing(3) },
  refreshText: { fontSize: 12, color: colors.textMuted },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginBottom: spacing(2) },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  refCard: { borderRadius: radius.lg, padding: spacing(3), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  refCurrency: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(2) },
  refGrid: { flexDirection: "row", justifyContent: "space-between" },
  refCell: { alignItems: "center" },
  refFrom: { fontSize: 11, color: colors.textMuted },
  refTo: { fontSize: 14, fontWeight: "500", color: colors.textBody },
});
