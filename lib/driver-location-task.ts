import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { publishDriverLocation } from "@/lib/tracking-api";

export const DRIVER_LOCATION_TASK = "dr-laundry-active-driver-location";
const ACTIVE_JOURNEY_KEY = "dr-laundry-active-driver-journey-v1";

type ActiveJourney = {
  orderId: string;
  startedAt: string;
  backgroundEnabled: boolean;
};

function toLocationInput(location: Location.LocationObject) {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy,
    headingDegrees:
      location.coords.heading !== null && location.coords.heading >= 0
        ? location.coords.heading
        : null,
    speedMps:
      location.coords.speed !== null && location.coords.speed >= 0
        ? location.coords.speed
        : null,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

export async function getActiveDriverJourney(): Promise<ActiveJourney | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_JOURNEY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveJourney;
    return parsed.orderId ? parsed : null;
  } catch {
    return null;
  }
}

export async function publishExpoLocation(orderId: string, location: Location.LocationObject) {
  return publishDriverLocation(orderId, toLocationInput(location));
}

type DriverLocationTaskPayload = { locations: Location.LocationObject[] };

if (!TaskManager.isTaskDefined(DRIVER_LOCATION_TASK)) {
  TaskManager.defineTask<DriverLocationTaskPayload>(
    DRIVER_LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      const journey = await getActiveDriverJourney();
      if (!journey) return;
      const latest = data.locations[data.locations.length - 1];
      const result = await publishExpoLocation(journey.orderId, latest);
      if (!result.success && result.message.includes("active pickup or delivery")) {
        await AsyncStorage.removeItem(ACTIVE_JOURNEY_KEY);
        if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
          await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
        }
      }
    },
  );
}

export async function startDriverLocationSharing(orderId: string): Promise<{
  backgroundEnabled: boolean;
  location: Location.LocationObject;
}> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    throw new Error("Precise location permission is required for live journeys.");
  }

  const existing = await getActiveDriverJourney();
  if (existing?.orderId !== orderId && await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }

  let backgroundEnabled = false;
  try {
    const background = await Location.requestBackgroundPermissionsAsync();
    backgroundEnabled = background.status === Location.PermissionStatus.GRANTED;
  } catch {
    backgroundEnabled = false;
  }

  const journey: ActiveJourney = {
    orderId,
    startedAt: new Date().toISOString(),
    backgroundEnabled,
  };
  await AsyncStorage.setItem(ACTIVE_JOURNEY_KEY, JSON.stringify(journey));

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const firstUpdate = await publishExpoLocation(orderId, location);
  if (!firstUpdate.success) {
    await AsyncStorage.removeItem(ACTIVE_JOURNEY_KEY);
    throw new Error(firstUpdate.message);
  }

  if (backgroundEnabled && !(await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10_000,
      distanceInterval: 15,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Dr Laundry journey active",
        notificationBody: "Sharing your location for the assigned customer journey.",
        notificationColor: "#6A1BB1",
        killServiceOnDestroy: false,
      },
    });
  }

  return { backgroundEnabled, location };
}

export async function stopDriverLocationSharing(orderId?: string): Promise<void> {
  const active = await getActiveDriverJourney();
  if (orderId && active?.orderId && active.orderId !== orderId) return;
  if (await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
  await AsyncStorage.removeItem(ACTIVE_JOURNEY_KEY);
}
