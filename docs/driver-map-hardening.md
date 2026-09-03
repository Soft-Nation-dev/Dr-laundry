# Driver map hardening

## Production state

- Cloudflare Worker: `https://dr-laundry-backend.drlaundry6.workers.dev`
- Hardened Worker version: `b9d91dd7-a631-4fc4-b0d0-454986857401`
- Google Cloud project: `dr-laundry-4bcb6`
- Android package: `com.ojamdev.drlaundry`
- Android signing SHA-1: `B8:88:D6:39:36:FD:1B:BA:BA:11:42:B9:FD:B6:F4:48:97:A3:58:E1`

The Maps SDK for Android, Places API and Routes API are enabled. The Android
key is restricted to the package and signing certificate above. The server key
is restricted to Routes and Places. A live Routes API probe returned a road
polyline successfully on 2026-09-02.

## Root causes fixed

1. A generated local Android binary did not contain
   `com.google.android.geo.API_KEY`, so Google map tiles rendered blank.
2. Historic orders could remain visible to drivers after completion or could
   be released without a complete coordinate pair.
3. Driver routing did not clearly distinguish a missing destination, missing
   live GPS, an API timeout and an API-key failure.
4. Starting a journey could leave stale local journey state when the first GPS
   publication failed.

## Safeguards now in place

- EAS builds fail before compilation when `GOOGLE_MAPS_ANDROID_API_KEY` is
  missing.
- The Maps key is configured in EAS development, preview and production
  environments.
- Supabase rejects driver-visible orders without a valid task destination and
  automatically removes delivered/cancelled orders from the queue.
- Admins cannot release an order whose location is not verified.
- Drivers cannot accept or start a locationless task.
- Map screens show a bounded loading state, a retry action and an external
  Google Maps fallback instead of an indefinite blank surface.
- Route requests time out cleanly and retry once without live traffic when a
  local road has no traffic model.

## Required native rebuild

The currently installed local Android binary was generated without the Maps
metadata and cannot be repaired by JavaScript hot reload. Build a new Android
binary after these changes. For EAS, select the intended environment; the
configured secret will be injected automatically.

For local `npx expo run:android`, first place the Android Maps key in ignored
`.env.local` as `GOOGLE_MAPS_ANDROID_API_KEY`, regenerate the native project,
and reinstall the app. Never commit the key.

## Device acceptance test

1. Install the newly built binary, then open Driver mode.
2. Confirm map streets/labels appear within 12 seconds.
3. Release a geocoded test order and confirm its pin appears.
4. Accept it, enable precise location and start the journey.
5. Confirm a road-following purple route, distance and ETA appear.
6. Disable GPS once and verify the app gives a recoverable GPS message.
7. Use full-screen map and **Open in Google Maps** as the fallback path.
