import type { OrderDraft } from "@/types/order";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "dl_order_draft_v1";

export async function saveDraft(draft: Partial<OrderDraft>) {
  try {
    const existing = await getDraft();
    const merged = { ...(existing || {}), ...draft } as OrderDraft;
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(merged));
    return merged;
  } catch (e) {
    console.warn("saveDraft error", e);
    return null;
  }
}

export async function getDraft(): Promise<OrderDraft | null> {
  try {
    const txt = await AsyncStorage.getItem(DRAFT_KEY);
    if (!txt) return null;
    return JSON.parse(txt) as OrderDraft;
  } catch (e) {
    console.warn("getDraft error", e);
    return null;
  }
}

export async function clearDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn("clearDraft error", e);
  }
}
