import { apiRequest, type ApiResponse } from "@/lib/api-client";
import type { AuthTokens } from "@/types/auth";

export type RegisterInput = {
  email: string;
  password: string;
  phoneNumber: string;
  name: string;
  address: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  email: string;
  token: string;
  newPassword: string;
};

export type VerifyEmailInput = {
  email: string;
  code: string;
};

export type ResendVerificationInput = {
  email: string;
};

export type RefreshInput = {
  email: string;
  refreshToken: string;
};

export async function register(
  data: RegisterInput,
): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/auth/register", {
    method: "POST",
    body: data,
  });
}

export async function login(
  data: LoginInput,
): Promise<ApiResponse<AuthTokens>> {
  return apiRequest<AuthTokens>("/api/auth/login", {
    method: "POST",
    body: data,
  });
}

export async function forgotPassword(
  data: ForgotPasswordInput,
): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/auth/forgot-password", {
    method: "POST",
    body: data,
  });
}

export async function resetPassword(
  data: ResetPasswordInput,
): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/auth/reset-password", {
    method: "POST",
    body: data,
  });
}

export async function verifyEmail(
  data: VerifyEmailInput,
): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/auth/verify-email", {
    method: "POST",
    body: data,
  });
}

export async function resendVerification(
  data: ResendVerificationInput,
): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/auth/resend-verification", {
    method: "POST",
    body: data,
  });
}

export async function refreshSession(
  data: RefreshInput,
): Promise<ApiResponse<AuthTokens>> {
  return apiRequest<AuthTokens>("/api/auth/refresh", {
    method: "POST",
    body: data,
  });
}

export async function authCheck(): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/auth/check", {
    method: "GET",
    auth: true,
  });
}
