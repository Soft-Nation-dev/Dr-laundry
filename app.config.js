const { execFileSync } = require("node:child_process");

function resolveLocalAndroidMapsKey() {
  if (process.env.EAS_BUILD === "true" || process.env.CI === "true") return "";
  try {
    const executable = process.platform === "win32" ? "gcloud.cmd" : "gcloud";
    return execFileSync(
      executable,
      [
        "services",
        "api-keys",
        "get-key-string",
        "projects/89315719409/locations/global/keys/dr-laundry-android-maps-v2",
        "--format=value(keyString)",
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
        shell: process.platform === "win32",
      },
    ).trim();
  } catch {
    return "";
  }
}

module.exports = ({ config }) => {
  const baseConfig = config;
  const androidMapsKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    resolveLocalAndroidMapsKey() ||
    "";
  const iosMapsKey = process.env.GOOGLE_MAPS_IOS_API_KEY || "";

  // A standalone Android build without this value compiles successfully but
  // silently renders an empty Google map. Fail EAS builds early so a broken
  // driver map can never reach testers or production again.
  if (process.env.EAS_BUILD === "true" && !androidMapsKey) {
    throw new Error(
      "GOOGLE_MAPS_ANDROID_API_KEY is required for Android builds. Configure it in the selected EAS environment before building.",
    );
  }

  return {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      maps: { androidConfigured: Boolean(androidMapsKey) },
    },
    ios: {
      ...baseConfig.ios,
      config: iosMapsKey ? { googleMapsApiKey: iosMapsKey } : undefined,
    },
    android: {
      ...baseConfig.android,
      config: androidMapsKey ? { googleMaps: { apiKey: androidMapsKey } } : undefined,
    },
  };
};
