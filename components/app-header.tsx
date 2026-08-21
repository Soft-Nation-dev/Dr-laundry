import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getFirstName(value: unknown) {
  if (typeof value !== "string") return "there";
  const names = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const first = names[0];
  if (!first) return "there";
  return first.charAt(0).toLocaleUpperCase() + first.slice(1).toLocaleLowerCase();
}

type Props = {
  unreadCount?: number;
  inSafeArea?: boolean;
};

export function AppHeader({ unreadCount = 0, inSafeArea = true }: Props) {
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!active) return;
      const name =
        profile?.name ??
        (user.user_metadata?.name as string | undefined) ??
        (user.user_metadata?.full_name as string | undefined) ??
        (user.email ?? "");
      setUserName(getFirstName(name));
    })();
    return () => {
      active = false;
    };
  }, []);

  const Container = inSafeArea ? SafeAreaView : View;

  return (
    <Container edges={inSafeArea ? ["top"] : undefined} style={styles.safeArea}>
      <View style={styles.row}>
        {/* Brand block */}
        <View style={styles.brandBlock}>
          <View style={styles.avatarBorder}>
            <Image
              source={require("@/assets/images/logo.jpeg")}
              style={styles.logo}
              contentFit="cover"
            />
          </View>
          <View>
            <Text style={styles.kicker}>Dr Laundry</Text>
            <Text style={styles.greeting}>Hi {userName}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <SoftPressable
            onPress={() => router.push("/notifications" as never)}
            style={styles.bellBtn}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color={LaundryTheme.colors.ink} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{Math.min(unreadCount, 9)}</Text>
              </View>
            )}
          </SoftPressable>

          <SoftPressable
            onPress={() => router.push("/settings" as never)}
            style={styles.settingsBtn}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
          </SoftPressable>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: LaundryTheme.colors.primaryDark,
    padding: 2,
    backgroundColor: "#FFFFFF",
  },
  logo: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  kicker: {
    fontSize: 12,
    color: LaundryTheme.colors.muted,
    fontWeight: "600",
  },
  greeting: {
    fontSize: 20,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    ...LaundryTheme.shadow.soft,
  },
  badge: {
    position: "absolute",
    right: 2,
    top: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LaundryTheme.colors.danger,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: LaundryTheme.colors.primaryDark,
    justifyContent: "center",
    alignItems: "center",
    ...LaundryTheme.shadow.soft,
  },
});
