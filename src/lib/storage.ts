import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage's API is always async (unlike the web app's synchronous
// localStorage), so callers read this as a Promise rather than inline
// during render.
export async function loadFromStorage<T = any>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function saveToStorage(key: string, value: any) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}
