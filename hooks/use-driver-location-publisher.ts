import {
  getActiveDriverJourney,
  publishExpoLocation,
} from "@/lib/driver-location-task";
import type { MapPoint } from "@/lib/tracking-api";
import * as Location from "expo-location";
import { useEffect, useState } from "react";

export function useDriverLocationPublisher(orderId?: string, enabled = false) {
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;

    const connect = async () => {
      const active = await getActiveDriverJourney();
      if (!mounted || !enabled || !orderId || active?.orderId !== orderId) {
        if (mounted) setSharing(false);
        return;
      }
      setSharing(true);
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setSharing(false);
        setError("Precise location permission is no longer available. Restart the journey and allow location access.");
        return;
      }
      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5_000,
            distanceInterval: 10,
          },
          (location) => {
            if (!mounted) return;
            setPoint({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
            void publishExpoLocation(orderId, location).then((result) => {
              if (!mounted) return;
              setError(result.success ? "" : result.message);
            });
          },
        );
      } catch {
        if (mounted) {
          setSharing(false);
          setError("Live GPS updates could not start. Turn on Location/GPS and retry the journey.");
        }
      }
    };

    void connect();
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [enabled, orderId]);

  return { point, sharing, error };
}
