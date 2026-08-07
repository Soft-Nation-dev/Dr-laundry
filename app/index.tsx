import { getAppMode } from "@/lib/app-mode";
import { getAccessToken } from "@/lib/auth-storage";
import { router } from "expo-router";
import { useEffect } from "react";

export default function IndexScreen() {
  useEffect(() => {
    let active = true;

    Promise.all([getAccessToken(), getAppMode()]).then(([token, mode]) => {
      if (!active) return;
      if (mode === "driver") {
        router.replace("/driver/home" as never);
        return;
      }
      router.replace(token ? "/home" : "/login");
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
