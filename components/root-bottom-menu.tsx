import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type MenuItem = {
  key: "home" | "history" | "track" | "profile";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const hiddenRoutes = [
  "/",
  "/login",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/modal",
];

const menuItems: MenuItem[] = [
  { key: "home", label: "Home", icon: "home", route: "/home" },
  {
    key: "history",
    label: "History",
    icon: "receipt-outline",
    route: "/order-history",
  },
  {
    key: "track",
    label: "Track",
    icon: "navigate-outline",
    route: "/track-order",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person-circle-outline",
    route: "/profile",
  },
];

function resolveActiveKey(pathname: string): MenuItem["key"] | null {
  if (pathname.startsWith("/home")) return "home";
  if (pathname.startsWith("/order-history")) return "history";
  if (
    pathname.startsWith("/track-order") ||
    pathname.startsWith("/pickup-map") ||
    pathname.startsWith("/order-complete")
  ) {
    return "track";
  }
  if (
    pathname.startsWith("/profile") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/membership") ||
    pathname.startsWith("/support")
  ) {
    return "profile";
  }
  return null;
}

export function RootBottomMenu() {
  const pathname = usePathname();

  if (hiddenRoutes.includes(pathname) || pathname.startsWith("/driver")) {
    return null;
  }

  const activeKey = resolveActiveKey(pathname);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <SafeAreaView
        pointerEvents="box-none"
        edges={["bottom"]}
        style={styles.safeArea}
      >
        <View style={styles.shell}>
          <View style={styles.bar}>
            {menuItems.slice(0, 2).map((item) => {
              const active = item.key === activeKey;
              return (
                <SoftPressable
                  key={item.key}
                  onPress={() => router.replace(item.route as never)}
                  style={styles.menuItem}
                >
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={
                      active
                        ? LaundryTheme.colors.primary
                        : LaundryTheme.colors.muted
                    }
                  />
                  <Text
                    style={[styles.menuLabel, active && styles.menuLabelActive]}
                  >
                    {item.label}
                  </Text>
                </SoftPressable>
              );
            })}

            <SoftPressable
              onPress={() => router.push("/new-order")}
              style={styles.centerBtn}
            >
              <View style={styles.centerInner}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
            </SoftPressable>

            {menuItems.slice(2).map((item) => {
              const active = item.key === activeKey;
              return (
                <SoftPressable
                  key={item.key}
                  onPress={() => router.replace(item.route as never)}
                  style={styles.menuItem}
                >
                  <Ionicons
                    name={item.icon}
                    size={21}
                    color={
                      active
                        ? LaundryTheme.colors.primary
                        : LaundryTheme.colors.muted
                    }
                  />
                  <Text
                    style={[styles.menuLabel, active && styles.menuLabelActive]}
                  >
                    {item.label}
                  </Text>
                </SoftPressable>
              );
            })}
          </View>

          {/* FAB removed: integrated into the menu bar as center button */}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  shell: {
    marginHorizontal: 14,
    marginBottom: 10,
    // marginTop: 100,
  },
  bar: {
    height: 70,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: LaundryTheme.colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    ...LaundryTheme.shadow.strong,
  },
  menuItem: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  centerBtn: {
    width: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  centerInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: LaundryTheme.colors.card,
    ...LaundryTheme.shadow.strong,
  },
  menuLabel: {
    color: LaundryTheme.colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  menuLabelActive: {
    color: LaundryTheme.colors.primary,
  },
});
