import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

// Shared by every PDF export (Budget, Itinerary) — one place to fix
// HTML-escaping and iOS/Android share-sheet quirks for all of them at once.
export function escapeHtml(s: any) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function exportHtmlAsPdf(html: string, dialogTitle: string) {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
  }
}
