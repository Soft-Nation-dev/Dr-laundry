import { supabase } from "@/lib/supabase-client";
import {
  decodeGooglePolyline,
  getTrackingRoute,
  getTrackingSnapshot,
  mapRawDriverLocation,
  metersBetween,
  type DriverLocation,
  type MapPoint,
  type TrackingRoute,
  type TrackingSnapshot,
} from "@/lib/tracking-api";
import { useCallback, useEffect, useRef, useState } from "react";

type RawLocation = Parameters<typeof mapRawDriverLocation>[0];

export type LiveTrackingState = {
  snapshot: TrackingSnapshot | null;
  location: DriverLocation | null;
  route: TrackingRoute | null;
  routePoints: MapPoint[];
  loading: boolean;
  refreshing: boolean;
  error: string;
  lastUpdateAgeSeconds: number | null;
  stale: boolean;
  refresh: () => Promise<void>;
};

const ROUTE_REFRESH_MS = 45_000;
const ROUTE_REFRESH_DISTANCE_METERS = 75;
const SNAPSHOT_POLL_MS = 30_000;

export function useLiveTracking(orderId?: string): LiveTrackingState {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [route, setRoute] = useState<TrackingRoute | null>(null);
  const [routePoints, setRoutePoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const mounted = useRef(true);
  const routeOriginRef = useRef<MapPoint | null>(null);
  const routeRequestedAtRef = useRef(0);
  const routeInFlightRef = useRef(false);

  const refreshRoute = useCallback(async (nextLocation: DriverLocation, force = false) => {
    if (!orderId || routeInFlightRef.current) return;
    const previousOrigin = routeOriginRef.current;
    const oldEnough = Date.now() - routeRequestedAtRef.current >= ROUTE_REFRESH_MS;
    const movedEnough = previousOrigin
      ? metersBetween(previousOrigin, nextLocation) >= ROUTE_REFRESH_DISTANCE_METERS
      : true;
    if (!force && !oldEnough && !movedEnough) return;

    routeInFlightRef.current = true;
    routeRequestedAtRef.current = Date.now();
    const result = await getTrackingRoute(orderId);
    routeInFlightRef.current = false;
    if (!mounted.current) return;
    if (!result.success || !result.data) {
      setRoute(null);
      setRoutePoints([]);
      setError(result.message || "A road route could not be calculated right now.");
      return;
    }
    setError("");
    routeOriginRef.current = nextLocation;
    setRoute(result.data);
    setRoutePoints(decodeGooglePolyline(result.data.encodedPolyline));
  }, [orderId]);

  const acceptLocation = useCallback((nextLocation: DriverLocation | null) => {
    if (!nextLocation || !mounted.current) return;
    setLocation((current) => {
      if (current && new Date(current.recordedAt).getTime() > new Date(nextLocation.recordedAt).getTime()) {
        return current;
      }
      return nextLocation;
    });
    setClock(Date.now());
    void refreshRoute(nextLocation);
  }, [refreshRoute]);

  const refresh = useCallback(async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    const result = await getTrackingSnapshot(orderId);
    if (!mounted.current) return;
    setRefreshing(false);
    setLoading(false);
    if (!result.success || !result.data) {
      setError(result.message);
      return;
    }
    setError("");
    setSnapshot(result.data);
    if (result.data.location) {
      acceptLocation(result.data.location);
      void refreshRoute(result.data.location, routeOriginRef.current === null);
    } else {
      setLocation(null);
      setRoute(null);
      setRoutePoints([]);
    }
  }, [acceptLocation, orderId, refreshRoute]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const clockTimer = setInterval(() => setClock(Date.now()), 5_000);
    const pollTimer = setInterval(() => void refresh(), SNAPSHOT_POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(clockTimer);
      clearInterval(pollTimer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!orderId) return;
    let trackingChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        await supabase.realtime.setAuth();
        if (cancelled) return;

        // Register every callback on one channel before subscribing. This avoids
        // a React remount race where a second callback was added to an already
        // joined RealtimeChannel on Android.
        const channel = supabase.channel(`tracking:${orderId}`, { config: { private: true } });
        channel.on("broadcast", { event: "location" }, ({ payload }) => {
          const row = (payload as { new?: RawLocation }).new;
          if (row) acceptLocation(mapRawDriverLocation(row));
        });
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations_current",
            filter: `order_id=eq.${orderId}`,
          },
          (payload) => {
            const row = payload.new as RawLocation;
            if (row?.order_id) acceptLocation(mapRawDriverLocation(row));
          },
        );
        if (cancelled) {
          void supabase.removeChannel(channel);
          return;
        }
        trackingChannel = channel;
        channel.subscribe();
      } catch {
        // The periodic snapshot poll remains active if Realtime is temporarily
        // unavailable, so tracking degrades gracefully instead of throwing.
      }
    };

    void connect();
    return () => {
      cancelled = true;
      if (trackingChannel) void supabase.removeChannel(trackingChannel);
    };
  }, [acceptLocation, orderId]);

  const updateTimestamp = location?.updatedAt || location?.recordedAt;
  const lastUpdateAgeSeconds = updateTimestamp
    ? Math.max(0, Math.floor((clock - new Date(updateTimestamp).getTime()) / 1000))
    : null;

  return {
    snapshot,
    location,
    route,
    routePoints,
    loading,
    refreshing,
    error,
    lastUpdateAgeSeconds,
    stale: lastUpdateAgeSeconds !== null && lastUpdateAgeSeconds >= 60,
    refresh,
  };
}
