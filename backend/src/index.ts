import {
  calculateServerPricing,
  SHARED_EXPRESS_DELIVERY_FEE,
  SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE,
} from "../../shared/pricing-catalog";

// CORS Helper Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS, PUT, PATCH, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

type TurnaroundHours = 24 | 72;
type PaymentMethod = "paystack" | "pay_on_delivery";
type PaymentStatus = "pending" | "unpaid" | "paid" | "failed" | "expired";

type OrderCreationBody = {
  draft?: {
    address?: string;
    addressPlaceId?: string;
    latitude?: number;
    longitude?: number;
    note?: string;
    mode?: string;
    pickupDay?: string;
    pickupWindow?: string;
    deliveryDay?: string;
    deliveryWindow?: string;
    turnaroundHours?: number;
    totals?: {
      standardTotal?: number;
      expressTotal?: number;
    };
    lineItems?: {
      id: string;
      name: string;
      unitPrice: number;
      quantity: number;
      category: string;
      mode?: string;
    }[];
  };
  isExpress?: boolean;
  turnaroundHours?: number;
  paymentMethod?: PaymentMethod;
};

type DriverTaskStatus = "available" | "accepted" | "arrived" | "completed";
type DriverTaskType = "pickup" | "delivery";
type DriverOrderRow = {
  id: string;
  user_id: string;
  driver_id: string | null;
  address: string;
  pickup_at: string;
  pickup_window: string;
  promised_delivery_at: string;
  delivery_window: string | null;
  is_express: boolean;
  paid_amount: number | string;
  status: "pickup-confirmed" | "processing" | "ready-for-delivery" | "out-for-delivery" | "delivered" | "cancelled";
  driver_task_type: DriverTaskType | null;
  driver_task_status: DriverTaskStatus | null;
  latitude: number | string | null;
  longitude: number | string | null;
  delivery_at: string | null;
  delivery_address: string | null;
  delivery_latitude: number | string | null;
  delivery_longitude: number | string | null;
  delivery_confirmation_status: "not_required" | "pending" | "confirmed";
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  payment_marked_by: string | null;
  payment_marked_by_role: string | null;
  payment_marked_at: string | null;
  available_to_drivers: boolean;
  availability_source: "auto" | "staff" | "customer" | null;
  available_at: string | null;
  available_by_name: string | null;
  available_by_role: "system" | "customer" | "admin" | "superadmin" | null;
  cancellation_reason: string | null;
  cancelled_by_name: string | null;
  cancelled_by_role: "admin" | "superadmin" | null;
  order_items?: {
    item_id: string;
    name: string;
    unit_price: number | string;
    quantity: number;
    category: "regular" | "extras";
    mode?: string | null;
  }[];
};

type CompletedDriverTaskRow = {
  order_id: string;
  driver_id: string;
  task_type: DriverTaskType;
  completed_at: string;
};

type ProfileSummary = { id: string; name: string | null; phone_number: string | null; role?: string | null };

type AppEnv = Env & {
  GOOGLE_ROUTES_API_KEY: string;
  PAYMENT_WORKER_SECRET: string;
};

type PaystackVerification = {
  status?: boolean;
  message?: string;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    metadata?: { orderId?: string; userId?: string } | string | null;
  };
};

type PaystackInitialization = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PayableOrderRow = {
  id: string;
  user_id: string;
  paid_amount: number | string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  status: DriverOrderRow["status"];
  is_express: boolean;
  turnaround_hours: TurnaroundHours;
};

type TrackingLocation = {
  order_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  heading_degrees: number | null;
  speed_mps: number | null;
  recorded_at: string;
  updated_at: string;
};

type TrackingOrder = {
  id: string;
  user_id: string;
  driver_id: string | null;
  status: DriverOrderRow["status"];
  driver_task_type: DriverTaskType | null;
  driver_task_status: DriverTaskStatus | null;
  latitude: number | null;
  longitude: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
};

type AddressSuggestion = {
  id: string;
  label: string;
  mainText: string;
  secondaryText: string;
};

type ResolvedPickupAddress = {
  placeId: string;
  address: string;
  latitude: number;
  longitude: number;
};

type SharedPickupEligibility = {
  eligible: boolean;
  anchorOrderId: string | null;
  discountAmount: number;
};

type PickupWindowCode = "morning" | "afternoon";
type PickupDayCode = "today" | "tomorrow" | "next-day";

const ENUGU_CENTER = { latitude: 6.4584, longitude: 7.5464 };
const ENUGU_AUTOCOMPLETE_RADIUS_METERS = 50_000;
const ENUGU_SERVICE_RADIUS_KM = 75;
const PICKUP_WINDOWS: Record<PickupWindowCode, { startHour: number; endHour: number }> = {
  morning: { startHour: 8, endHour: 10 },
  afternoon: { startHour: 17, endHour: 19 },
};
const DRIVER_ORDER_SELECT = [
  "id,user_id,driver_id,address,pickup_at,pickup_window,promised_delivery_at,delivery_at,delivery_window",
  "is_express,paid_amount,status,driver_task_type,driver_task_status,latitude,longitude",
  "delivery_address,delivery_latitude,delivery_longitude,delivery_confirmation_status",
  "payment_status,payment_method,payment_marked_by,payment_marked_by_role,payment_marked_at",
  "available_to_drivers,availability_source,available_at,available_by_name,available_by_role",
  "cancellation_reason,cancelled_by_name,cancelled_by_role",
  "order_items(item_id,name,unit_price,quantity,category,mode)",
].join(",");

function supabaseHeaders(env: AppEnv, userJwt: string): Record<string, string> {
  return { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${userJwt}` };
}

async function callSupabaseRpc<T>(
  env: AppEnv,
  userJwt: string | null,
  functionName: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      ...(userJwt ? { Authorization: `Bearer ${userJwt}` } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.text();
    let message = details;
    try {
      const parsed = JSON.parse(details) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) message = parsed.message.trim();
    } catch { /* Keep the plain-text Supabase response. */ }
    return { ok: false, status: response.status, message };
  }
  return { ok: true, data: (await response.json()) as T };
}

async function verifyPaystackTransaction(env: AppEnv, reference: string) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } },
  );
  const payload = (await response.json()) as PaystackVerification;
  return { ok: response.ok && payload.status === true, payload };
}

async function initializePaystackTransaction(
  env: AppEnv,
  input: {
    email: string;
    amountNaira: number;
    reference: string;
    orderId: string;
    userId: string;
    isExpress: boolean;
    turnaroundHours: TurnaroundHours;
    pickupPlaceId?: string;
  },
) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amountNaira * 100),
      reference: input.reference,
      callback_url: "https://standard.paystack.co/close",
      metadata: {
        orderId: input.orderId,
        userId: input.userId,
        isExpress: input.isExpress,
        turnaroundHours: input.turnaroundHours,
        ...(input.pickupPlaceId ? { pickupPlaceId: input.pickupPlaceId } : {}),
      },
    }),
  });
  const payload = (await response.json()) as PaystackInitialization;
  if (
    !response.ok ||
    payload.status !== true ||
    typeof payload.data?.authorization_url !== "string" ||
    typeof payload.data.reference !== "string"
  ) {
    throw new Error(payload.message || "Failed to initialize payment gateway");
  }
  return {
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference,
  };
}

function paystackMetadata(value: PaystackVerification["data"]) {
  const metadata = value?.metadata;
  if (metadata && typeof metadata === "object") return metadata;
  if (typeof metadata === "string" && metadata) {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? parsed as { orderId?: string; userId?: string } : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function verifyPaystackWebhookSignature(
  rawBody: ArrayBuffer,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
  const expected = Array.from(signed, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let mismatch = expected.length ^ signature.length;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}

async function getStaffRole(env: AppEnv, userJwt: string, userId: string): Promise<"driver" | "admin" | "superadmin" | null> {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`,
    { headers: supabaseHeaders(env, userJwt) },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as { role?: string | null }[];
  return rows[0]?.role === "driver" || rows[0]?.role === "admin" || rows[0]?.role === "superadmin" ? rows[0].role : null;
}

function taskTimeLabel(row: DriverOrderRow): string {
  const scheduledAt = row.driver_task_type === "delivery" ? (row.delivery_at || row.promised_delivery_at) : row.pickup_at;
  const window = row.driver_task_type === "delivery" ? row.delivery_window : row.pickup_window;
  const date = new Date(scheduledAt);
  const dateText = Number.isNaN(date.getTime())
    ? "Scheduled"
    : new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" }).format(date);
  const windowText = window === "morning"
    ? "8am to 10am"
    : window === "afternoon" ? "5pm to 7pm" : "Flexible window";
  return `${dateText} · ${windowText}`;
}

function validMapPoint(
  latitudeValue: number | string | null | undefined,
  longitudeValue: number | string | null | undefined,
): { latitude: number; longitude: number } | null {
  if (latitudeValue === null || latitudeValue === undefined || longitudeValue === null || longitudeValue === undefined) {
    return null;
  }
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) return null;
  return { latitude, longitude };
}

function driverTaskDestination(row: DriverOrderRow, type?: DriverTaskType) {
  const taskType = type || row.driver_task_type || (['ready-for-delivery', 'out-for-delivery'].includes(row.status) ? 'delivery' : 'pickup');
  if (taskType === "delivery") {
    return validMapPoint(
      row.delivery_latitude ?? row.latitude,
      row.delivery_longitude ?? row.longitude,
    );
  }
  return validMapPoint(row.latitude, row.longitude);
}

function toDriverTask(row: DriverOrderRow, customer: ProfileSummary | undefined, userId: string) {
  const type: DriverTaskType = row.driver_task_type || (["ready-for-delivery", "out-for-delivery"].includes(row.status) ? "delivery" : "pickup");
  const deliveryTask = type === "delivery";
  const destination = driverTaskDestination(row, type);
  return {
    id: row.id,
    orderId: row.id,
    type,
    status: row.driver_task_status || "available",
    orderStatus: row.status,
    customerName: customer?.name || "Laundry customer",
    phoneNumber: customer?.phone_number || "",
    address: deliveryTask ? (row.delivery_address || row.address) : row.address,
    timeSlot: taskTimeLabel({ ...row, driver_task_type: type }),
    scheduledAtISO: type === "delivery" ? (row.delivery_at || row.promised_delivery_at) : row.pickup_at,
    promisedDeliveryISO: row.promised_delivery_at,
    isExpress: row.is_express,
    paidAmount: Number(row.paid_amount),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentMarkedBy: row.payment_marked_by,
    paymentMarkedByRole: row.payment_marked_by_role,
    paymentMarkedAt: row.payment_marked_at,
    availableToDrivers: row.available_to_drivers,
    availabilitySource: row.availability_source,
    availableAt: row.available_at,
    availableByName: row.available_by_name,
    availableByRole: row.available_by_role,
    cancellationReason: row.cancellation_reason,
    cancelledByName: row.cancelled_by_name,
    cancelledByRole: row.cancelled_by_role,
    latitude: destination?.latitude ?? null,
    longitude: destination?.longitude ?? null,
    locationAvailable: Boolean(destination),
    lineItems: (row.order_items || []).map((item) => ({
      id: item.item_id,
      name: item.name,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      category: item.category,
      mode: item.mode || undefined,
    })),
    assignedToMe: row.driver_id === userId,
  };
}

async function attachCustomerProfiles(env: AppEnv, userJwt: string, rows: DriverOrderRow[], userId: string) {
  const customerIds = [...new Set(rows.map((row) => row.user_id))];
  if (!customerIds.length) return [];
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=in.(${customerIds.map(encodeURIComponent).join(",")})&select=id,name,phone_number`,
    { headers: supabaseHeaders(env, userJwt) },
  );
  const profiles = response.ok ? ((await response.json()) as ProfileSummary[]) : [];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  return rows.map((row) => toDriverTask(row, byId.get(row.user_id), userId));
}

function getTurnaroundHours(isExpress: boolean): TurnaroundHours {
  return isExpress ? 24 : 72;
}

function isPickupDay(value: string): value is PickupDayCode {
  return value === "today" || value === "tomorrow" || value === "next-day";
}

function isPickupWindow(value: string): value is PickupWindowCode {
  return value === "morning" || value === "afternoon";
}

function lagosDateParts(now = new Date()) {
  const shifted = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function getPickupAvailability(now = new Date()) {
  const { minuteOfDay } = lagosDateParts(now);
  const todayWindows = (Object.keys(PICKUP_WINDOWS) as PickupWindowCode[])
    .filter((code) => minuteOfDay < PICKUP_WINDOWS[code].endHour * 60);
  return [
    ...(todayWindows.length ? [{ day: "today" as const, windows: todayWindows }] : []),
    { day: "tomorrow" as const, windows: ["morning", "afternoon"] as PickupWindowCode[] },
    { day: "next-day" as const, windows: ["morning", "afternoon"] as PickupWindowCode[] },
  ];
}

function resolvePickupAt(day: PickupDayCode, window: PickupWindowCode, now = new Date()) {
  const availableDay = getPickupAvailability(now).find((entry) => entry.day === day);
  if (!availableDay?.windows.includes(window)) {
    throw new Error("That pickup window has passed. Choose one of the currently available times.");
  }
  const { year, month, day: monthDay } = lagosDateParts(now);
  const offset = day === "today" ? 0 : day === "tomorrow" ? 1 : 2;
  const scheduled = new Date(
    Date.UTC(year, month, monthDay + offset, PICKUP_WINDOWS[window].startHour - 1),
  );
  return day === "today" && scheduled.getTime() < now.getTime()
    ? now.toISOString()
    : scheduled.toISOString();
}

function haversineKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(second.latitude - first.latitude);
  const deltaLongitude = radians(second.longitude - first.longitude);
  const latitude1 = radians(first.latitude);
  const latitude2 = radians(second.latitude);
  const a = Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchAddressSuggestions(
  env: AppEnv,
  input: string,
  sessionToken?: string,
): Promise<AddressSuggestion[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_ROUTES_API_KEY,
      "X-Goog-FieldMask": [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.text.text",
        "suggestions.placePrediction.structuredFormat.mainText.text",
        "suggestions.placePrediction.structuredFormat.secondaryText.text",
      ].join(","),
    },
    body: JSON.stringify({
      input,
      ...(sessionToken ? { sessionToken } : {}),
      includedRegionCodes: ["ng"],
      regionCode: "ng",
      languageCode: "en",
      locationRestriction: {
        circle: { center: ENUGU_CENTER, radius: ENUGU_AUTOCOMPLETE_RADIUS_METERS },
      },
    }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as {
      error?: { code?: unknown; message?: unknown; status?: unknown };
    } | null;
    console.error(JSON.stringify({
      message: "Google address autocomplete failed",
      status: response.status,
      googleStatus: typeof failure?.error?.status === "string" ? failure.error.status : undefined,
      googleMessage: typeof failure?.error?.message === "string" ? failure.error.message : undefined,
    }));
    if (response.status === 403) {
      throw new Error("Live address search is not configured yet. Please try again shortly.");
    }
    if (response.status === 429) {
      throw new Error("Address search is busy right now. Wait a moment and try again.");
    }
    throw new Error("Live address suggestions are temporarily unavailable. Please try again.");
  }
  const payload = await response.json() as {
    suggestions?: {
      placePrediction?: {
        placeId?: unknown;
        text?: { text?: unknown };
        structuredFormat?: {
          mainText?: { text?: unknown };
          secondaryText?: { text?: unknown };
        };
      };
    }[];
  };
  return (payload.suggestions ?? []).flatMap((suggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return [];
    const id = prediction?.placeId;
    const label = prediction?.text?.text;
    if (typeof id !== "string" || typeof label !== "string") return [];
    return [{
      id,
      label,
      mainText: typeof prediction.structuredFormat?.mainText?.text === "string"
        ? prediction.structuredFormat.mainText.text
        : label,
      secondaryText: typeof prediction.structuredFormat?.secondaryText?.text === "string"
        ? prediction.structuredFormat.secondaryText.text
        : "Enugu, Nigeria",
    }];
  }).slice(0, 6);
}

async function resolveGooglePlace(
  env: AppEnv,
  placeId: string,
  sessionToken?: string,
): Promise<ResolvedPickupAddress> {
  const detailsUrl = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) detailsUrl.searchParams.set("sessionToken", sessionToken);
  const response = await fetch(
    detailsUrl,
    {
      headers: {
        "X-Goog-Api-Key": env.GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": "id,formattedAddress,location",
      },
    },
  );
  if (!response.ok) throw new Error("The selected address could not be confirmed");
  const place = await response.json() as {
    id?: unknown;
    formattedAddress?: unknown;
    location?: { latitude?: unknown; longitude?: unknown };
  };
  if (
    typeof place.id !== "string" ||
    typeof place.formattedAddress !== "string" ||
    typeof place.location?.latitude !== "number" ||
    typeof place.location.longitude !== "number"
  ) {
    throw new Error("The selected address is missing location details");
  }
  const resolved = {
    placeId: place.id,
    address: place.formattedAddress,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
  };
  if (haversineKm(ENUGU_CENTER, resolved) > ENUGU_SERVICE_RADIUS_KM) {
    throw new Error("Pickup is currently available only within the Enugu service area");
  }
  return resolved;
}

async function resolvePickupAddress(
  env: AppEnv,
  input: { placeId?: string; address?: string; sessionToken?: string },
) {
  let placeId = input.placeId?.trim();
  if (!placeId && input.address?.trim()) {
    const suggestions = await fetchAddressSuggestions(env, input.address.trim(), input.sessionToken);
    placeId = suggestions[0]?.id;
  }
  if (!placeId) throw new Error("Choose a complete pickup address from the suggestions");
  return resolveGooglePlace(env, placeId, input.sessionToken);
}

async function reversePickupAddress(
  env: AppEnv,
  input: {
    latitude: number;
    longitude: number;
    addressHint?: string;
    sessionToken?: string;
  },
): Promise<ResolvedPickupAddress> {
  const point = { latitude: input.latitude, longitude: input.longitude };
  if (haversineKm(ENUGU_CENTER, point) > ENUGU_SERVICE_RADIUS_KM) {
    throw new Error("Pickup is currently available only within the Enugu service area");
  }

  const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  geocodeUrl.searchParams.set("latlng", `${point.latitude},${point.longitude}`);
  geocodeUrl.searchParams.set("result_type", "street_address|premise|subpremise|route");
  geocodeUrl.searchParams.set("language", "en");
  geocodeUrl.searchParams.set("region", "ng");
  geocodeUrl.searchParams.set("key", env.GOOGLE_ROUTES_API_KEY);

  const response = await fetch(geocodeUrl);
  if (response.ok) {
    const payload = await response.json() as {
      status?: unknown;
      results?: {
        place_id?: unknown;
        formatted_address?: unknown;
        geometry?: { location?: { lat?: unknown; lng?: unknown } };
      }[];
    };
    const result = payload.results?.find((candidate) =>
      typeof candidate.place_id === "string" &&
      typeof candidate.formatted_address === "string" &&
      typeof candidate.geometry?.location?.lat === "number" &&
      typeof candidate.geometry.location.lng === "number"
    );
    if (result) {
      return {
        placeId: result.place_id as string,
        address: result.formatted_address as string,
        latitude: result.geometry!.location!.lat as number,
        longitude: result.geometry!.location!.lng as number,
      };
    }
  }

  if (input.addressHint?.trim()) {
    return resolvePickupAddress(env, {
      address: input.addressHint.trim(),
      sessionToken: input.sessionToken,
    });
  }
  throw new Error("We found your location but could not identify a street address. Enter it manually instead.");
}

async function getSharedPickupEligibility(
  env: AppEnv,
  userJwt: string,
  userId: string,
  input: {
    addressPlaceId: string;
    pickupDay: PickupDayCode;
    pickupWindow: PickupWindowCode;
  },
): Promise<SharedPickupEligibility> {
  const queryUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
  queryUrl.searchParams.set("select", "id");
  queryUrl.searchParams.set("user_id", `eq.${userId}`);
  queryUrl.searchParams.set("payment_status", "eq.paid");
  queryUrl.searchParams.set("status", "eq.pickup-confirmed");
  queryUrl.searchParams.set("pickup_completed_at", "is.null");
  queryUrl.searchParams.set("shared_pickup_order_id", "is.null");
  queryUrl.searchParams.set("archived_at", "is.null");
  queryUrl.searchParams.set("address_place_id", `eq.${input.addressPlaceId}`);
  queryUrl.searchParams.set("pickup_day", `eq.${input.pickupDay}`);
  queryUrl.searchParams.set("pickup_window", `eq.${input.pickupWindow}`);
  queryUrl.searchParams.set("order", "created_at.asc");
  queryUrl.searchParams.set("limit", "1");
  const response = await fetch(queryUrl, {
    headers: supabaseHeaders(env, userJwt),
  });
  if (!response.ok) {
    throw new Error("Shared pickup eligibility could not be checked");
  }
  const rows = await response.json() as { id: string }[];
  const anchorOrderId = rows[0]?.id ?? null;
  return {
    eligible: Boolean(anchorOrderId),
    anchorOrderId,
    discountAmount: anchorOrderId
      ? SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE
      : 0,
  };
}

function optionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNigerianPhone(value: string): string | null {
  const raw = value.trim();
  const digits = raw.replace(/\D/g, "");
  let normalized: string;
  if (digits.startsWith("234") && digits.length === 13) normalized = `+${digits}`;
  else if (digits.startsWith("0") && digits.length === 11) normalized = `+234${digits.slice(1)}`;
  else if (digits.length === 10) normalized = `+234${digits}`;
  else if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) normalized = `+${digits}`;
  else return null;
  return /^\+[1-9]\d{9,14}$/.test(normalized) ? normalized : null;
}

function parseGoogleDuration(duration: unknown): number | null {
  if (typeof duration !== "string") return null;
  const match = duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  return match ? Math.round(Number(match[1])) : null;
}

async function loadTrackingOrder(
  env: AppEnv,
  userJwt: string,
  orderId: string,
): Promise<TrackingOrder | null> {
  const query = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
  query.searchParams.set(
    "select",
    "id,user_id,driver_id,status,driver_task_type,driver_task_status,latitude,longitude,delivery_latitude,delivery_longitude",
  );
  query.searchParams.set("id", `eq.${orderId}`);
  query.searchParams.set("archived_at", "is.null");
  query.searchParams.set("limit", "1");
  const response = await fetch(query, { headers: supabaseHeaders(env, userJwt) });
  if (!response.ok) return null;
  const rows = (await response.json()) as TrackingOrder[];
  return rows[0] ?? null;
}

function trackingDestination(order: TrackingOrder) {
  return validMapPoint(
    order.driver_task_type === "delivery" ? (order.delivery_latitude ?? order.latitude) : order.latitude,
    order.driver_task_type === "delivery" ? (order.delivery_longitude ?? order.longitude) : order.longitude,
  );
}

async function loadCurrentDriverLocation(
  env: AppEnv,
  userJwt: string,
  orderId: string,
): Promise<TrackingLocation | null> {
  const query = new URL(`${env.SUPABASE_URL}/rest/v1/driver_locations_current`);
  query.searchParams.set("select", "*");
  query.searchParams.set("order_id", `eq.${orderId}`);
  query.searchParams.set("limit", "1");
  const response = await fetch(query, { headers: supabaseHeaders(env, userJwt) });
  if (!response.ok) return null;
  const rows = (await response.json()) as TrackingLocation[];
  return rows[0] ?? null;
}

type GoogleRoutePayload = {
  routes?: {
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
  }[];
  error?: { code?: number; message?: string; status?: string };
};

async function requestGoogleRoadRoute(
  env: AppEnv,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  trafficAware: boolean,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env.GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: origin } },
        destination: { location: { latLng: destination } },
        travelMode: "DRIVE",
        ...(trafficAware ? { routingPreference: "TRAFFIC_AWARE" } : {}),
        computeAlternativeRoutes: false,
        polylineQuality: "HIGH_QUALITY",
        polylineEncoding: "ENCODED_POLYLINE",
        languageCode: "en",
        units: "METRIC",
      }),
    });
    const payload = await response.json().catch(() => ({})) as GoogleRoutePayload;
    return { response, payload, timedOut: false };
  } catch (error) {
    return {
      response: null,
      payload: {} as GoogleRoutePayload,
      timedOut: error instanceof Error && error.name === "AbortError",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Response Helpers
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: AppEnv,
  ): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle OPTIONS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Public image delivery. The bucket remains private; only this route serves files.
      const mediaPrefix = "/media/profile-images/";
      if (pathname.startsWith(mediaPrefix) && request.method === "GET") {
        const key = decodeURIComponent(pathname.slice(mediaPrefix.length));
        if (!key.startsWith("profiles/") || key.includes("..")) {
          return jsonResponse(
            { success: false, message: "Invalid image path", data: null },
            400,
          );
        }

        const object = await env.PROFILE_IMAGES.get(key);
        if (!object) {
          return jsonResponse(
            { success: false, message: "Image not found", data: null },
            404,
          );
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Cache-Control", "public, max-age=86400, immutable");
        headers.set("X-Content-Type-Options", "nosniff");
        return new Response(object.body, { headers });
      }

      // 1. JWT Authentication verification helper
      const authHeader = request.headers.get("Authorization");
      let userJwt = "";
      if (authHeader && authHeader.startsWith("Bearer ")) {
        userJwt = authHeader.substring(7);
      }

      // Verify JWT with Supabase Auth endpoint
      let user: any = null;
      const isPublicAddressLookup =
        (pathname === "/api/addresses/suggestions" && request.method === "GET") ||
        (pathname === "/api/addresses/resolve" && request.method === "POST") ||
        (pathname === "/api/addresses/reverse" && request.method === "POST");
      if (
        pathname !== "/api/orders/paystack-webhook" &&
        pathname !== "/api/health" &&
        !isPublicAddressLookup
      ) {
        if (!userJwt) {
          return jsonResponse(
            { success: false, message: "Authorization token is missing", data: null },
            401,
          );
        }

        const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${userJwt}`,
          },
        });

        if (!userResponse.ok) {
          return jsonResponse(
            { success: false, message: "Invalid authorization token", data: null },
            401,
          );
        }
        user = await userResponse.json();
      }

      // ==========================================
      // ROUTING
      // ==========================================

      // GET /api/health
      if (pathname === "/api/health") {
        return jsonResponse({ status: "healthy", timestamp: Date.now() });
      }

      // POST /api/profile/avatar
      if (pathname === "/api/profile/avatar" && request.method === "POST") {
        const declaredSize = Number(request.headers.get("content-length") || 0);
        if (declaredSize > 6 * 1024 * 1024) {
          return jsonResponse(
            { success: false, message: "Profile photos must be smaller than 5 MB", data: null },
            413,
          );
        }

        const formData = await request.formData();
        const image = formData.get("image");
        if (!image || typeof image === "string") {
          return jsonResponse(
            { success: false, message: "Choose an image to upload", data: null },
            400,
          );
        }

        const allowedTypes: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = allowedTypes[image.type];
        if (!extension) {
          return jsonResponse(
            { success: false, message: "Use a JPG, PNG, or WebP image", data: null },
            415,
          );
        }
        if (image.size > 5 * 1024 * 1024) {
          return jsonResponse(
            { success: false, message: "Profile photos must be smaller than 5 MB", data: null },
            413,
          );
        }

        const profileUrl = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`;
        const supabaseHeaders = {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userJwt}`,
        };
        let previousAvatarUrl = "";
        const currentProfileResponse = await fetch(
          `${profileUrl}&select=avatar_url`,
          { headers: supabaseHeaders },
        );
        if (currentProfileResponse.ok) {
          const currentProfiles: { avatar_url?: string | null }[] =
            await currentProfileResponse.json();
          previousAvatarUrl = currentProfiles[0]?.avatar_url || "";
        }

        const key = `profiles/${user.id}/${crypto.randomUUID()}.${extension}`;
        await env.PROFILE_IMAGES.put(key, image.stream(), {
          httpMetadata: { contentType: image.type },
          customMetadata: { userId: user.id },
        });

        const avatarUrl = `${url.origin}${mediaPrefix}${key}`;
        const updateResponse = await fetch(profileUrl, {
          method: "PATCH",
          headers: {
            ...supabaseHeaders,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          }),
        });

        if (!updateResponse.ok) {
          await env.PROFILE_IMAGES.delete(key);
          const details = await updateResponse.text();
          return jsonResponse(
            {
              success: false,
              message: details.includes("avatar_url")
                ? "Run the Supabase profile avatar migration, then try again"
                : "Could not save the profile photo",
              data: null,
            },
            500,
          );
        }

        if (previousAvatarUrl) {
          try {
            const previousUrl = new URL(previousAvatarUrl);
            if (
              previousUrl.origin === url.origin &&
              previousUrl.pathname.startsWith(mediaPrefix)
            ) {
              const previousKey = decodeURIComponent(
                previousUrl.pathname.slice(mediaPrefix.length),
              );
              if (previousKey.startsWith(`profiles/${user.id}/`)) {
                await env.PROFILE_IMAGES.delete(previousKey);
              }
            }
          } catch {
            // Ignore legacy or externally hosted avatar URLs.
          }
        }

        return jsonResponse({
          success: true,
          message: "Profile photo updated",
          data: { avatarUrl },
        });
      }

      // GET /api/addresses/suggestions
      if (pathname === "/api/addresses/suggestions" && request.method === "GET") {
        const query = (url.searchParams.get("query") || "").trim().slice(0, 120);
        const sessionToken = (url.searchParams.get("sessionToken") || "").trim();
        if (query.length < 2) {
          return jsonResponse({ success: true, message: "Type more to search", data: [] });
        }
        const suggestions = await fetchAddressSuggestions(
          env,
          query,
          /^[A-Za-z0-9_-]{10,80}$/.test(sessionToken) ? sessionToken : undefined,
        );
        return jsonResponse({ success: true, message: "Addresses loaded", data: suggestions });
      }

      // POST /api/addresses/resolve
      if (pathname === "/api/addresses/resolve" && request.method === "POST") {
        const body = await request.json() as {
          placeId?: string;
          address?: string;
          sessionToken?: string;
        };
        if (
          (body.address?.trim().length ?? 0) > 160 ||
          (body.placeId?.trim().length ?? 0) > 512
        ) {
          return jsonResponse({ success: false, message: "The pickup address is too long", data: null }, 400);
        }
        try {
          const resolved = await resolvePickupAddress(env, {
            address: body.address,
            placeId: body.placeId,
            sessionToken: body.sessionToken && /^[A-Za-z0-9_-]{10,80}$/.test(body.sessionToken)
              ? body.sessionToken
              : undefined,
          });
          return jsonResponse({ success: true, message: "Pickup address confirmed", data: resolved });
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              message: error instanceof Error ? error.message : "Pickup address could not be confirmed",
              data: null,
            },
            400,
          );
        }
      }

      // POST /api/addresses/reverse
      if (pathname === "/api/addresses/reverse" && request.method === "POST") {
        const body = await request.json() as {
          latitude?: unknown;
          longitude?: unknown;
          addressHint?: unknown;
          sessionToken?: unknown;
        };
        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);
        const addressHint = typeof body.addressHint === "string"
          ? body.addressHint.trim().slice(0, 160)
          : undefined;
        const sessionToken = typeof body.sessionToken === "string" &&
          /^[A-Za-z0-9_-]{10,80}$/.test(body.sessionToken)
          ? body.sessionToken
          : undefined;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return jsonResponse(
            { success: false, message: "A valid current location is required", data: null },
            400,
          );
        }
        try {
          const resolved = await reversePickupAddress(env, {
            latitude,
            longitude,
            addressHint,
            sessionToken,
          });
          return jsonResponse({ success: true, message: "Current address confirmed", data: resolved });
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              message: error instanceof Error ? error.message : "Current address could not be confirmed",
              data: null,
            },
            400,
          );
        }
      }

      // GET /api/orders/pickup-availability
      if (pathname === "/api/orders/pickup-availability" && request.method === "GET") {
        return jsonResponse({
          success: true,
          message: "Pickup availability loaded",
          data: { serverTime: new Date().toISOString(), days: getPickupAvailability() },
        });
      }

      const confirmDeliveryMatch = pathname.match(/^\/api\/orders\/([^/]+)\/confirm-delivery$/);
      if (confirmDeliveryMatch && request.method === "POST") {
        const body = await request.json() as {
          deliveryDay?: unknown;
          deliveryWindow?: unknown;
          addressPlaceId?: unknown;
          sessionToken?: unknown;
        };
        const deliveryDay = typeof body.deliveryDay === "string" ? body.deliveryDay : "";
        const deliveryWindow = typeof body.deliveryWindow === "string" ? body.deliveryWindow : "";
        const addressPlaceId = typeof body.addressPlaceId === "string" ? body.addressPlaceId.trim() : "";
        const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : undefined;
        if (!isPickupDay(deliveryDay) || !isPickupWindow(deliveryWindow) || !addressPlaceId) {
          return jsonResponse({ success: false, message: "Choose a valid delivery date, window and confirmed address", data: null }, 400);
        }
        try {
          const [resolved, deliveryAt] = await Promise.all([
            resolveGooglePlace(env, addressPlaceId, sessionToken),
            Promise.resolve(resolvePickupAt(deliveryDay, deliveryWindow)),
          ]);
          const result = await callSupabaseRpc<{
            orderId: string;
            deliveryAt: string;
            confirmed: boolean;
          }>(env, userJwt, "confirm_order_delivery", {
            p_order_id: decodeURIComponent(confirmDeliveryMatch[1]),
            p_delivery_day: deliveryDay,
            p_delivery_window: deliveryWindow,
            p_delivery_at: deliveryAt,
            p_address: resolved.address,
            p_address_place_id: resolved.placeId,
            p_latitude: resolved.latitude,
            p_longitude: resolved.longitude,
            p_worker_secret: env.PAYMENT_WORKER_SECRET,
          });
          if (!result.ok) {
            return jsonResponse({ success: false, message: result.message || "Delivery could not be confirmed", data: null }, result.status === 404 ? 404 : 409);
          }
          return jsonResponse({ success: true, message: "Delivery date, window and address confirmed", data: result.data });
        } catch (error) {
          return jsonResponse({
            success: false,
            message: error instanceof Error ? error.message.replace("pickup", "delivery") : "Delivery could not be confirmed",
            data: null,
          }, 400);
        }
      }

      // This endpoint is advisory for the checkout UI. The database RPC repeats
      // the check under a transaction lock, so two simultaneous requests cannot
      // both claim the one-time pay-on-delivery benefit.
      if (pathname === "/api/orders/payment-options" && request.method === "GET") {
        const eligibilityUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        eligibilityUrl.searchParams.set("select", "id");
        eligibilityUrl.searchParams.set("user_id", `eq.${user.id}`);
        eligibilityUrl.searchParams.set("or", "(payment_status.eq.paid,payment_method.eq.pay_on_delivery)");
        eligibilityUrl.searchParams.set("archived_at", "is.null");
        eligibilityUrl.searchParams.set("limit", "1");
        const eligibilityResponse = await fetch(eligibilityUrl, {
          headers: supabaseHeaders(env, userJwt),
        });
        if (!eligibilityResponse.ok) {
          return jsonResponse(
            { success: false, message: "Payment options could not be loaded", data: null },
            eligibilityResponse.status,
          );
        }
        const priorOrders = (await eligibilityResponse.json()) as { id: string }[];
        const addressPlaceId = (url.searchParams.get("addressPlaceId") || "").trim();
        const pickupDay = (url.searchParams.get("pickupDay") || "") as PickupDayCode;
        const pickupWindow = (url.searchParams.get("pickupWindow") || "") as PickupWindowCode;
        let sharedPickup: SharedPickupEligibility = {
          eligible: false,
          anchorOrderId: null,
          discountAmount: 0,
        };
        if (
          addressPlaceId &&
          addressPlaceId.length <= 512 &&
          isPickupDay(pickupDay) &&
          isPickupWindow(pickupWindow)
        ) {
          try {
            sharedPickup = await getSharedPickupEligibility(env, userJwt, user.id, {
              addressPlaceId,
              pickupDay,
              pickupWindow,
            });
          } catch {
            // Payment options remain usable at full price. Order creation repeats
            // this check atomically and never trusts this advisory quote.
          }
        }
        return jsonResponse({
          success: true,
          message: "Payment options loaded",
          data: {
            payOnDeliveryEligible: priorOrders.length === 0,
            sharedPickup,
          },
        });
      }

      // POST /api/orders/create
      if (pathname === "/api/orders/create" && request.method === "POST") {
        const body = (await request.json()) as OrderCreationBody;
        const { draft, isExpress } = body;
        const paymentMethod: PaymentMethod = body.paymentMethod || "paystack";

        if (paymentMethod !== "paystack" && paymentMethod !== "pay_on_delivery") {
          return jsonResponse({ success: false, message: "Choose a valid payment method", data: null }, 400);
        }

        if (
          !draft ||
          !draft.lineItems?.length ||
          !draft.address ||
          !draft.addressPlaceId ||
          draft.addressPlaceId.length > 512 ||
          typeof draft.latitude !== "number" ||
          typeof draft.longitude !== "number" ||
          draft.latitude < -90 || draft.latitude > 90 ||
          draft.longitude < -180 || draft.longitude > 180 ||
          !draft.mode ||
          !draft.pickupDay ||
          !draft.pickupWindow ||
          typeof isExpress !== "boolean"
        ) {
          return jsonResponse(
            { success: false, message: "Order draft details are incomplete", data: null },
            400,
          );
        }

        if (!isPickupDay(draft.pickupDay) || !isPickupWindow(draft.pickupWindow)) {
          return jsonResponse(
            { success: false, message: "Choose one of the currently available pickup times", data: null },
            400,
          );
        }

        let pickupAtISO: string;
        let confirmedAddress: ResolvedPickupAddress;
        try {
          pickupAtISO = resolvePickupAt(draft.pickupDay, draft.pickupWindow);
          confirmedAddress = await resolveGooglePlace(env, draft.addressPlaceId);
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              message: error instanceof Error ? error.message : "Pickup details could not be confirmed",
              data: null,
            },
            409,
          );
        }

        const turnaroundHours = getTurnaroundHours(isExpress);
        const requestedTurnaroundHours =
          body.turnaroundHours ?? draft.turnaroundHours ?? turnaroundHours;
        if (requestedTurnaroundHours !== turnaroundHours) {
          return jsonResponse(
            {
              success: false,
              message: `Invalid turnaround for ${isExpress ? "Express" : "Standard"} delivery`,
              data: { expectedTurnaroundHours: turnaroundHours },
            },
            400,
          );
        }

        // Generate unique order reference ID
        const timeChunk = Date.now().toString().slice(-6);
        const randomChunk = 100 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900);
        const orderId = `DL-${timeChunk}${randomChunk}`;

        let baselinePricing: ReturnType<typeof calculateServerPricing>;
        let pricing: ReturnType<typeof calculateServerPricing>;
        let sharedPickup: SharedPickupEligibility = {
          eligible: false,
          anchorOrderId: null,
          discountAmount: 0,
        };
        try {
          baselinePricing = calculateServerPricing(draft.lineItems, draft.mode, isExpress);
          sharedPickup = await getSharedPickupEligibility(env, userJwt, user.id, {
            addressPlaceId: confirmedAddress.placeId,
            pickupDay: draft.pickupDay,
            pickupWindow: draft.pickupWindow,
          });
          pricing = calculateServerPricing(
            draft.lineItems,
            draft.mode,
            isExpress,
            sharedPickup.eligible ? 0 : undefined,
          );
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              message: error instanceof Error ? error.message : "Order pricing is invalid",
              data: null,
            },
            400,
          );
        }
        const clientTotal = isExpress
          ? draft.totals?.expressTotal
          : draft.totals?.standardTotal;
        if (clientTotal !== undefined && Number(clientTotal) !== baselinePricing.finalAmount) {
          return jsonResponse(
            {
              success: false,
              message: "Prices changed while you were checking out. Review the refreshed total and try again.",
              data: { expectedTotal: baselinePricing.finalAmount },
            },
            409,
          );
        }
        const finalAmount = pricing.finalAmount;

        let paystack: { authorizationUrl: string; reference: string } | null = null;
        if (paymentMethod === "paystack") {
          try {
            paystack = await initializePaystackTransaction(env, {
              email: user.email,
              amountNaira: finalAmount,
              reference: orderId,
              orderId,
              userId: user.id,
              isExpress,
              turnaroundHours,
              pickupPlaceId: confirmedAddress.placeId,
            });
          } catch (error) {
            return jsonResponse(
              {
                success: false,
                message: error instanceof Error ? error.message : "Failed to initialize payment gateway",
                data: null,
              },
              502,
            );
          }
        }

        // Create ISO pickup and delivery dates
        const orderPlacedAt = new Date();
        const deliveryAtISO = new Date(
          orderPlacedAt.getTime() + turnaroundHours * 60 * 60 * 1000,
        ).toISOString();

        // Save through a secret-protected, atomic RPC. The app cannot forge totals
        // or leave an order without its line items.
        const orderRecord = {
          id: orderId,
          user_id: user.id,
          address: confirmedAddress.address,
          address_place_id: confirmedAddress.placeId,
          latitude: confirmedAddress.latitude,
          longitude: confirmedAddress.longitude,
          note: draft.note || "",
          mode: draft.mode,
          pickup_day: draft.pickupDay,
          pickup_window: draft.pickupWindow,
          delivery_day: draft.deliveryDay || "tomorrow",
          delivery_window: draft.deliveryWindow || "afternoon",
          pickup_at: pickupAtISO,
          delivery_at: deliveryAtISO,
          promised_delivery_at: deliveryAtISO,
          is_express: isExpress,
          turnaround_hours: turnaroundHours,
          status: "pickup-confirmed",
          paid_amount: finalAmount,
          mode_subtotal: pricing.modeSubtotal,
          pickup_delivery_fee: pricing.pickupDeliveryFee,
          shared_pickup_discount: pricing.sharedPickupDiscount,
          shared_pickup_order_id: sharedPickup.anchorOrderId,
          express_premium: isExpress ? pricing.expressPremium : 0,
          express_delivery_fee: isExpress ? SHARED_EXPRESS_DELIVERY_FEE : 0,
          payment_method: paymentMethod,
          payment_status: paymentMethod === "pay_on_delivery" ? "unpaid" : "pending",
          payment_reference: paystack?.reference ?? null,
          payment_authorization_url: paystack?.authorizationUrl ?? null,
        };

        const items = pricing.lineItems.map((item) => ({
          item_id: item.id,
          name: item.name,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          category: item.category,
          mode: item.mode,
        }));
        const createResult = await callSupabaseRpc<{
          orderId: string;
          paymentMethod: PaymentMethod;
          paymentStatus: PaymentStatus;
          paymentExpiresAt: string | null;
        }>(
          env,
          userJwt,
          "create_pending_order",
          { p_order: orderRecord, p_items: items, p_worker_secret: env.PAYMENT_WORKER_SECRET },
        );
        if (!createResult.ok) {
          const firstOrderOnly = createResult.message.includes("first order");
          return jsonResponse(
            {
              success: false,
              message: firstOrderOnly
                ? "Pay on delivery is available only on your first order. Choose Paystack to continue."
                : paymentMethod === "paystack"
                  ? "Payment opened, but the order could not be secured. You have not been charged."
                  : "Your pay-on-delivery order could not be secured. Please try again.",
              data: null,
            },
            firstOrderOnly ? 409 : 500,
          );
        }

        return jsonResponse({
          success: true,
          message: paymentMethod === "pay_on_delivery"
            ? "Order confirmed. Pay when it is delivered or securely in the app at any time."
            : "Order initialized. Complete payment to finalize.",
          data: {
            authorization_url: paystack?.authorizationUrl ?? null,
            reference: paystack?.reference ?? null,
            orderId,
            payment_method: paymentMethod,
            payment_status: createResult.data.paymentStatus,
            payment_expires_at: createResult.data.paymentExpiresAt,
            shared_pickup: sharedPickup,
          },
        });
      }

      const payExistingOrderMatch = pathname.match(/^\/api\/orders\/([^/]+)\/pay$/);
      if (payExistingOrderMatch && request.method === "POST") {
        const orderId = decodeURIComponent(payExistingOrderMatch[1]);
        const queryUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        queryUrl.searchParams.set(
          "select",
          "id,user_id,paid_amount,payment_status,payment_method,status,is_express,turnaround_hours",
        );
        queryUrl.searchParams.set("id", `eq.${orderId}`);
        queryUrl.searchParams.set("user_id", `eq.${user.id}`);
        queryUrl.searchParams.set("archived_at", "is.null");
        queryUrl.searchParams.set("limit", "1");
        const orderResponse = await fetch(queryUrl, { headers: supabaseHeaders(env, userJwt) });
        const rows = orderResponse.ok ? ((await orderResponse.json()) as PayableOrderRow[]) : [];
        const order = rows[0];
        if (!order) {
          return jsonResponse({ success: false, message: "Order not found", data: null }, 404);
        }
        if (order.payment_method !== "pay_on_delivery" || order.payment_status !== "unpaid") {
          return jsonResponse({ success: false, message: "This order does not have an unpaid balance", data: null }, 409);
        }
        if (order.status === "cancelled") {
          return jsonResponse({ success: false, message: "A cancelled order cannot be paid", data: null }, 409);
        }

        const suffix = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
        const reference = `${order.id}-P${Date.now().toString(36).toUpperCase()}${suffix}`;
        let paystack: { authorizationUrl: string; reference: string };
        try {
          paystack = await initializePaystackTransaction(env, {
            email: user.email,
            amountNaira: Number(order.paid_amount),
            reference,
            orderId: order.id,
            userId: user.id,
            isExpress: order.is_express,
            turnaroundHours: order.turnaround_hours,
          });
        } catch (error) {
          return jsonResponse(
            { success: false, message: error instanceof Error ? error.message : "Could not open Paystack", data: null },
            502,
          );
        }

        const initializeResult = await callSupabaseRpc<{
          orderId: string;
          reference: string;
          paymentExpiresAt: string;
        }>(env, userJwt, "initialize_existing_order_payment", {
          p_order_id: order.id,
          p_reference: paystack.reference,
          p_authorization_url: paystack.authorizationUrl,
          p_worker_secret: env.PAYMENT_WORKER_SECRET,
        });
        if (!initializeResult.ok) {
          return jsonResponse(
            { success: false, message: "The secure payment session could not be attached to this order", data: null },
            409,
          );
        }
        return jsonResponse({
          success: true,
          message: "Secure payment opened",
          data: {
            orderId: order.id,
            reference: paystack.reference,
            authorization_url: paystack.authorizationUrl,
            payment_expires_at: initializeResult.data.paymentExpiresAt,
          },
        });
      }

      const markPaidMatch = pathname.match(/^\/api\/orders\/([^/]+)\/mark-paid$/);
      if (markPaidMatch && request.method === "POST") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (!role) {
          return jsonResponse({ success: false, message: "Staff access is required", data: null }, 403);
        }
        const result = await callSupabaseRpc<{
          orderId: string;
          paymentStatus: PaymentStatus;
          markedBy: string;
          markedByRole: string;
          markedAt: string;
        }>(env, userJwt, "mark_order_paid_by_staff", {
          p_order_id: decodeURIComponent(markPaidMatch[1]),
          p_actor_id: user.id,
          p_worker_secret: env.PAYMENT_WORKER_SECRET,
        });
        if (!result.ok) {
          const forbidden = result.message.includes("assigned driver") || result.message.includes("Staff access");
          return jsonResponse(
            { success: false, message: forbidden ? "Only assigned staff can confirm this payment" : "Payment could not be confirmed", data: null },
            forbidden ? 403 : 409,
          );
        }
        return jsonResponse({ success: true, message: "Cash payment recorded permanently", data: result.data });
      }

      if (pathname === "/api/admin/analytics/locations" && request.method === "GET") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (role !== "superadmin") {
          return jsonResponse({ success: false, message: "Superadmin analytics access is required", data: null }, 403);
        }
        const queryUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        queryUrl.searchParams.set("select", "user_id,address,address_place_id,latitude,longitude,paid_amount,payment_status,status,created_at");
        queryUrl.searchParams.set("status", "neq.cancelled");
        queryUrl.searchParams.set("archived_at", "is.null");
        queryUrl.searchParams.set("is_test_order", "eq.false");
        queryUrl.searchParams.set("order", "created_at.desc");
        queryUrl.searchParams.set("limit", "5000");
        const response = await fetch(queryUrl, { headers: supabaseHeaders(env, userJwt) });
        if (!response.ok) return jsonResponse({ success: false, message: "Location analytics could not be loaded", data: null }, response.status);
        const rows = await response.json() as {
          user_id: string; address: string; address_place_id: string | null;
          latitude: number | null; longitude: number | null; paid_amount: number | string;
          payment_status: PaymentStatus; created_at: string;
        }[];
        type LocationGroup = {
          placeId: string | null;
          latitude: number | null;
          longitude: number | null;
          pointCount: number;
          points: { latitude: number; longitude: number }[];
          labels: Map<string, number>;
          users: Set<string>;
          orders: number;
          paidRevenue: number;
          lastOrderAt: string;
        };
        const groups: LocationGroup[] = [];
        const addressGroups = new Map<string, LocationGroup>();
        const clusterRadiusKm = 2;
        for (const row of rows) {
          const normalized = (row.address || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
          const point = validMapPoint(row.latitude, row.longitude);
          const addressParts = (row.address || "").split(",").map((part) => part.trim()).filter(Boolean);
          const areaLabel = [...addressParts].reverse().find((part) =>
            !/^(nigeria|enugu|enugu state|\d{5,6})$/i.test(part) && !/^\d+$/.test(part)
          ) || row.address || "Unknown area";
          let current: LocationGroup | undefined;
          if (point) {
            current = groups
              .filter((group) => group.latitude !== null && group.longitude !== null)
              .map((group) => ({ group, distance: haversineKm(point, { latitude: group.latitude!, longitude: group.longitude! }) }))
              .filter(({ distance }) => distance <= clusterRadiusKm)
              .sort((a, b) => a.distance - b.distance)[0]?.group;
          } else {
            const key = row.address_place_id || normalized;
            if (!key) continue;
            current = addressGroups.get(key);
          }
          if (!current) {
            current = {
              placeId: row.address_place_id,
              latitude: point?.latitude ?? null,
              longitude: point?.longitude ?? null,
              pointCount: point ? 1 : 0,
              points: point ? [point] : [],
              labels: new Map([[areaLabel, 1]]),
              users: new Set<string>(), orders: 0, paidRevenue: 0, lastOrderAt: row.created_at,
            };
            groups.push(current);
            if (!point) addressGroups.set(row.address_place_id || normalized, current);
          } else {
            current.labels.set(areaLabel, (current.labels.get(areaLabel) || 0) + 1);
            if (point) {
              current.points.push(point);
              current.latitude = ((current.latitude || 0) * current.pointCount + point.latitude) / (current.pointCount + 1);
              current.longitude = ((current.longitude || 0) * current.pointCount + point.longitude) / (current.pointCount + 1);
              current.pointCount += 1;
            }
          }
          current.users.add(row.user_id);
          current.orders += 1;
          if (row.payment_status === "paid") current.paidRevenue += Number(row.paid_amount || 0);
          if (row.created_at > current.lastOrderAt) current.lastOrderAt = row.created_at;
        }
        const locations = groups
          .map((group) => {
            const label = [...group.labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown area";
            const radiusKm = group.latitude === null || group.longitude === null ? 0 : group.points.reduce(
              (largest, point) => Math.max(largest, haversineKm(point, { latitude: group.latitude!, longitude: group.longitude! })), 0,
            );
            return {
            placeId: group.placeId, label, latitude: group.latitude, longitude: group.longitude,
            customerCount: group.users.size, orderCount: group.orders,
            paidRevenue: group.paidRevenue, lastOrderAt: group.lastOrderAt,
            heatScore: group.users.size * 3 + group.orders,
            radiusKm: Math.round(radiusKm * 10) / 10,
          }; })
          .sort((a, b) => b.heatScore - a.heatScore)
          .slice(0, 50);
        return jsonResponse({
          success: true,
          message: "Popular locations loaded",
          data: {
            locations,
            totals: {
              uniqueCustomers: new Set(rows.map((row) => row.user_id)).size,
              mappedOrders: rows.length,
              mappedLocations: locations.length,
              clusterRadiusKm,
            },
          },
        });
      }

      if (pathname === "/api/admin/analytics/income" && request.method === "GET") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (role !== "superadmin") {
          return jsonResponse({ success: false, message: "Superadmin income access is required", data: null }, 403);
        }
        const view = url.searchParams.get("view") === "year" ? "year" : "month";
        const lagosParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Lagos", year: "numeric", month: "2-digit",
        }).formatToParts(new Date());
        const currentYear = Number(lagosParts.find((part) => part.type === "year")?.value);
        const currentMonth = Number(lagosParts.find((part) => part.type === "month")?.value);
        const requestedYear = Number(url.searchParams.get("year") || currentYear);
        const requestedMonth = Number(url.searchParams.get("month") || currentMonth);
        const year = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : currentYear;
        const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : currentMonth;
        const pad = (value: number) => String(value).padStart(2, "0");
        let from: string;
        let to: string;
        if (view === "year") {
          from = `${year}-01-01T00:00:00+01:00`;
          to = `${year + 1}-01-01T00:00:00+01:00`;
        } else {
          const nextYear = month === 12 ? year + 1 : year;
          const nextMonth = month === 12 ? 1 : month + 1;
          from = `${year}-${pad(month)}-01T00:00:00+01:00`;
          to = `${nextYear}-${pad(nextMonth)}-01T00:00:00+01:00`;
        }
        const result = await callSupabaseRpc<Record<string, unknown>>(env, userJwt, "get_income_history", {
          p_from: from,
          p_to: to,
          p_bucket: view === "year" ? "month" : "day",
          p_worker_secret: env.PAYMENT_WORKER_SECRET,
        });
        if (!result.ok) {
          return jsonResponse({ success: false, message: "Income history could not be loaded", data: null }, result.status === 403 ? 403 : 500);
        }
        return jsonResponse({
          success: true,
          message: "Income analytics loaded",
          data: { ...result.data, view, year, month },
        });
      }

      const adminOrderActionMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/action$/);
      if (adminOrderActionMatch && request.method === "POST") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (role !== "admin" && role !== "superadmin") {
          return jsonResponse({ success: false, message: "Admin order access is required", data: null }, 403);
        }
        const body = (await request.json()) as {
          action?: "make_available" | "cancel" | "unassign_driver" | "ready_for_delivery";
          reason?: string;
        };
        if (!body.action || !["make_available", "cancel", "unassign_driver", "ready_for_delivery"].includes(body.action)) {
          return jsonResponse({ success: false, message: "Choose a valid order action", data: null }, 400);
        }
        if (body.action === "unassign_driver" && role !== "superadmin") {
          return jsonResponse({ success: false, message: "Only a superadmin can remove an assigned driver", data: null }, 403);
        }
        const result = await callSupabaseRpc<{
          orderId: string;
          action: string;
          actorName: string;
          actorRole: string;
          actedAt: string;
        }>(env, userJwt, "manage_order_by_staff", {
          p_order_id: decodeURIComponent(adminOrderActionMatch[1]),
          p_action: body.action,
          p_actor_id: user.id,
          p_reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "",
          p_worker_secret: env.PAYMENT_WORKER_SECRET,
        });
        if (!result.ok) {
          const forbidden = result.status === 401 || result.status === 403 || result.message.includes("superadmin");
          return jsonResponse(
            { success: false, message: forbidden ? "You do not have permission for this order action" : result.message || "The order could not be updated in its current state", data: null },
            forbidden ? 403 : 409,
          );
        }
        return jsonResponse({ success: true, message: "Order updated and permanently audited", data: result.data });
      }

      // POST /api/orders/verify-payment
      if (
        pathname === "/api/orders/verify-payment" &&
        request.method === "POST"
      ) {
        const { reference } = (await request.json()) as any;
        if (!reference) {
          return jsonResponse(
            { success: false, message: "Reference code is required", data: null },
            400,
          );
        }

        const verification = await verifyPaystackTransaction(env, reference);
        const transaction = verification.payload.data;
        const metadata = paystackMetadata(transaction);
        if (
          !verification.ok ||
          transaction?.status !== "success" ||
          transaction.reference !== reference ||
          typeof metadata.orderId !== "string" ||
          !metadata.orderId ||
          metadata.userId !== user.id ||
          !transaction.paid_at ||
          typeof transaction.amount !== "number"
        ) {
          return jsonResponse(
            {
              success: false,
              message: "Payment could not be verified by gateway",
              data: null,
            },
            400,
          );
        }

        const finalizeResult = await callSupabaseRpc<{
          finalized: boolean;
          reason: string;
          orderId?: string;
        }>(env, userJwt, "finalize_order_payment", {
          p_reference: reference,
          p_amount_kobo: transaction.amount,
          p_currency: transaction.currency,
          p_paid_at: transaction.paid_at,
          p_worker_secret: env.PAYMENT_WORKER_SECRET,
        });
        if (!finalizeResult.ok) {
          return jsonResponse(
            {
              success: false,
              message: "Payment was verified, but its secure order update failed. Contact support with your reference.",
              data: null,
            },
            500,
          );
        }
        if (!finalizeResult.data.finalized) {
          const expired = finalizeResult.data.reason === "expired";
          return jsonResponse(
            {
              success: false,
              message: expired
                ? "This 30-minute payment session expired before Paystack recorded the payment. Contact support with your reference."
                : "The verified payment did not match this order.",
              data: { reason: finalizeResult.data.reason },
            },
            expired ? 409 : 400,
          );
        }

        // Insert order tracking log
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_tracking`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${userJwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: finalizeResult.data.orderId || metadata.orderId,
            status: "pickup-confirmed",
            note: "Payment successfully verified via Paystack",
          }),
        });

        return jsonResponse({
          success: true,
          message: "Payment successfully verified and logged",
          data: { reference, orderId: finalizeResult.data.orderId || metadata.orderId, status: "paid" },
        });
      }

      const trackingMatch = pathname.match(/^\/api\/orders\/([^/]+)\/tracking$/);
      if (trackingMatch && request.method === "GET") {
        const orderId = decodeURIComponent(trackingMatch[1]);
        const order = await loadTrackingOrder(env, userJwt, orderId);
        if (!order) {
          return jsonResponse(
            { success: false, message: "This order is unavailable or you do not have access", data: null },
            404,
          );
        }

        const location = await loadCurrentDriverLocation(env, userJwt, orderId);
        const active =
          Boolean(order.driver_id) &&
          ["accepted", "arrived"].includes(order.driver_task_status || "") &&
          ["pickup-confirmed", "out-for-delivery"].includes(order.status);
        const destination = trackingDestination(order);

        return jsonResponse({
          success: true,
          message: location ? "Live driver location loaded" : "Waiting for the driver to share a location",
          data: {
            orderId,
            active,
            taskType: order.driver_task_type,
            taskStatus: order.driver_task_status,
            orderStatus: order.status,
            destination,
            location,
          },
        });
      }

      const routeMatch = pathname.match(/^\/api\/orders\/([^/]+)\/route$/);
      if (routeMatch && request.method === "GET") {
        const orderId = decodeURIComponent(routeMatch[1]);
        const order = await loadTrackingOrder(env, userJwt, orderId);
        if (!order) {
          return jsonResponse(
            { success: false, message: "This order is unavailable or you do not have access", data: null },
            404,
          );
        }
        const location = await loadCurrentDriverLocation(env, userJwt, orderId);
        const destination = trackingDestination(order);
        if (!destination) {
          return jsonResponse(
            { success: false, message: "This order has no verified service location. Contact operations before starting the journey.", data: null },
            409,
          );
        }
        if (!location) {
          return jsonResponse(
            { success: false, message: "Start the live journey to calculate the road route.", data: null },
            409,
          );
        }

        const origin = validMapPoint(location.latitude, location.longitude);
        if (!origin) {
          return jsonResponse(
            { success: false, message: "The latest driver GPS update is invalid. Refresh the device location and try again.", data: null },
            409,
          );
        }

        let routeResult = await requestGoogleRoadRoute(env, origin, destination, true);
        let route = routeResult.payload.routes?.[0];
        // Some local roads have no traffic model. Retry once without the
        // traffic-aware preference before declaring routing unavailable.
        if (
          !route?.polyline?.encodedPolyline &&
          (routeResult.timedOut || !routeResult.response || routeResult.response.status === 429 || routeResult.response.status >= 500 || routeResult.response.ok)
        ) {
          routeResult = await requestGoogleRoadRoute(env, origin, destination, false);
          route = routeResult.payload.routes?.[0];
        }

        if (!routeResult.response?.ok || !route?.polyline?.encodedPolyline) {
          console.error(JSON.stringify({
            message: "Google road route calculation failed",
            orderId,
            status: routeResult.response?.status ?? null,
            googleStatus: routeResult.payload.error?.status,
            googleCode: routeResult.payload.error?.code,
            googleMessage: routeResult.payload.error?.message,
            timedOut: routeResult.timedOut,
          }));
          return jsonResponse(
            {
              success: false,
              message: routeResult.timedOut
                ? "Road routing timed out. Retry or open Google Maps for navigation."
                : routeResult.response?.status === 403
                  ? "Road routing is temporarily unavailable. Operations has been notified."
                  : "A road route could not be calculated. Retry or open Google Maps for navigation.",
              data: null,
            },
            502,
          );
        }

        return jsonResponse({
          success: true,
          message: "Road route calculated",
          data: {
            encodedPolyline: route.polyline.encodedPolyline,
            durationSeconds: parseGoogleDuration(route.duration),
            distanceMeters: optionalFiniteNumber(route.distanceMeters),
            computedAt: new Date().toISOString(),
          },
        });
      }

      // Driver routes use the signed-in user's JWT so Supabase RLS remains the
      // final authorization layer. The role check also prevents a customer
      // from enabling driver mode only by changing local app state.
      if (pathname === "/api/driver/tasks" && request.method === "GET") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (!role) {
          return jsonResponse(
            { success: false, message: "Driver access is not enabled for this account", data: null },
            403,
          );
        }

        const queryUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        queryUrl.searchParams.set("select", DRIVER_ORDER_SELECT);
        queryUrl.searchParams.set("payment_status", "in.(paid,unpaid)");
        queryUrl.searchParams.set("available_to_drivers", "eq.true");
        queryUrl.searchParams.set("archived_at", "is.null");
        queryUrl.searchParams.set("status", "in.(pickup-confirmed,ready-for-delivery,out-for-delivery)");
        queryUrl.searchParams.set("or", `(driver_id.is.null,driver_id.eq.${user.id})`);
        queryUrl.searchParams.set("order", "pickup_at.asc");
        const response = await fetch(queryUrl, { headers: supabaseHeaders(env, userJwt) });
        if (!response.ok) {
          return jsonResponse(
            { success: false, message: "Driver task queue could not be loaded", data: null },
            response.status,
          );
        }
        const rows = (await response.json()) as DriverOrderRow[];
        return jsonResponse({
          success: true,
          message: "Driver tasks loaded",
          data: await attachCustomerProfiles(env, userJwt, rows, user.id),
        });
      }

      if (pathname === "/api/driver/tasks/completed" && request.method === "GET") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (!role) {
          return jsonResponse({ success: false, message: "Driver access is not enabled for this account", data: null }, 403);
        }
        const historyUrl = new URL(`${env.SUPABASE_URL}/rest/v1/order_driver_task_history`);
        historyUrl.searchParams.set("select", "order_id,driver_id,task_type,completed_at");
        historyUrl.searchParams.set("driver_id", `eq.${user.id}`);
        historyUrl.searchParams.set("order", "completed_at.desc");
        historyUrl.searchParams.set("limit", "100");
        const historyResponse = await fetch(historyUrl, { headers: supabaseHeaders(env, userJwt) });
        if (!historyResponse.ok) {
          return jsonResponse({ success: false, message: "Completed tasks could not be loaded", data: null }, historyResponse.status);
        }
        const history = (await historyResponse.json()) as CompletedDriverTaskRow[];
        if (!history.length) return jsonResponse({ success: true, message: "No completed tasks yet", data: [] });

        const orderIds = [...new Set(history.map((entry) => entry.order_id))];
        const ordersUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        ordersUrl.searchParams.set("select", DRIVER_ORDER_SELECT);
        ordersUrl.searchParams.set("id", `in.(${orderIds.map(encodeURIComponent).join(",")})`);
        ordersUrl.searchParams.set("archived_at", "is.null");
        const ordersResponse = await fetch(ordersUrl, { headers: supabaseHeaders(env, userJwt) });
        if (!ordersResponse.ok) {
          return jsonResponse({ success: false, message: "Completed order details could not be loaded", data: null }, ordersResponse.status);
        }
        const orders = (await ordersResponse.json()) as DriverOrderRow[];
        const byId = new Map(orders.map((order) => [order.id, order]));
        const completedEntries = history.flatMap((entry) => {
          const order = byId.get(entry.order_id);
          return order ? [{ entry, row: {
              ...order,
              driver_id: entry.driver_id,
              driver_task_type: entry.task_type,
              driver_task_status: "completed" as const,
            } }] : [];
        });
        const tasks = await attachCustomerProfiles(env, userJwt, completedEntries.map(({ row }) => row), user.id);
        return jsonResponse({
          success: true,
          message: "Completed tasks loaded",
          data: tasks.map((task, index) => ({ ...task, completedAtISO: completedEntries[index].entry.completed_at })),
        });
      }

      const driverTaskMatch = pathname.match(/^\/api\/driver\/tasks\/([^/]+)$/);
      if (driverTaskMatch && request.method === "GET") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (!role) {
          return jsonResponse(
            { success: false, message: "Driver access is not enabled for this account", data: null },
            403,
          );
        }
        const taskId = decodeURIComponent(driverTaskMatch[1]);
        const completedType = url.searchParams.get("completedType");
        const requestedCompletedType = completedType === "pickup" || completedType === "delivery" ? completedType : null;
        const queryUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        queryUrl.searchParams.set("select", DRIVER_ORDER_SELECT);
        queryUrl.searchParams.set("id", `eq.${taskId}`);
        queryUrl.searchParams.set("archived_at", "is.null");
        queryUrl.searchParams.set("limit", "1");
        const response = await fetch(queryUrl, { headers: supabaseHeaders(env, userJwt) });
        const rows = response.ok ? ((await response.json()) as DriverOrderRow[]) : [];
        const row = rows[0];
        let completedByDriver = false;
        if (row && role === "driver" && (requestedCompletedType || (row.driver_id !== user.id && !(row.available_to_drivers && !row.driver_id)))) {
          const historyUrl = new URL(`${env.SUPABASE_URL}/rest/v1/order_driver_task_history`);
          historyUrl.searchParams.set("select", "id");
          historyUrl.searchParams.set("order_id", `eq.${taskId}`);
          historyUrl.searchParams.set("driver_id", `eq.${user.id}`);
          if (requestedCompletedType) historyUrl.searchParams.set("task_type", `eq.${requestedCompletedType}`);
          historyUrl.searchParams.set("limit", "1");
          const historyResponse = await fetch(historyUrl, { headers: supabaseHeaders(env, userJwt) });
          completedByDriver = historyResponse.ok && ((await historyResponse.json()) as { id: number }[]).length > 0;
        }
        const canView = row && (
          role === "admin" || role === "superadmin" || row.driver_id === user.id ||
          (row.available_to_drivers && !row.driver_id) || completedByDriver
        );
        if (!canView) {
          return jsonResponse(
            { success: false, message: "This task is no longer available", data: null },
            404,
          );
        }
        const visibleRow: DriverOrderRow = requestedCompletedType && completedByDriver ? {
          ...row,
          driver_id: user.id,
          driver_task_type: requestedCompletedType,
          driver_task_status: "completed" as const,
        } : row;
        const [task] = await attachCustomerProfiles(env, userJwt, [visibleRow], user.id);
        return jsonResponse({ success: true, message: "Driver task loaded", data: task });
      }

      const driverActionMatch = pathname.match(/^\/api\/driver\/tasks\/([^/]+)\/action$/);
      if (driverActionMatch && request.method === "POST") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (!role) {
          return jsonResponse(
            { success: false, message: "Driver access is not enabled for this account", data: null },
            403,
          );
        }
        const taskId = decodeURIComponent(driverActionMatch[1]);
        const body = (await request.json()) as { action?: "accept" | "arrive" | "complete" };
        if (!body.action || !["accept", "arrive", "complete"].includes(body.action)) {
          return jsonResponse({ success: false, message: "Choose a valid task action", data: null }, 400);
        }

        const currentUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        currentUrl.searchParams.set("select", "*");
        currentUrl.searchParams.set("id", `eq.${taskId}`);
        currentUrl.searchParams.set("archived_at", "is.null");
        currentUrl.searchParams.set("limit", "1");
        const currentResponse = await fetch(currentUrl, { headers: supabaseHeaders(env, userJwt) });
        const currentRows = currentResponse.ok ? ((await currentResponse.json()) as DriverOrderRow[]) : [];
        const current = currentRows[0];
        if (!current) {
          return jsonResponse({ success: false, message: "Task not found", data: null }, 404);
        }

        const now = new Date().toISOString();
        const update: Record<string, unknown> = { updated_at: now };
        const patchUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        patchUrl.searchParams.set("id", `eq.${taskId}`);
        if (body.action === "accept") {
          if (!current.available_to_drivers || current.driver_task_status !== "available" || current.driver_id) {
            return jsonResponse({ success: false, message: "Another driver has already accepted this task", data: null }, 409);
          }
          if (!driverTaskDestination(current)) {
            console.error(JSON.stringify({
              message: "Driver task acceptance blocked because destination is missing",
              orderId: current.id,
              taskType: current.driver_task_type,
            }));
            return jsonResponse({
              success: false,
              message: "This task has no verified service location. Operations must repair the order before a driver can accept it.",
              data: null,
            }, 409);
          }
          patchUrl.searchParams.set("driver_task_status", "eq.available");
          patchUrl.searchParams.set("driver_id", "is.null");
          update.driver_id = user.id;
          update.driver_task_status = "accepted";
          if (current.driver_task_type === "delivery" && current.status === "ready-for-delivery") {
            update.status = "out-for-delivery";
          }
        } else {
          if (current.driver_id !== user.id && role !== "admin" && role !== "superadmin") {
            return jsonResponse({ success: false, message: "Accept this task before updating it", data: null }, 403);
          }
          patchUrl.searchParams.set("driver_id", `eq.${current.driver_id || user.id}`);
          if (body.action === "arrive") {
            if (current.driver_task_status !== "accepted") {
              return jsonResponse({ success: false, message: "Only an accepted task can be marked arrived", data: null }, 409);
            }
            patchUrl.searchParams.set("driver_task_status", "eq.accepted");
            update.driver_task_status = "arrived";
            update.driver_arrived_at = now;
          } else {
            if (current.driver_task_status !== "arrived") {
              return jsonResponse({ success: false, message: "Mark arrival before completing this task", data: null }, 409);
            }
            if (current.driver_task_type === "delivery" && current.payment_status !== "paid") {
              return jsonResponse(
                { success: false, message: "Record the customer's payment before completing delivery", data: null },
                409,
              );
            }
            patchUrl.searchParams.set("driver_task_status", "eq.arrived");
            update.driver_task_status = "completed";
            if (current.driver_task_type === "delivery") {
              update.status = "delivered";
              update.actual_delivery_at = now;
            } else {
              update.status = "processing";
              update.pickup_completed_at = now;
            }
          }
        }

        const patchResponse = await fetch(patchUrl, {
          method: "PATCH",
          headers: {
            ...supabaseHeaders(env, userJwt),
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(update),
        });
        const updatedRows = patchResponse.ok ? ((await patchResponse.json()) as DriverOrderRow[]) : [];
        const updated = updatedRows[0];
        if (!updated) {
          return jsonResponse(
            { success: false, message: "The task changed before this action completed. Refresh and try again.", data: null },
            409,
          );
        }

        await fetch(`${env.SUPABASE_URL}/rest/v1/order_tracking`, {
          method: "POST",
          headers: { ...supabaseHeaders(env, userJwt), "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: taskId,
            status: updated.status,
            note: `Driver ${body.action}: ${updated.driver_task_type || "order"} task`,
          }),
        });
        const [task] = await attachCustomerProfiles(env, userJwt, [updated], user.id);
        return jsonResponse({ success: true, message: "Task updated", data: task });
      }

      const driverLocationMatch = pathname.match(/^\/api\/driver\/tasks\/([^/]+)\/location$/);
      const driverContactMatch = pathname.match(/^\/api\/driver\/tasks\/([^/]+)\/contact$/);
      if (driverContactMatch && request.method === "POST") {
        const role = await getStaffRole(env, userJwt, user.id);
        if (!role) {
          return jsonResponse({ success: false, message: "Driver access is not enabled for this account", data: null }, 403);
        }
        const body = (await request.json()) as { action?: "call" | "sms" };
        if (body.action !== "call" && body.action !== "sms") {
          return jsonResponse({ success: false, message: "Choose call or text", data: null }, 400);
        }
        const contactResult = await callSupabaseRpc<{
          orderId: string;
          customerName: string;
          phoneNumber: string;
        }>(env, userJwt, "record_driver_customer_contact", {
          p_order_id: decodeURIComponent(driverContactMatch[1]),
          p_actor_id: user.id,
          p_action: body.action,
          p_worker_secret: env.PAYMENT_WORKER_SECRET,
        });
        if (!contactResult.ok) {
          return jsonResponse(
            { success: false, message: contactResult.message || "Customer contact is unavailable for this task", data: null },
            contactResult.status === 403 ? 403 : 409,
          );
        }
        const phoneNumber = normalizeNigerianPhone(contactResult.data.phoneNumber);
        if (!phoneNumber) {
          return jsonResponse({ success: false, message: "The customer's phone number is incomplete", data: null }, 409);
        }
        const uri = body.action === "call"
          ? `tel:${phoneNumber}`
          : `sms:${phoneNumber}?body=${encodeURIComponent(`Hello ${contactResult.data.customerName}, this is your Dr Laundry driver contacting you about order ${contactResult.data.orderId}.`)}`;
        return jsonResponse({
          success: true,
          message: body.action === "call" ? "Opening your phone dialer" : "Opening a prepared text message",
          data: { uri, phoneNumber, customerName: contactResult.data.customerName },
        });
      }

      if (driverLocationMatch && request.method === "POST") {
        const orderId = decodeURIComponent(driverLocationMatch[1]);
        const body = (await request.json()) as {
          latitude?: unknown;
          longitude?: unknown;
          accuracyMeters?: unknown;
          headingDegrees?: unknown;
          speedMps?: unknown;
          recordedAt?: unknown;
        };
        const latitude = optionalFiniteNumber(body.latitude);
        const longitude = optionalFiniteNumber(body.longitude);
        const accuracyMeters = optionalFiniteNumber(body.accuracyMeters);
        const headingDegrees = optionalFiniteNumber(body.headingDegrees);
        const speedMps = optionalFiniteNumber(body.speedMps);

        if (
          latitude === null || longitude === null ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
        ) {
          return jsonResponse({ success: false, message: "A valid GPS coordinate is required", data: null }, 400);
        }

        const rpcResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/publish_driver_location`, {
          method: "POST",
          headers: {
            ...supabaseHeaders(env, userJwt),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_order_id: orderId,
            p_latitude: latitude,
            p_longitude: longitude,
            p_accuracy_meters: accuracyMeters,
            p_heading_degrees: headingDegrees,
            p_speed_mps: speedMps,
            p_recorded_at:
              typeof body.recordedAt === "string" ? body.recordedAt : new Date().toISOString(),
          }),
        });
        const rpcPayload = await rpcResponse.json() as TrackingLocation | { message?: string };
        if (!rpcResponse.ok) {
          const detail = "message" in rpcPayload ? rpcPayload.message : undefined;
          return jsonResponse(
            {
              success: false,
              message: detail?.includes("active assigned journey")
                ? "Accept an active pickup or delivery task before sharing location"
                : "The location update was not accepted",
              data: null,
            },
            rpcResponse.status === 400 ? 400 : 403,
          );
        }

        return jsonResponse({
          success: true,
          message: "Driver location updated",
          data: rpcPayload,
        });
      }

      // GET /api/payments/history
      if (pathname === "/api/payments/history" && request.method === "GET") {
        const historyUrl = new URL(`${env.SUPABASE_URL}/rest/v1/orders`);
        historyUrl.searchParams.set(
          "select",
          "id,payment_reference,payment_status,payment_method,paid_amount,pickup_delivery_fee,shared_pickup_discount,shared_pickup_order_id,payment_expires_at,payment_paid_at,payment_authorization_url,payment_marked_by,payment_marked_by_role,payment_mark_source,payment_marked_at,created_at,is_express,mode,status",
        );
        historyUrl.searchParams.set("user_id", `eq.${user.id}`);
        historyUrl.searchParams.set("archived_at", "is.null");
        historyUrl.searchParams.set("order", "created_at.desc");
        historyUrl.searchParams.set("limit", "100");
        const historyResponse = await fetch(historyUrl, {
          headers: supabaseHeaders(env, userJwt),
        });
        if (!historyResponse.ok) {
          return jsonResponse(
            { success: false, message: "Could not load payment history", data: null },
            500,
          );
        }
        const rows = await historyResponse.json();
        return jsonResponse({ success: true, message: "Payment history loaded", data: rows });
      }

      // GET /api/orders/list
      if (pathname === "/api/orders/list" && request.method === "GET") {
        const orderListRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/orders?select=*&archived_at=is.null&order=created_at.desc`,
          {
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${userJwt}`,
            },
          },
        );

        if (!orderListRes.ok) {
          return jsonResponse(
            { success: false, message: "Failed to query orders", data: null },
            500,
          );
        }

        const ordersList = await orderListRes.json();
        return jsonResponse({
          success: true,
          message: "Orders retrieved",
          data: ordersList,
        });
      }

      // POST /api/orders/paystack-webhook (Server-to-Server webhook event fallback)
      if (pathname === "/api/orders/paystack-webhook" && request.method === "POST") {
        const rawBody = await request.arrayBuffer();
        const signatureValid = await verifyPaystackWebhookSignature(
          rawBody,
          request.headers.get("x-paystack-signature"),
          env.PAYSTACK_SECRET_KEY,
        );
        if (!signatureValid) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(new TextDecoder().decode(rawBody)) as {
          event?: string;
          data?: { reference?: string };
        };
        if (event.event === "charge.success" && event.data?.reference) {
          const reference = event.data.reference;
          const verification = await verifyPaystackTransaction(env, reference);
          const transaction = verification.payload.data;
          const metadata = paystackMetadata(transaction);
          if (
            verification.ok &&
            transaction?.status === "success" &&
            transaction.reference === reference &&
            typeof metadata.orderId === "string" &&
            Boolean(metadata.orderId) &&
            typeof metadata.userId === "string" &&
            Boolean(metadata.userId) &&
            transaction.paid_at &&
            typeof transaction.amount === "number"
          ) {
            const finalized = await callSupabaseRpc<{ finalized: boolean; reason: string }>(
              env,
              null,
              "finalize_order_payment",
              {
                p_reference: reference,
                p_amount_kobo: transaction.amount,
                p_currency: transaction.currency,
                p_paid_at: transaction.paid_at,
                p_worker_secret: env.PAYMENT_WORKER_SECRET,
              },
            );
            if (!finalized.ok) return new Response("Retry", { status: 503 });
          }
        }

        return new Response("OK", { status: 200 });
      }

      // Route Not Found
      return jsonResponse(
        { success: false, message: "Route not found", data: null },
        404,
      );
    } catch (err: any) {
      return jsonResponse(
        {
          success: false,
          message: err.message || "Internal server error occurred",
          data: null,
        },
        500,
      );
    }
  },
} satisfies ExportedHandler<AppEnv>;
