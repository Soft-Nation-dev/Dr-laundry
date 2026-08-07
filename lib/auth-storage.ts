import { supabase } from "@/lib/supabase-client";

export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.refresh_token ?? null;
}

export async function getAuthEmail(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function saveAuthSession(session: {
  accessToken: string;
  refreshToken: string;
  email: string;
}): Promise<void> {
  // Supabase auth handles session storage internally automatically.
}

export async function clearAuthSession(): Promise<void> {
  await supabase.auth.signOut();
}
