import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Plus, Wallet, X, Trash2 } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { CATEGORIES, CATEGORY_COLOR, CURRENCIES, CURRENCY_SYMBOL } from "../lib/constants";
import { useFxRates } from "../lib/fx";

function fmt(n: number, maxFractionDigits = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

export default function BudgetView({ trip, onSave }: { trip: any; onSave: (budget: any[]) => void }) {
  const budget = trip.budget || [];
  const homeCurrency = trip.home_currency || "USD";
  const { rates } = useFxRates();

  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", amount: "", currency: homeCurrency, category: "Activities" });

  const openEdit = (expense: any) => {
    setForm({ description: expense.description, amount: String(expense.amount), currency: expense.currency, category: expense.category });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const openNew = () => {
    setForm({ description: "", amount: "", currency: homeCurrency, category: "Activities" });
    setEditingId(null);
    setShowForm(true);
  };

  const toHome = (amt: number, currency: string) => {
    const usd = currency === "USD" ? amt : amt / (rates[currency] || 1);
    return homeCurrency === "USD" ? usd : usd * (rates[homeCurrency] || 1);
  };

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    budget.forEach((e: any) => {
      const amt = parseFloat(e.amount) || 0;
      t[e.currency] = (t[e.currency] || 0) + amt;
    });
    return t;
  }, [budget]);

  const categoryTotals = useMemo(() => {
    const t: Record<string, number> = {};
    budget.forEach((e: any) => {
      const amt = parseFloat(e.amount) || 0;
      t[e.category] = (t[e.category] || 0) + toHome(amt, e.currency);
    });
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget, homeCurrency, rates]);

  const sortedCategories = useMemo(
    () => CATEGORIES.filter((c) => categoryTotals[c] > 0).sort((a, b) => categoryTotals[b] - categoryTotals[a]),
    [categoryTotals]
  );
  const maxCategoryTotal = Math.max(0, ...Object.values(categoryTotals));
  const totalHome = useMemo(() => Object.values(categoryTotals).reduce((sum, v) => sum + v, 0), [categoryTotals]);

  const submit = () => {
    if (!form.description || !form.amount) return;
    let next;
    if (editingId) {
      next = budget.map((e: any) => (e.id === editingId ? { ...e, ...form } : e));
    } else {
      next = [...budget, { ...form, id: randomUUID() }];
    }
    onSave(next);
    setShowForm(false);
    setEditingId(null);
  };

  const removeExpense = (id: string) => onSave(budget.filter((e: any) => e.id !== id));

  const visibleExpenses = useMemo(() => {
    const reversed = [...budget].reverse();
    return selectedCategory ? reversed.filter((e: any) => e.category === selectedCategory) : reversed;
  }, [budget, selectedCategory]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      <TouchableOpacity style={styles.addButton} onPress={openNew}>
        <Plus size={20} color="#fff" strokeWidth={3} />
        <Text style={styles.addButtonText}>ADD EXPENSE</Text>
      </TouchableOpacity>

      {Object.keys(totals).length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL (≈ {homeCurrency})</Text>
          <Text style={styles.totalAmount}>
            {CURRENCY_SYMBOL[homeCurrency]}
            {fmt(totalHome)}
          </Text>
          <Text style={styles.totalNote}>Every currency below, converted at the latest rate</Text>
        </View>
      )}

      <View style={styles.currencyGrid}>
        {Object.keys(totals).length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No expenses logged yet</Text>
          </View>
        )}
        {Object.entries(totals).map(([cur, amt]) => (
          <View key={cur} style={styles.currencyTile}>
            <Text style={styles.currencyLabel}>{cur} total</Text>
            <Text style={styles.currencyAmount}>
              {CURRENCY_SYMBOL[cur]}
              {fmt(amt)}
            </Text>
          </View>
        ))}
      </View>

      {sortedCategories.length > 0 && (
        <View style={{ marginBottom: spacing(5) }}>
          <View style={styles.sectionHeader}>
            <Wallet size={15} color={colors.textPrimary} />
            <Text style={styles.sectionTitle}>By category (≈ {homeCurrency})</Text>
          </View>
          <View style={styles.categoryCard}>
            {sortedCategories.map((cat) => {
              const amt = categoryTotals[cat];
              const pct = maxCategoryTotal > 0 ? (amt / maxCategoryTotal) * 100 : 0;
              const active = selectedCategory === cat;
              const color = CATEGORY_COLOR[cat];
              return (
                <TouchableOpacity key={cat} onPress={() => setSelectedCategory(active ? null : cat)} style={{ marginBottom: spacing(3) }}>
                  <View style={styles.categoryRow}>
                    <Text style={[styles.categoryName, { color: active ? color : colors.textTertiary, fontWeight: active ? "600" : "400" }]}>{cat}</Text>
                    <Text style={styles.categoryAmount}>
                      ≈{CURRENCY_SYMBOL[homeCurrency]}
                      {fmt(amt)}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {selectedCategory && (
        <TouchableOpacity
          style={[styles.filterChip, { borderColor: CATEGORY_COLOR[selectedCategory] }]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={{ color: CATEGORY_COLOR[selectedCategory], fontSize: 12, fontWeight: "500" }}>Showing: {selectedCategory}</Text>
          <X size={13} color={CATEGORY_COLOR[selectedCategory]} />
        </TouchableOpacity>
      )}

      <View style={{ gap: spacing(2) }}>
        {visibleExpenses.map((e: any) => (
          <TouchableOpacity key={e.id} style={styles.expenseRow} onPress={() => openEdit(e)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expenseDesc} numberOfLines={1}>{e.description}</Text>
              <Text style={styles.expenseCategory}>{e.category}</Text>
            </View>
            <View style={styles.expenseRight}>
              <Text style={styles.expenseAmount}>
                {CURRENCY_SYMBOL[e.currency]}
                {fmt(parseFloat(e.amount))}
              </Text>
              <TouchableOpacity onPress={() => removeExpense(e.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={15} color={colors.stamp} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "Edit expense" : "New expense"}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="What was it for?"
              placeholderTextColor={colors.textFaint}
              value={form.description}
              onChangeText={(v) => setForm({ ...form, description: v })}
            />

            <View style={styles.amountRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Amount"
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={(v) => setForm({ ...form, amount: v })}
              />
              <View style={styles.pickerWrap}>
                <Picker selectedValue={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })} style={{ color: colors.textBody }}>
                  {CURRENCIES.map((c) => (
                    <Picker.Item key={c} label={c} value={c} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={[styles.pickerWrap, { marginBottom: spacing(3) }]}>
              <Picker selectedValue={form.category} onValueChange={(v) => setForm({ ...form, category: v })} style={{ color: colors.textBody }}>
                {CATEGORIES.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>{editingId ? "Save changes" : "Add expense"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    backgroundColor: colors.stamp,
    borderRadius: radius.lg,
    paddingVertical: spacing(4),
    marginBottom: spacing(5),
  },
  addButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  totalCard: {
    backgroundColor: colors.stamp,
    borderRadius: radius.lg,
    padding: spacing(4),
    marginBottom: spacing(2.5),
  },
  totalLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 1 },
  totalAmount: { color: "#fff", fontSize: 30, fontWeight: "700" },
  totalNote: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 2 },
  currencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2), marginBottom: spacing(5) },
  emptyCard: {
    flex: 1,
    minWidth: "100%",
    borderRadius: radius.lg,
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: colors.textMuted },
  currencyTile: {
    width: "47%",
    borderRadius: radius.lg,
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyLabel: { fontSize: 11, color: colors.textMuted },
  currencyAmount: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginBottom: spacing(2) },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  categoryCard: {
    borderRadius: radius.lg,
    padding: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: spacing(1) },
  categoryName: { fontSize: 14 },
  categoryAmount: { fontSize: 12, color: colors.textMuted },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.5),
    alignSelf: "flex-start",
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: spacing(3),
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.lg,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expenseDesc: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
  expenseCategory: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  expenseRight: { flexDirection: "row", alignItems: "center", gap: spacing(3) },
  expenseAmount: { fontSize: 14, fontWeight: "500", color: colors.textBody },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: spacing(4) },
  modalCard: { width: "100%", maxWidth: 400, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing(5), borderWidth: 1, borderColor: colors.border },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(3) },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
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
  amountRow: { flexDirection: "row", gap: spacing(2), alignItems: "center" },
  pickerWrap: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, borderRadius: radius.md, overflow: "hidden", minWidth: 110 },
  submitButton: { backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing(2.5), alignItems: "center" },
  submitText: { color: colors.primaryText, fontWeight: "600" },
});
