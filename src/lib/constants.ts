export const CATEGORIES = ["Flights", "Accommodation", "Food", "Activities", "Transport", "Shopping", "Other"];

// Same validated categorical palette as the web app's --cat-* CSS custom
// properties, as plain hex since React Native has no CSS variables.
export const CATEGORY_COLOR: Record<string, string> = {
  Flights: "#2a78d6",
  Accommodation: "#eb6834",
  Food: "#1baf7a",
  Activities: "#eda100",
  Transport: "#e87ba4",
  Shopping: "#008300",
  Other: "#4a3aa7",
};

export const CURRENCIES = [
  "USD", "EUR", "GBP", "AUD", "CAD", "NZD", "CHF",
  "INR", "JPY", "CNY", "SGD", "THB", "IDR", "VND", "MYR", "PHP", "KRW",
  "HUF", "CZK", "TRY", "MXN", "BRL", "ZAR", "AED", "EGP",
];

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "$", CAD: "$", NZD: "$", CHF: "Fr",
  INR: "₹", JPY: "¥", CNY: "¥", SGD: "$", THB: "฿", IDR: "Rp", VND: "₫", MYR: "RM", PHP: "₱", KRW: "₩",
  HUF: "Ft", CZK: "Kč", TRY: "₺", MXN: "$", BRL: "R$", ZAR: "R", AED: "د.إ", EGP: "E£",
};

export const FX_FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, AUD: 1.53, CAD: 1.36, NZD: 1.66, CHF: 0.88,
  INR: 84, JPY: 152, CNY: 7.2, SGD: 1.34, THB: 34, IDR: 15800, VND: 25400, MYR: 4.5, PHP: 57, KRW: 1380,
  HUF: 362, CZK: 23, TRY: 34, MXN: 17, BRL: 5.1, ZAR: 18, AED: 3.67, EGP: 49,
};

export const FX_STORAGE_KEY = "tabigo-fx-rates";
export const FX_API_URLS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
  "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
];
