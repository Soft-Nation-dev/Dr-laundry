import { LaundryTheme } from "@/constants/laundry-theme";
import { syncCurrentUserProfile } from "@/lib/auth-api";
import { getProfile } from "@/lib/profile-api";
import { clearPendingEmailVerification } from "@/lib/pending-email-verification";
import {
  OperationTimeoutError,
  withTimeout,
} from "@/lib/promise-timeout";
import { getLandingRoute } from "@/lib/role-routing";
import { savePasswordRecoveryState } from "@/lib/password-recovery-state";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function readAuthParams(url: string) {
  const queryStart = url.indexOf("?");
  const fragmentStart = url.indexOf("#");
  const query =
    queryStart >= 0
      ? url.slice(
          queryStart + 1,
          fragmentStart > queryStart ? fragmentStart : undefined,
        )
      : "";
  const fragment = fragmentStart >= 0 ? url.slice(fragmentStart + 1) : "";
  const params = new URLSearchParams(query);
  const fragmentParams = new URLSearchParams(fragment);
  fragmentParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  return params;
}

export default function AuthCallbackScreen() {
  const [errorMessage, setErrorMessage] = useState("");
  const [callbackKind, setCallbackKind] = useState<"confirmation" | "recovery">(
    "confirmation",
  );
  const isProcessingLink = useRef(false);

  useEffect(() => {
    let active = true;

    const finishAuth = async (url: string | null) => {
      if (isProcessingLink.current) return;

      if (!url) {
        if (active) setErrorMessage("The confirmation link is incomplete.");
        return;
      }

      isProcessingLink.current = true;

      try {
        const params = readAuthParams(url);
        const code = params.get("code");
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const errorDescription = params.get("error_description");
        const isRecovery = params.get("next") === "reset-password";
        setCallbackKind(isRecovery ? "recovery" : "confirmation");

        if (errorDescription) {
          if (active) setErrorMessage(errorDescription.replace(/\+/g, " "));
          isProcessingLink.current = false;
          return;
        }

        const destination = await withTimeout(
          (async () => {
            const result = code
              ? await supabase.auth.exchangeCodeForSession(code)
              : accessToken && refreshToken
                ? await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  })
                : {
                    error: new Error(
                      "No authentication session was found in the link.",
                    ),
                  };

            if (result.error) throw result.error;

            if (isRecovery) {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session?.user?.id) {
                throw new Error("The password recovery session is incomplete.");
              }
              await savePasswordRecoveryState(session.user.id);
              return "/reset-password";
            }

            await clearPendingEmailVerification();
            await syncCurrentUserProfile();
            const profile = await getProfile();
            return getLandingRoute(profile.data?.role ?? "customer");
          })(),
          30_000,
          "Email confirmation timed out.",
        );

        if (active) router.replace(destination as never);
      } catch (error) {
        isProcessingLink.current = false;
        if (active) {
          setErrorMessage(
            error instanceof OperationTimeoutError
              ? "Confirmation took longer than 30 seconds. Check your connection and try the link again."
              : error instanceof Error
                ? error.message
                : "The confirmation link could not be completed.",
          );
        }
      }
    };

    Linking.getInitialURL().then(finishAuth);
    const subscription = Linking.addEventListener("url", ({ url }) => finishAuth(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.icon}>
        {errorMessage ? (
          <Ionicons
            name="alert-circle-outline"
            size={34}
            color={LaundryTheme.colors.primary}
          />
        ) : (
          <Image
            source={require("@/assets/images/logo.jpeg")}
            style={styles.logo}
            contentFit="cover"
          />
        )}
      </View>
      <Text style={styles.title}>
        {errorMessage
          ? callbackKind === "recovery"
            ? "Reset link could not be opened"
            : "Link could not be confirmed"
          : callbackKind === "recovery"
            ? "Opening password reset"
            : "Confirming your account"}
      </Text>
      <Text style={styles.message}>
        {errorMessage ||
          (callbackKind === "recovery"
            ? "Hold on while we validate your secure recovery link."
            : "Hold on while we securely sign you in.")}
      </Text>
      {errorMessage ? (
        <Text
          style={styles.link}
          onPress={() =>
            router.replace(
              callbackKind === "recovery" ? "/forgot-password" : "/login",
            )
          }
        >
          {callbackKind === "recovery"
            ? "Request a new reset link"
            : "Return to sign in"}
        </Text>
      ) : (
        <ActivityIndicator color={LaundryTheme.colors.primary} style={styles.loader} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: LaundryTheme.colors.bgStart,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LaundryTheme.colors.primarySoft,
    marginBottom: 20,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 24,
  },
  title: {
    color: LaundryTheme.colors.ink,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: LaundryTheme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
  },
  loader: { marginTop: 24 },
  link: {
    marginTop: 24,
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "800",
  },
});
