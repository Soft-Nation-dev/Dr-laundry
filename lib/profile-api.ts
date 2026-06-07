import { apiRequest, type ApiResponse } from "@/lib/api-client";
import type { Profile, UpdateProfileInput } from "@/types/profile";

export async function getProfile(): Promise<ApiResponse<Profile>> {
  return apiRequest<Profile>("/api/profile/me", {
    method: "GET",
    auth: true,
  });
}

export async function updateProfile(
  data: UpdateProfileInput,
): Promise<ApiResponse<string>> {
  return apiRequest<string>("/api/profile/update", {
    method: "POST",
    auth: true,
    body: data,
  });
}
