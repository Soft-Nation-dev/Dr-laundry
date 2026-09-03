import AsyncStorage from "@react-native-async-storage/async-storage";

const PASSWORD_RECOVERY_KEY = "dr-laundry.password-recovery.v1";
const PASSWORD_RECOVERY_TTL_MS = 15 * 60 * 1000;

type PasswordRecoveryState = {
  userId: string;
  expiresAt: string;
};

export async function savePasswordRecoveryState(userId: string) {
  const state: PasswordRecoveryState = {
    userId,
    expiresAt: new Date(Date.now() + PASSWORD_RECOVERY_TTL_MS).toISOString(),
  };
  await AsyncStorage.setItem(PASSWORD_RECOVERY_KEY, JSON.stringify(state));
}

export async function hasValidPasswordRecoveryState(userId: string) {
  const stored = await AsyncStorage.getItem(PASSWORD_RECOVERY_KEY);
  if (!stored) return false;
  try {
    const state = JSON.parse(stored) as Partial<PasswordRecoveryState>;
    const expiresAt = Date.parse(state.expiresAt ?? "");
    if (
      state.userId !== userId ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      await clearPasswordRecoveryState();
      return false;
    }
    return true;
  } catch {
    await clearPasswordRecoveryState();
    return false;
  }
}

export async function clearPasswordRecoveryState() {
  await AsyncStorage.removeItem(PASSWORD_RECOVERY_KEY);
}
