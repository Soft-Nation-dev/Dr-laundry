import {
    getAccessToken,
    getAuthEmail,
    getRefreshToken,
    saveAuthSession,
} from "@/lib/auth-storage";
import type { AuthTokens } from "@/types/auth";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  headers?: Record<string, string>;
};

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787"
).replace(/\/+$/, "");

function buildUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${BASE_URL}${path}`;
  }

  return `${BASE_URL}/${path}`;
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "success" in value && "message" in value && "data" in value;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  const email = await getAuthEmail();

  if (!refreshToken || !email) {
    return false;
  }

  const response = await fetch(buildUrl("/api/auth/refresh"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      refreshToken,
    }),
  });

  const body = await readResponseBody(response);

  if (!response.ok || !isApiResponse(body) || !body.success) {
    return false;
  }

  const tokens = body.data as AuthTokens;

  if (!tokens?.accessToken || !tokens?.refreshToken) {
    return false;
  }

  await saveAuthSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    email,
  });

  return true;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    body,
    auth = false,
    retryOnUnauthorized = true,
    headers = {},
  } = options;

  const requestHeaders: Record<string, string> = { ...headers };

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });

    if (response.status === 401 && auth && retryOnUnauthorized) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiRequest<T>(path, {
          ...options,
          retryOnUnauthorized: false,
        });
      }
    }

    const payload = await readResponseBody(response);

    if (isApiResponse(payload)) {
      return payload as ApiResponse<T>;
    }

    if (!response.ok) {
      return {
        success: false,
        message: `Request failed (${response.status})`,
        data: payload as T,
      };
    }

    return {
      success: true,
      message: "Success",
      data: payload as T,
    };
  } catch {
    return {
      success: false,
      message: "Network error. Please try again.",
      data: null as T,
    };
  }
}
