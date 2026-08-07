import { supabase } from "@/lib/supabase-client";
import { apiRequest, type ApiResponse } from "@/lib/api-client";
import type { Profile, UpdateProfileInput } from "@/types/profile";

export async function getProfile(): Promise<ApiResponse<Profile>> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        message: userError?.message || "Not authenticated",
        data: null as any,
      };
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      return {
        success: true,
        message: "Profile loaded from user metadata",
        data: {
          email: user.email ?? "",
          name: (user.user_metadata?.name as string) ?? "",
          phoneNumber:
            (user.user_metadata?.phone_number as string) ??
            (user.user_metadata?.phoneNumber as string) ??
            "",
          address: (user.user_metadata?.address as string) ?? "",
          avatarUrl: (user.user_metadata?.avatar_url as string) ?? "",
        },
      };
    }

    return {
      success: true,
      message: "Profile loaded",
      data: {
        email: user.email ?? "",
        name: profile.name ?? "",
        phoneNumber: profile.phone_number ?? "",
        address: profile.address ?? "",
        avatarUrl: profile.avatar_url ?? "",
      },
    };
  } catch (err: any) {
    return { success: false, message: err.message, data: null as any };
  }
}

export async function uploadProfilePhoto(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<ApiResponse<{ avatarUrl: string }>> {
  const formData = new FormData();
  formData.append(
    "image",
    {
      uri: asset.uri,
      name: asset.fileName || `profile-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    } as any,
  );

  return apiRequest<{ avatarUrl: string }>("/api/profile/avatar", {
    method: "POST",
    body: formData,
    auth: true,
  });
}

export async function updateProfile(
  data: UpdateProfileInput,
): Promise<ApiResponse<string>> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, message: "Not authenticated", data: "" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name: data.name,
        phone_number: data.phoneNumber,
        address: data.address,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return { success: false, message: error.message, data: "" };
    }

    await supabase.auth.updateUser({
      data: {
        name: data.name,
        phoneNumber: data.phoneNumber,
        phone_number: data.phoneNumber,
        address: data.address,
      },
    });

    return { success: true, message: "Profile updated successfully", data: "" };
  } catch (err: any) {
    return { success: false, message: err.message, data: "" };
  }
}
