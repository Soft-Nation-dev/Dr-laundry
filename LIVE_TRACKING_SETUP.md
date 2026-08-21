# Live driver tracking

The app publishes a driver's GPS position only while an accepted pickup or
delivery task is active. The Worker and Supabase verify the signed-in driver.
Customers receive a private per-order Realtime stream, while Cloudflare
calculates the road route and ETA without exposing the Google Routes key.

## Build configuration

`GOOGLE_MAPS_ANDROID_API_KEY` is configured as a sensitive project variable in
the EAS `production`, `preview`, and `development` environments. If the Google
key is rotated later, update it with:

```powershell
eas env:create --environment production --name GOOGLE_MAPS_ANDROID_API_KEY --visibility sensitive
```

Repeat the update for `preview` and `development`. Never use the server-side
Routes key here.

Because `expo-task-manager` and background location permissions are native,
create a new development or production build after installing dependencies.
Expo Go cannot test background location.

## Google Play disclosure

The Android build requests background location only after a driver accepts an
active journey and confirms the in-app disclosure. Before production rollout,
complete Google Play's background-location declaration and include a short
screen recording showing the driver workflow and persistent foreground-service
notification.

## End-to-end test

1. As a customer, place and pay for an order and confirm its address point.
2. On a physical Android device, sign in as a driver, accept the task, tap
   **Start journey**, and approve precise/background location.
3. As the customer, open tracking and confirm the marker, road route, distance,
   and ETA update as the driver device moves.
4. Background the driver app and confirm the Android journey notification stays
   visible and customer updates continue.
5. Complete the pickup or delivery and confirm sharing stops.
