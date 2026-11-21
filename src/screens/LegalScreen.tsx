import { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { X } from "lucide-react-native";
import { useTheme, spacing, type Colors } from "../theme";
import { LEGAL_DOCS, LEGAL_EFFECTIVE_DATE, type LegalDocId } from "../lib/legal";

// Rendered both as a root-stack modal (from Profile) and inline inside a
// <Modal> on the signed-out Auth screen, which has no navigator.
export function LegalDocument({ doc, onClose }: { doc: LegalDocId; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { title, sections } = LEGAL_DOCS[doc];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing(4), paddingBottom: spacing(10) }}>
        <Text style={styles.effective}>Effective {LEGAL_EFFECTIVE_DATE}</Text>
        {sections.map((s) => (
          <View key={s.heading} style={{ marginBottom: spacing(4) }}>
            <Text style={styles.heading}>{s.heading}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function LegalScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  return <LegalDocument doc={route.params?.doc || "terms"} onClose={() => navigation.goBack()} />;
}

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing(4),
      paddingTop: spacing(6),
      paddingBottom: spacing(3),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
    effective: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(4) },
    heading: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing(1) },
    body: { fontSize: 14, lineHeight: 21, color: colors.textBody },
  });
