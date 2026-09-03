import type { ApiResponse } from "@/lib/api-client";
import { supabase } from "@/lib/supabase-client";
import type { AuthTokens } from "@/types/auth";
import * as Linking from "expo-linking";

export type RegisterInput = {
  email: string;
  password: string;
  phoneNumber: string;
  name: string;
  address: string;
  addressPlaceId: string;
  latitude: number;
  longitude: number;
};

export type RegisterResult = {
  userId: string;
  requiresEmailConfirmation: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
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

function getSupabaseAuthMessage(error: unknown) {
  const authError = error as { code?: string; message?: string };
  switch (authError.code) {
    case "invalid_credentials":
      return "The email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email before signing in.";
    case "user_already_exists":
      return "An account already exists for this email.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "weak_password":
      return authError.message || "Choose a stronger password.";
    case "signup_disabled":
      return "New account registration is temporarily unavailable.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return authError.message || "Supabase could not complete this request.";
  }
}

export async function register(
  data: RegisterInput,
): Promise<ApiResponse<RegisterResult>> {
  try {
    const { data: resData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: Linking.createURL("auth/callback"),
        data: {
          name: data.name,
          phoneNumber: data.phoneNumber,
          phone_number: data.phoneNumber,
          address: data.address,
          address_place_id: data.addressPlaceId,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      },
    });

    if (error) {
      return {
        success: false,
        message: getSupabaseAuthMessage(error),
        data: { userId: "", requiresEmailConfirmation: true },
      };
    }

    if (!resData.user) {
      return {
        success: false,
        message: "Supabase did not create an account. Please try again.",
        data: { userId: "", requiresEmailConfirmation: true },
      };
    }

    if (
      Array.isArray(resData.user.identities) &&
      resData.user.identities.length === 0
    ) {
      return {
        success: false,
        message: "An account already exists for this email. Try signing in.",
        data: { userId: "", requiresEmailConfirmation: true },
      };
    }

    return {
      success: true,
      message: resData.session
        ? "Your account is ready."
        : "Account created. Open the confirmation link we sent to your email.",
      data: {
        userId: resData.user.id,
        requiresEmailConfirmation: !resData.session,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: getSupabaseAuthMessage(err),
      data: { userId: "", requiresEmailConfirmation: true },
    };
  }
}

export async function syncCurrentUserProfile(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const metadata = user.user_metadata ?? {};
  const phoneNumber = metadata.phone_number ?? metadata.phoneNumber ?? "";

  const { error: updateError, count } = await supabase
    .from("profiles")
    .update(
      {
        name: metadata.name ?? "",
        phone_number: phoneNumber,
        address: metadata.address ?? "",
        address_place_id: metadata.address_place_id ?? null,
        latitude:
          typeof metadata.latitude === "number" ? metadata.latitude : null,
        longitude:
          typeof metadata.longitude === "number" ? metadata.longitude : null,
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", user.id);

  if (!updateError && count === 0) {
    await supabase.from("profiles").insert({
      id: user.id,
      name: metadata.name ?? "",
      phone_number: phoneNumber,
      address: metadata.address ?? "",
      address_place_id: metadata.address_place_id ?? null,
      latitude:
        typeof metadata.latitude === "number" ? metadata.latitude : null,
      longitude:
        typeof metadata.longitude === "number" ? metadata.longitude : null,
      role: "customer",
    });
  }
}

export async function login(
  data: LoginInput,
): Promise<ApiResponse<AuthTokens>> {
  try {
    const { data: resData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      const requiresEmailConfirmation =
        error.code === "email_not_confirmed" ||
        error.message.toLowerCase().includes("email not confirmed");
      return {
        success: false,
        message: getSupabaseAuthMessage(error),
        data: {
          accessToken: "",
          refreshToken: "",
          requiresEmailConfirmation,
        },
      };
    }

    if (!resData.session?.access_token) {
      return {
        success: false,
        message:
          "No Supabase session was returned. Confirm your email and try again.",
        data: { accessToken: "", refreshToken: "" },
      };
    }

    return {
      success: true,
      message: "Login successful",
      data: {
        accessToken: resData.session?.access_token ?? "",
        refreshToken: resData.session?.refresh_token ?? "",
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: getSupabaseAuthMessage(err),
      data: { accessToken: "", refreshToken: "" },
    };
  }
}

export async function forgotPassword(
  data: ForgotPasswordInput,
): Promise<ApiResponse<string>> {
  try {
    const redirectTo = Linking.createURL("auth/callback", {
      queryParams: { next: "reset-password" },
    });
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    });
    if (error) {
      return {
        success: false,
        message: getSupabaseAuthMessage(error),
        data: "",
      };
    }
    return {
      success: true,
      message:
        "If an account exists for this email, a secure password reset link is on its way.",
      data: "",
    };
  } catch (err: any) {
    return {
      success: false,
      message: getSupabaseAuthMessage(err),
      data: "",
    };
  }
}

export async function resetPassword(
  data: ResetPasswordInput,
): Promise<ApiResponse<string>> {
  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (updateError) {
      return { success: false, message: updateError.message, data: "" };
    }

    return { success: true, message: "Password reset successful", data: "" };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "An unexpected error occurred",
      data: "",
    };
  }
}

export async function verifyEmail(
  data: VerifyEmailInput,
): Promise<ApiResponse<string>> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      email: data.email,
      token: data.code,
      type: "signup",
    });

    if (error) {
      return {
        success: false,
        message: getSupabaseAuthMessage(error),
        data: "",
      };
    }

    return { success: true, message: "Email verified successfully", data: "" };
  } catch (err: any) {
    return {
      success: false,
      message: getSupabaseAuthMessage(err),
      data: "",
    };
  }
}

export async function resendVerification(
  data: ResendVerificationInput,
): Promise<ApiResponse<string>> {
  try {
    const { error } = await supabase.auth.resend({
      email: data.email,
      type: "signup",
      options: {
        emailRedirectTo: Linking.createURL("auth/callback"),
      },
    });

    if (error) {
      return {
        success: false,
        message: getSupabaseAuthMessage(error),
        data: "",
      };
    }

    return { success: true, message: "Confirmation link sent", data: "" };
  } catch (err: any) {
    return {
      success: false,
      message: getSupabaseAuthMessage(err),
      data: "",
    };
  }
}

export async function refreshSession(
  data: RefreshInput,
): Promise<ApiResponse<AuthTokens>> {
  try {
    const { data: resData, error } = await supabase.auth.refreshSession({
      refresh_token: data.refreshToken,
    });

    if (error) {
      return {
        success: false,
        message: error.message,
        data: { accessToken: "", refreshToken: "" },
      };
    }

    return {
      success: true,
      message: "Session refreshed",
      data: {
        accessToken: resData.session?.access_token ?? "",
        refreshToken: resData.session?.refresh_token ?? "",
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "An unexpected error occurred",
      data: { accessToken: "", refreshToken: "" },
    };
  }
}

export async function authCheck(): Promise<ApiResponse<string>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Unauthorized", data: "" };
    }
    return { success: true, message: "Authenticated", data: user.id };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "An unexpected error occurred",
      data: "",
    };
  }
}
