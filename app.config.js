const baseConfig = require("./app.json").expo;

module.exports = () => {
  const androidMapsKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";
  const iosMapsKey = process.env.GOOGLE_MAPS_IOS_API_KEY || "";

  return {
    ...baseConfig,
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
