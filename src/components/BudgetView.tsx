import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, LayoutAnimation } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Plus, Wallet, X, Trash2, Printer } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { colors, radius, spacing } from "../theme";
import { CATEGORIES, CATEGORY_COLOR, CURRENCIES, CURRENCY_SYMBOL } from "../lib/constants";
import { useFxRates } from "../lib/fx";
import { escapeHtml, exportHtmlAsPdf } from "../lib/pdf";
import { haptics } from "../lib/haptics";
import PressScale from "./PressScale";

function fmt(n: number, maxFractionDigits = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

export default function BudgetView({ trip, onSave, canEdit = true }: { trip: any; onSave: (budget: any[]) => void; canEdit?: boolean }) {
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    haptics.success();
    onSave(next);
    setShowForm(false);
    setEditingId(null);
  };

  const removeExpense = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    haptics.press();
    onSave(budget.filter((e: any) => e.id !== id));
  };

  const visibleExpenses = useMemo(() => {
    const reversed = [...budget].reverse();
    return selectedCategory ? reversed.filter((e: any) => e.category === selectedCategory) : reversed;
  }, [budget, selectedCategory]);

  const exportPDF = async () => {
    const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const row = (cols: string[]) => `<tr>${cols.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    const table = (head: string[], rows: string[][]) => `
      <table>
        <thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(row).join("")}</tbody>
      </table>`;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #222; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .meta { color: #888; font-size: 12px; margin-bottom: 16px; }
            .total { font-size: 15px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
            th { background: #B23A2E; color: #fff; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(trip.destination_name)} — Budget Summary</h1>
          <p class="meta">Generated ${escapeHtml(today)}</p>
          <p class="total">Total: ${escapeHtml(CURRENCY_SYMBOL[homeCurrency])}${escapeHtml(fmt(totalHome))} ${escapeHtml(homeCurrency)} (approx.)</p>
          ${table(["Currency", "Total"], Object.entries(totals).map(([cur, amt]) => [escapeHtml(cur), `${escapeHtml(CURRENCY_SYMBOL[cur])}${escapeHtml(fmt(amt as number, 2))}`]))}
          ${table(["Category", `Total (${homeCurrency})`], sortedCategories.map((cat) => [escapeHtml(cat), `${escapeHtml(CURRENCY_SYMBOL[homeCurrency])}${escapeHtml(fmt(categoryTotals[cat], 2))}`]))}
          ${table(
            ["Description", "Category", "Amount"],
            [...budget].reverse().map((e: any) => [
              escapeHtml(e.description),
              escapeHtml(e.category),
              `${escapeHtml(CURRENCY_SYMBOL[e.currency])}${escapeHtml(fmt(parseFloat(e.amount), 2))} ${escapeHtml(e.currency)}`,
            ])
          )}
        </body>
      </html>`;

    await exportHtmlAsPdf(html, "Budget PDF");
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing(4) }}>
      {canEdit && (
        <PressScale style={styles.addButton} onPress={openNew}>
          <Plus size={20} color="#fff" strokeWidth={3} />
          <Text style={styles.addButtonText}>ADD EXPENSE</Text>
        </PressScale>
      )}

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

      {budget.length > 0 && (
        <TouchableOpacity style={styles.exportButton} onPress={exportPDF}>
          <Printer size={16} color={colors.textPrimary} />
          <Text style={styles.exportButtonText}>Export as PDF</Text>
        </TouchableOpacity>
      )}

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
          <TouchableOpacity key={e.id} style={styles.expenseRow} onPress={() => canEdit && openEdit(e)} disabled={!canEdit}>
            <View style={{ flex: 1 }}>
              <Text style={styles.expenseDesc} numberOfLines={1}>{e.description}</Text>
              <Text style={styles.expenseCategory}>{e.category}</Text>
            </View>
            <View style={styles.expenseRight}>
              <Text style={styles.expenseAmount}>
                {CURRENCY_SYMBOL[e.currency]}
                {fmt(parseFloat(e.amount))}
              </Text>
              {canEdit && (
                <TouchableOpacity onPress={() => removeExpense(e.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={15} color={colors.stamp} />
                </TouchableOpacity>
              )}
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

            <PressScale style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>{editingId ? "Save changes" : "Add expense"}</Text>
            </PressScale>
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
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(2),
    borderRadius: radius.lg,
    paddingVertical: spacing(3),
    marginBottom: spacing(5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exportButtonText: { fontSize: 14, fontWeight: "500", color: colors.textPrimary },
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
