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
  activeIcon: keyof typeof Ionicons.glyphMap;
  route: string;
};

// Top-level tab destinations where the bottom menu is visible.
// On all child screens, checkout flows, chat/support, deep order details, and forms,
// the bottom navigation is hidden to preserve focus and avoid accidental navigation.
const TOP_LEVEL_TAB_ROUTES = [
  "/home",
  "/order-history",
  "/track-order",
  "/profile",
];

const menuItems: MenuItem[] = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home", route: "/home" },
  {
    key: "history",
    label: "Orders",
    icon: "receipt-outline",
    activeIcon: "receipt",
    route: "/order-history",
  },
  {
    key: "track",
    label: "Track",
    icon: "navigate-outline",
    activeIcon: "navigate",
    route: "/track-order",
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person-outline",
    activeIcon: "person",
    route: "/profile",
  },
];

function resolveActiveKey(pathname: string): MenuItem["key"] | null {
  if (pathname.startsWith("/home")) return "home";
  if (pathname.startsWith("/order-history")) return "history";
  if (pathname.startsWith("/track-order")) return "track";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}

export function RootBottomMenu() {
  const pathname = usePathname();

  // Rule of Thumb: Only show the bottom navigation bar on top-level tab destinations.
  // Hide on all child pages, checkout funnels, forms, chat, and detail screens.
  const isTopLevelTab = TOP_LEVEL_TAB_ROUTES.includes(pathname);
  if (!isTopLevelTab) {
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
          {/* Floating Callout Pill above + button on Home screen */}
          {pathname === "/home" && (
            <View style={styles.calloutWrap}>
              <SoftPressable
                onPress={() => router.push("/new-order")}
                style={styles.calloutPill}
              >
                <Text style={styles.calloutText}>+ Book New Service</Text>
              </SoftPressable>
              <View style={styles.calloutArrow} />
            </View>
          )}

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
                    name={active ? item.activeIcon : item.icon}
                    size={22}
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
                  {active && <View style={styles.activeDot} />}
                </SoftPressable>
              );
            })}

            {/* Center + Button */}
            <SoftPressable
              onPress={() => router.push("/new-order")}
              style={styles.centerBtn}
            >
              <View style={styles.centerOuterGlow}>
                <View style={styles.centerInner}>
                  <Ionicons name="add" size={24} color="#fff" />
                </View>
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
                    name={active ? item.activeIcon : item.icon}
                    size={22}
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
                  {active && <View style={styles.activeDot} />}
                </SoftPressable>
              );
            })}
          </View>
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
    marginHorizontal: 16,
    marginBottom: 10,
    alignItems: "center",
  },
  calloutWrap: {
    alignItems: "center",
    marginBottom: 6,
  },
  calloutPill: {
    backgroundColor: LaundryTheme.colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    ...LaundryTheme.shadow.soft,
  },
  calloutText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  calloutArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: LaundryTheme.colors.primaryDark,
    marginTop: -1,
  },
  bar: {
    width: "100%",
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    ...LaundryTheme.shadow.strong,
  },
  menuItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
  },
  centerBtn: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  centerOuterGlow: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(76, 16, 125, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...LaundryTheme.shadow.strong,
  },
  menuLabel: {
    color: LaundryTheme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  menuLabelActive: {
    color: LaundryTheme.colors.primary,
    fontWeight: "900",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LaundryTheme.colors.primary,
    marginTop: 1,
  },
});
