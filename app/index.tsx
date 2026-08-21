import { getAccessToken } from "@/lib/auth-storage";
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
} from "@/lib/pending-email-verification";
import { getProfile } from "@/lib/profile-api";
import { getLandingRoute } from "@/lib/role-routing";
import { router } from "expo-router";
import { useEffect } from "react";

export default function IndexScreen() {
  useEffect(() => {
    let active = true;

    getAccessToken().then(async (token) => {
      if (!active) return;
      if (!token) {
        const pendingVerification = await getPendingEmailVerification();
        if (!active) return;
        if (pendingVerification) {
          router.replace({
            pathname: "/verify-email",
            params: { email: pendingVerification.email },
          });
          return;
        }
        router.replace("/login");
        return;
      }
      await clearPendingEmailVerification();
      const profile = await getProfile();
      if (!active) return;
      router.replace(getLandingRoute(profile.data?.role ?? "customer") as never);
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
