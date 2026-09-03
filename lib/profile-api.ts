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

    if (error?.code === "PGRST116") {
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
          addressPlaceId:
            (user.user_metadata?.address_place_id as string) ?? "",
          latitude:
            typeof user.user_metadata?.latitude === "number"
              ? user.user_metadata.latitude
              : undefined,
          longitude:
            typeof user.user_metadata?.longitude === "number"
              ? user.user_metadata.longitude
              : undefined,
          avatarUrl: (user.user_metadata?.avatar_url as string) ?? "",
          role: "customer",
        },
      };
    }

    if (error) {
      return {
        success: false,
        message: error.message || "Your account access could not be loaded",
        data: null as any,
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
        addressPlaceId: profile.address_place_id ?? "",
        latitude:
          typeof profile.latitude === "number" ? profile.latitude : undefined,
        longitude:
          typeof profile.longitude === "number" ? profile.longitude : undefined,
        avatarUrl: profile.avatar_url ?? "",
        role: ["driver", "admin", "superadmin"].includes(profile.role)
          ? profile.role
          : "customer",
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
        address_place_id: null,
        latitude: null,
        longitude: null,
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
        address_place_id: null,
        latitude: null,
        longitude: null,
      },
    });

    return { success: true, message: "Profile updated successfully", data: "" };
  } catch (err: any) {
    return { success: false, message: err.message, data: "" };
  }
}
