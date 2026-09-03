import { apiRequest } from "@/lib/api-client";
import type { PickupDayCode, PickupWindowCode } from "@/types/order";

export type AddressSuggestion = {
  id: string;
  label: string;
  mainText: string;
  secondaryText: string;
};

export type ResolvedPickupAddress = {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
};

type AddressRequestOptions = {
  auth?: boolean;
};

export type PickupAvailabilityDay = {
  day: PickupDayCode;
  windows: Exclude<PickupWindowCode, "asap">[];
};

export function getLocalPickupAvailability(now = new Date()): PickupAvailabilityDay[] {
  // Nigeria stays on UTC+1 throughout the year. This gives the screen an
  // immediate, sensible state while the server remains the final authority.
  const lagosNow = new Date(now.getTime() + 60 * 60 * 1000);
  const minuteOfDay = lagosNow.getUTCHours() * 60 + lagosNow.getUTCMinutes();
  const todayWindows: PickupAvailabilityDay["windows"] = [];

  if (minuteOfDay < 10 * 60) todayWindows.push("morning");
  if (minuteOfDay < 19 * 60) todayWindows.push("afternoon");

  const futureWindows: PickupAvailabilityDay["windows"] = ["morning", "afternoon"];
  return [
    ...(todayWindows.length ? [{ day: "today" as const, windows: todayWindows }] : []),
    { day: "tomorrow", windows: [...futureWindows] },
    { day: "next-day", windows: [...futureWindows] },
  ];
}

export async function searchPickupAddresses(
  query: string,
  sessionToken: string,
  options: AddressRequestOptions = {},
) {
  const params = new URLSearchParams({ query, sessionToken });
  const response = await apiRequest<AddressSuggestion[]>(
    `/api/addresses/suggestions?${params.toString()}`,
    { auth: options.auth ?? true },
  );
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.message || "Could not load address suggestions");
  }
  return response.data;
}

export async function resolvePickupAddress(input: {
  placeId?: string;
  address?: string;
  sessionToken?: string;
}, options: AddressRequestOptions = {}) {
  const response = await apiRequest<ResolvedPickupAddress>("/api/addresses/resolve", {
    method: "POST",
    auth: options.auth ?? true,
    body: input,
  });
  if (!response.success || !response.data) {
    throw new Error(response.message || "Could not confirm this pickup address");
  }
  return response.data;
}

export async function reversePickupAddress(
  input: {
    latitude: number;
    longitude: number;
    addressHint?: string;
    sessionToken?: string;
  },
  options: AddressRequestOptions = {},
) {
  const response = await apiRequest<ResolvedPickupAddress>(
    "/api/addresses/reverse",
    {
      method: "POST",
      auth: options.auth ?? true,
      body: input,
    },
  );
  if (!response.success || !response.data) {
    throw new Error(response.message || "Could not identify this pickup address");
  }
  return response.data;
}

export async function getPickupAvailability() {
  const response = await apiRequest<{ serverTime: string; days: PickupAvailabilityDay[] }>(
    "/api/orders/pickup-availability",
    { auth: true },
  );
  if (!response.success || !Array.isArray(response.data?.days)) {
    throw new Error(response.message || "Could not load pickup times");
  }
  return response.data;
}
