import { apiRequest, type ApiResponse } from "@/lib/api-client";

export type MapPoint = { latitude: number; longitude: number };

export type DriverLocation = MapPoint & {
  orderId: string;
  driverId: string;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedMps: number | null;
  recordedAt: string;
  updatedAt: string;
};

export type TrackingSnapshot = {
  orderId: string;
  active: boolean;
  taskType: "pickup" | "delivery" | null;
  taskStatus: "available" | "accepted" | "arrived" | "completed" | null;
  orderStatus: string;
  destination: MapPoint | null;
  location: DriverLocation | null;
};

export type TrackingRoute = {
  encodedPolyline: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  computedAt: string;
};

type RawLocation = {
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

type RawSnapshot = Omit<TrackingSnapshot, "location"> & {
  location: RawLocation | null;
};

export type DriverLocationInput = MapPoint & {
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMps?: number | null;
  recordedAt?: string;
};

export function mapRawDriverLocation(location: RawLocation): DriverLocation {
  return {
    orderId: location.order_id,
    driverId: location.driver_id,
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    accuracyMeters: location.accuracy_meters === null ? null : Number(location.accuracy_meters),
    headingDegrees: location.heading_degrees === null ? null : Number(location.heading_degrees),
    speedMps: location.speed_mps === null ? null : Number(location.speed_mps),
    recordedAt: location.recorded_at,
    updatedAt: location.updated_at,
  };
}

export async function getTrackingSnapshot(orderId: string): Promise<ApiResponse<TrackingSnapshot>> {
  const result = await apiRequest<RawSnapshot>(
    `/api/orders/${encodeURIComponent(orderId)}/tracking`,
    { auth: true },
  );
  return {
    ...result,
    data: result.data
      ? { ...result.data, location: result.data.location ? mapRawDriverLocation(result.data.location) : null }
      : (null as unknown as TrackingSnapshot),
  };
}

export function getTrackingRoute(orderId: string): Promise<ApiResponse<TrackingRoute>> {
  return apiRequest<TrackingRoute>(`/api/orders/${encodeURIComponent(orderId)}/route`, {
    auth: true,
  });
}

export async function publishDriverLocation(
  orderId: string,
  location: DriverLocationInput,
): Promise<ApiResponse<DriverLocation>> {
  const result = await apiRequest<RawLocation>(
    `/api/driver/tasks/${encodeURIComponent(orderId)}/location`,
    { method: "POST", auth: true, body: location },
  );
  return {
    ...result,
    data: result.data ? mapRawDriverLocation(result.data) : (null as unknown as DriverLocation),
  };
}

export function decodeGooglePolyline(encoded: string): MapPoint[] {
  const points: MapPoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

export function metersBetween(a: MapPoint, b: MapPoint): number {
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const h =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

