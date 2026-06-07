import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_MODE_DEFAULT } from "@/constants/config";

const APP_MODE_KEY = "dr-laundry-app-mode-v1";

export async function getAppMode(): Promise<"customer" | "driver"> {
  try {
    const value = await AsyncStorage.getItem(APP_MODE_KEY);
    if (value === "customer" || value === "driver") {
      return value;
    }
    return APP_MODE_DEFAULT;
  } catch {
    return APP_MODE_DEFAULT;
  }
}

export async function setAppMode(mode: "customer" | "driver"): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_MODE_KEY, mode);
  } catch {
    // ignore
  }
}
