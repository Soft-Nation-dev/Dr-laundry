import { useCallback, useEffect, useState } from "react";

const MAP_LOAD_TIMEOUT_MS = 12_000;

/**
 * Google Maps can report the native view as ready while authentication has
 * failed and no tiles are rendered. Treat onMapLoaded as the healthy signal
 * and replace a permanently blank surface with a useful retry state.
 */
export function useMapTileHealth(enabled = true) {
  const [renderKey, setRenderKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), MAP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [enabled, loaded, renderKey]);

  const markLoaded = useCallback(() => {
    setLoaded(true);
    setTimedOut(false);
  }, []);

  const retry = useCallback(() => {
    setLoaded(false);
    setTimedOut(false);
    setRenderKey((current) => current + 1);
  }, []);

  return { renderKey, loaded, timedOut: enabled && timedOut, markLoaded, retry };
}

