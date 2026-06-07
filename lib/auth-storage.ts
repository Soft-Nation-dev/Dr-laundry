import type { AuthSession } from "@/types/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "dl_access_token_v1";
const REFRESH_TOKEN_KEY = "dl_refresh_token_v1";
const AUTH_EMAIL_KEY = "dl_auth_email_v1";

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, session.accessToken],
    [REFRESH_TOKEN_KEY, session.refreshToken],
    [AUTH_EMAIL_KEY, session.email],
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function getAuthEmail(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_EMAIL_KEY);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    AUTH_EMAIL_KEY,
  ]);
}
