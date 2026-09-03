import { getAccessToken } from "@/lib/auth-storage";
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
} from "@/lib/pending-email-verification";
import { getProfile } from "@/lib/profile-api";
import { getLandingRoute } from "@/lib/role-routing";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SoftPressable } from "@/components/soft-pressable";

export default function IndexScreen() {
  const [error, setError] = useState("");

  const resolveLanding = useCallback(() => {
    let active = true;
    setError("");

    void (async () => {
      try {
        const token = await getAccessToken();
        if (!active) return;
        if (!token) {
          const pendingVerification = await getPendingEmailVerification();
          if (!active) return;
          if (pendingVerification) {
            router.replace({
              pathname: "/verify-email",
              params: {
                email: pendingVerification.email,
                flowId: pendingVerification.flowId,
              },
            });
            return;
          }
          router.replace("/login");
          return;
        }

        const profile = await getProfile();
        if (!active) return;
        if (!profile.success || !profile.data) {
          setError(profile.message || "Your workspace could not be loaded.");
          return;
        }
        await clearPendingEmailVerification();
        if (!active) return;
        router.replace(getLandingRoute(profile.data.role) as never);
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Your workspace could not be loaded.");
        }
      }
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => resolveLanding(), [resolveLanding]);

  return (
    <LinearGradient colors={["#F8F0FF", "#FFFFFF", "#EEE1FB"]} style={styles.container}>
      <View style={styles.brand}>
        <Image source={require("@/assets/images/logo.jpeg")} style={styles.logo} />
        {error ? <>
          <Text style={styles.title}>We couldn’t open your workspace</Text>
          <Text style={styles.message}>{error}</Text>
          <SoftPressable onPress={() => resolveLanding()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </SoftPressable>
        </> : <>
          <ActivityIndicator color="#681DA6" />
          <Text style={styles.message}>Opening your secure workspace…</Text>
        </>}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  brand: { width: "100%", maxWidth: 340, alignItems: "center" },
  logo: { width: 76, height: 76, borderRadius: 24, marginBottom: 22 },
  title: { color: "#2F1D39", fontSize: 18, fontWeight: "900", textAlign: "center" },
  message: { color: "#786982", fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 10 },
  retry: { minWidth: 132, minHeight: 46, marginTop: 18, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#681DA6" },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
