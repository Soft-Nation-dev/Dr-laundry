import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_EMAIL_VERIFICATION_KEY =
  "dr-laundry.pending-email-verification.v1";

export type PendingEmailVerification = {
  email: string;
  createdAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function savePendingEmailVerification(
  email: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const pending: PendingEmailVerification = {
    email: normalizedEmail,
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(
    PENDING_EMAIL_VERIFICATION_KEY,
    JSON.stringify(pending),
  );
}

export async function getPendingEmailVerification(): Promise<PendingEmailVerification | null> {
  const stored = await AsyncStorage.getItem(PENDING_EMAIL_VERIFICATION_KEY);
  if (!stored) return null;

  try {
    const pending = JSON.parse(stored) as Partial<PendingEmailVerification>;
    const email = normalizeEmail(pending.email ?? "");
    if (!email) {
      await clearPendingEmailVerification();
      return null;
    }

    return {
      email,
      createdAt: pending.createdAt ?? new Date().toISOString(),
    };
  } catch {
    await clearPendingEmailVerification();
    return null;
  }
}

export async function clearPendingEmailVerification(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
}
