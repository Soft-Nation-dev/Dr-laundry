import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_EMAIL_VERIFICATION_KEY =
  "dr-laundry.pending-email-verification.v1";

const PENDING_VERIFICATION_TTL_MS = 30 * 60 * 1000;

export type PendingEmailVerificationReason = "signup" | "unverified-login";

export type PendingEmailVerification = {
  email: string;
  flowId: string;
  reason: PendingEmailVerificationReason;
  createdAt: string;
  expiresAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function savePendingEmailVerification(
  email: string,
  reason: PendingEmailVerificationReason = "signup",
  flowId?: string,
): Promise<PendingEmailVerification | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const now = Date.now();

  const pending: PendingEmailVerification = {
    email: normalizedEmail,
    flowId:
      flowId?.trim() ||
      `verify-${now.toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    reason,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PENDING_VERIFICATION_TTL_MS).toISOString(),
  };

  await AsyncStorage.setItem(
    PENDING_EMAIL_VERIFICATION_KEY,
    JSON.stringify(pending),
  );

  return pending;
}

export async function getPendingEmailVerification(): Promise<PendingEmailVerification | null> {
  const stored = await AsyncStorage.getItem(PENDING_EMAIL_VERIFICATION_KEY);
  if (!stored) return null;

  try {
    const pending = JSON.parse(stored) as Partial<PendingEmailVerification>;
    const email = normalizeEmail(pending.email ?? "");
    const expiresAt = Date.parse(pending.expiresAt ?? "");
    const reason = pending.reason;
    if (
      !email ||
      !pending.flowId ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      (reason !== "signup" && reason !== "unverified-login")
    ) {
      await clearPendingEmailVerification();
      return null;
    }

    return {
      email,
      flowId: pending.flowId,
      reason,
      createdAt: pending.createdAt ?? new Date().toISOString(),
      expiresAt: pending.expiresAt!,
    };
  } catch {
    await clearPendingEmailVerification();
    return null;
  }
}

export async function clearPendingEmailVerification(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_EMAIL_VERIFICATION_KEY);
}

export function matchesPendingEmailVerification(
  pending: PendingEmailVerification,
  email?: string,
  flowId?: string,
) {
  const normalizedEmail = normalizeEmail(email ?? "");
  return (
    (!normalizedEmail || normalizedEmail === pending.email) &&
    (!flowId || flowId === pending.flowId)
  );
}
