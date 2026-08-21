import { AuthNotice, type AuthNoticeState } from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { setAppMode } from "@/lib/app-mode";
import { clearAuthSession } from "@/lib/auth-storage";
import { getProfile, uploadProfilePhoto } from "@/lib/profile-api";
import { disableCurrentDevicePushToken } from "@/lib/push-notifications";
import { canManageRoles, canUseDriverMode, canViewAdminOrders, getLandingRoute } from "@/lib/role-routing";
import type { Profile } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackground?: string;
  label: string;
  detail: string;
  onPress: () => void;
  danger?: boolean;
};

function SettingsRow({
  icon,
  iconColor = LaundryTheme.colors.primaryDark,
  iconBackground = LaundryTheme.colors.primarySoft,
  label,
  detail,
  onPress,
  danger = false,
}: SettingsRowProps) {
  return (
    <SoftPressable
      onPress={onPress}
      style={styles.settingRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingLabel, danger && styles.dangerText]}>
          {label}
        </Text>
        <Text style={styles.settingDetail}>{detail}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={danger ? LaundryTheme.colors.danger : "#A094B5"}
      />
    </SoftPressable>
  );
}

export default function SettingsScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const heroHeight = Math.max(260, Math.round(screenHeight * 0.34));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);
  const [showLogout, setShowLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [activeMode, setActiveMode] = useState<"customer" | "driver">("customer");
  const heroIn = useRef(new Animated.Value(0)).current;
  const sheetIn = useRef(new Animated.Value(0)).current;
  const sectionIns = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const modePosition = useRef(new Animated.Value(0)).current;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const result = await getProfile();
    if (result.success && result.data) {
      setProfile(result.data);
    } else {
      setLoadError(result.message || "Could not load your account details.");
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  useEffect(() => {
    heroIn.setValue(0);
    sheetIn.setValue(0);
    sectionIns.forEach((value) => value.setValue(0));
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroIn, {
          toValue: 1,
          duration: 430,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetIn, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(
        70,
        sectionIns.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [heroIn, sectionIns, sheetIn]);

  const initials = useMemo(() => {
    const parts = (profile?.name || profile?.email || "User")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase())
      .join("");
  }, [profile]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(getLandingRoute(profile?.role ?? "customer") as never);
  };

  const chooseProfilePhoto = async () => {
    if (uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice({
        title: "Photo access needed",
        message: "Allow photo access in your device settings to choose a profile image.",
        tone: "info",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    const upload = await uploadProfilePhoto(result.assets[0]);
    if (upload.success && upload.data?.avatarUrl) {
      setProfile((current) =>
        current ? { ...current, avatarUrl: upload.data.avatarUrl } : current,
      );
      setNotice({
        title: "Photo updated",
        message: "Your new profile photo is now saved across Dr Laundry.",
        tone: "success",
      });
    } else {
      setNotice({
        title: "Upload failed",
        message: upload.message || "Could not update your profile photo.",
        tone: "error",
      });
    }
    setUploading(false);
  };

  const selectMode = (mode: "customer" | "driver") => {
    if (!profile || !canUseDriverMode(profile.role)) return;
    if (profile.role === "driver" && mode === "customer") return;
    if (mode === activeMode) return;
    setActiveMode(mode);
    Animated.spring(modePosition, {
      toValue: mode === "driver" ? 1 : 0,
      speed: 18,
      bounciness: 4,
      useNativeDriver: true,
    }).start(async ({ finished }) => {
      if (finished && mode === "driver") {
        await setAppMode("driver");
        router.replace("/driver/home" as never);
      }
    });
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await disableCurrentDevicePushToken();
      await clearAuthSession();
      setShowLogout(false);
      router.replace("/login");
    } catch (error) {
      setShowLogout(false);
      setNotice({
        title: "Could not log out",
        message: error instanceof Error ? error.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const animatedSection = (index: number) => ({
    opacity: sectionIns[index],
    transform: [
      {
        translateY: sectionIns[index].interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.View
        style={{
          opacity: heroIn,
          transform: [
            {
              scale: heroIn.interpolate({
                inputRange: [0, 1],
                outputRange: [1.03, 1],
              }),
            },
          ],
        }}
      >
        <LinearGradient
          colors={["#391473", LaundryTheme.colors.primary, "#9A4ED7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { height: heroHeight }]}
        >
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />
          <SafeAreaView style={styles.heroSafe} edges={["top", "left", "right"]}>
            <SoftPressable
              onPress={goBack}
              style={styles.heroBack}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </SoftPressable>

            <SoftPressable
              onPress={chooseProfilePhoto}
              style={styles.avatarButton}
              accessibilityLabel="Change profile photo"
            >
              <View style={styles.avatarRing}>
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={220}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    {loading ? (
                      <ActivityIndicator color={LaundryTheme.colors.primary} />
                    ) : initials ? (
                      <Text style={styles.avatarText}>{initials}</Text>
                    ) : (
                      <Ionicons name="person" size={34} color={LaundryTheme.colors.primary} />
                    )}
                  </View>
                )}
                {uploading ? (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color={LaundryTheme.colors.primaryDark} />
              </View>
            </SoftPressable>

            <Text numberOfLines={1} style={styles.profileName}>
              {loading ? "Loading profile..." : profile?.name || "Your profile"}
            </Text>
            <Text numberOfLines={1} style={styles.profileEmail}>
              {profile?.email || "Dr Laundry customer"}
            </Text>

            {profile && canUseDriverMode(profile.role) && profile.role !== "driver" ? <View style={styles.modeSwitch}>
              <Animated.View
                style={[
                  styles.modeIndicator,
                  {
                    transform: [
                      {
                        translateX: modePosition.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 72],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Pressable onPress={() => selectMode("customer")} style={styles.modeOption}>
                <Ionicons
                  name="shirt-outline"
                  size={13}
                  color={activeMode === "customer" ? LaundryTheme.colors.primaryDark : "#EADFFF"}
                />
                <Text style={[styles.modeText, activeMode === "customer" && styles.modeTextActive]}>
                  Customer
                </Text>
              </Pressable>
              <Pressable onPress={() => selectMode("driver")} style={styles.modeOption}>
                <Ionicons
                  name="car-sport-outline"
                  size={13}
                  color={activeMode === "driver" ? LaundryTheme.colors.primaryDark : "#EADFFF"}
                />
                <Text style={[styles.modeText, activeMode === "driver" && styles.modeTextActive]}>
                  Driver
                </Text>
              </Pressable>
            </View> : profile ? <View style={styles.accessPill}><Ionicons name="shield-checkmark" size={12} color="#FFFFFF" /><Text style={styles.accessPillText}>{profile.role.toUpperCase()}</Text></View> : null}
          </SafeAreaView>
        </LinearGradient>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: sheetIn,
            transform: [
              {
                translateY: sheetIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [48, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeading}>
          <View>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Make Dr Laundry work your way</Text>
          </View>
          <View style={styles.settingsMark}>
            <Ionicons name="settings-outline" size={19} color={LaundryTheme.colors.primary} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <SoftPressable onPress={loadProfile} style={styles.errorCard}>
              <Ionicons name="cloud-offline-outline" size={17} color="#9B3651" />
              <Text numberOfLines={2} style={styles.errorText}>{loadError}</Text>
              <Text style={styles.retryText}>Retry</Text>
            </SoftPressable>
          ) : null}

          {profile && canUseDriverMode(profile.role) ? (
            <Animated.View style={animatedSection(0)}>
              <Text style={styles.sectionLabel}>WORKSPACE ACCESS</Text>
              <View style={styles.groupCard}>
                {profile.role === "superadmin" ? <>
                  <SettingsRow icon="grid-outline" label="Superadmin panel" detail="App access, operations and account roles" onPress={() => router.push("/admin" as never)} />
                  <View style={styles.divider} />
                </> : null}
                {canViewAdminOrders(profile.role) ? <>
                  <SettingsRow icon="receipt-outline" label="Available orders" detail="Track every customer order from the backend" onPress={() => router.push("/admin/orders" as never)} />
                  <View style={styles.divider} />
                </> : null}
                {canManageRoles(profile.role) ? <>
                  <SettingsRow icon="people-outline" label="Manage app roles" detail="Assign customer, driver and admin access" onPress={() => router.push("/admin/users" as never)} />
                  <View style={styles.divider} />
                </> : null}
                <SettingsRow icon="car-sport-outline" label="Driver mode" detail="Open pickups and delivery tasks" onPress={() => selectMode("driver")} />
              </View>
            </Animated.View>
          ) : null}

          <Animated.View style={animatedSection(0)}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.groupCard}>
              <SettingsRow
                icon="person-outline"
                label="Personal details"
                detail="Name, phone number and address"
                onPress={() => router.push("/profile")}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="notifications-outline"
                label="Notifications"
                detail="Review order and account updates"
                onPress={() => router.push("/notifications" as never)}
              />
            </View>
          </Animated.View>

          {profile?.role === "customer" ? <Animated.View style={animatedSection(1)}>
            <Text style={styles.sectionLabel}>LAUNDRY SERVICE</Text>
            <View style={styles.groupCard}>
              <SettingsRow
                icon="sparkles-outline"
                iconColor="#B45309"
                iconBackground="#FFF6DF"
                label="Membership"
                detail="Manage plans, perks and express service"
                onPress={() => router.push("/membership")}
              />
              <View style={styles.divider} />
              <SettingsRow
                icon="help-buoy-outline"
                label="Help and support"
                detail="Get help with an order or your account"
                onPress={() => router.push("/support")}
              />
            </View>
          </Animated.View> : null}

          <Animated.View style={animatedSection(2)}>
            <Text style={styles.sectionLabel}>SESSION</Text>
            <View style={styles.groupCard}>
              <SettingsRow
                icon="log-out-outline"
                iconColor={LaundryTheme.colors.danger}
                iconBackground="#FFF0F2"
                label="Log out"
                detail="Sign out of this device"
                onPress={() => setShowLogout(true)}
                danger
              />
            </View>
            <View style={styles.versionWrap}>
              <Text style={styles.versionBrand}>Dr Laundry</Text>
              <Text style={styles.versionText}>
                Version {Constants.expoConfig?.version ?? "1.0.0"}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>

      <Modal
        transparent
        visible={showLogout}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !signingOut && setShowLogout(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !signingOut && setShowLogout(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={26} color={LaundryTheme.colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Log out of Dr Laundry?</Text>
            <Text style={styles.modalMessage}>
              You can sign back in at any time. Your orders and profile will remain saved.
            </Text>
            <View style={styles.modalActions}>
              <SoftPressable
                onPress={() => setShowLogout(false)}
                disabled={signingOut}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </SoftPressable>
              <SoftPressable
                onPress={logout}
                disabled={signingOut}
                style={styles.logoutButton}
              >
                {signingOut ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.logoutText}>Log out</Text>
                )}
              </SoftPressable>
            </View>
          </View>
        </View>
      </Modal>

      <AuthNotice notice={notice} onClose={() => setNotice(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  hero: { overflow: "hidden" },
  heroOrbLarge: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -82, top: -90, backgroundColor: "rgba(255,255,255,0.09)" },
  heroOrbSmall: { position: "absolute", width: 110, height: 110, borderRadius: 55, left: -38, bottom: -40, backgroundColor: "rgba(255,255,255,0.07)" },
  heroSafe: { flex: 1, alignItems: "center", paddingHorizontal: 20 },
  heroBack: { position: "absolute", left: 20, top: 8, width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  avatarButton: { marginTop: 20 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, padding: 4, backgroundColor: "rgba(255,255,255,0.92)", ...LaundryTheme.shadow.strong },
  avatarImage: { width: "100%", height: "100%", borderRadius: 40 },
  avatarPlaceholder: { flex: 1, borderRadius: 40, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  avatarText: { color: LaundryTheme.colors.primaryDark, fontSize: 25, fontWeight: "900" },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(40,15,75,0.58)" },
  cameraBadge: { position: "absolute", right: -2, bottom: 0, width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#8A45CE" },
  profileName: { maxWidth: "78%", marginTop: 10, color: "#FFFFFF", fontSize: 17, fontWeight: "900", letterSpacing: -0.2 },
  profileEmail: { maxWidth: "76%", marginTop: 3, color: "#EADFFF", fontSize: 10.5 },
  modeSwitch: { width: 148, height: 34, marginTop: 11, padding: 3, borderRadius: 13, flexDirection: "row", backgroundColor: "rgba(26,8,54,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  modeIndicator: { position: "absolute", left: 3, top: 3, width: 70, height: 26, borderRadius: 10, backgroundColor: "#FFFFFF" },
  modeOption: { width: 70, height: 26, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", zIndex: 1 },
  modeText: { color: "#EADFFF", fontSize: 9, fontWeight: "800" },
  modeTextActive: { color: LaundryTheme.colors.primaryDark },
  accessPill: { marginTop: 11, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "rgba(26,8,54,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  accessPillText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  sheet: { flex: 1, marginTop: -26, paddingTop: 9, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#FCFAFF", overflow: "hidden" },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#DED5EA" },
  sheetHeading: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: LaundryTheme.colors.ink, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { marginTop: 3, color: LaundryTheme.colors.muted, fontSize: 10.5 },
  settingsMark: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  content: { paddingHorizontal: 20, paddingBottom: LaundryTheme.layout.bottomMenuSpace + 22 },
  errorCard: { marginTop: 12, minHeight: 48, borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFF3F5", borderWidth: 1, borderColor: "#FFD9E1" },
  errorText: { flex: 1, color: "#7D3448", fontSize: 11, lineHeight: 15 },
  retryText: { color: "#9B3651", fontSize: 11, fontWeight: "900" },
  sectionLabel: { marginTop: 17, marginBottom: 7, marginLeft: 4, color: LaundryTheme.colors.muted, fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },
  groupCard: { borderRadius: 20, paddingHorizontal: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.border, ...LaundryTheme.shadow.soft },
  settingRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  settingIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  settingCopy: { flex: 1 },
  settingLabel: { color: LaundryTheme.colors.ink, fontSize: 12.5, fontWeight: "800" },
  settingDetail: { marginTop: 3, color: LaundryTheme.colors.muted, fontSize: 10, lineHeight: 14 },
  dangerText: { color: LaundryTheme.colors.danger },
  divider: { height: 1, marginLeft: 50, backgroundColor: "#EFE9F8" },
  versionWrap: { alignItems: "center", paddingTop: 21 },
  versionBrand: { color: LaundryTheme.colors.primaryDark, fontSize: 10.5, fontWeight: "900" },
  versionText: { marginTop: 3, color: "#A094B5", fontSize: 9 },
  modalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(23,15,38,0.52)" },
  modalCard: { width: "100%", maxWidth: 360, borderRadius: 26, padding: 22, alignItems: "center", backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.strong },
  logoutIcon: { width: 56, height: 56, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F2" },
  modalTitle: { marginTop: 15, color: LaundryTheme.colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" },
  modalMessage: { marginTop: 8, color: LaundryTheme.colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  modalActions: { alignSelf: "stretch", flexDirection: "row", gap: 10, marginTop: 20 },
  cancelButton: { flex: 1, minHeight: 47, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F1FB" },
  cancelText: { color: LaundryTheme.colors.primaryDark, fontSize: 13, fontWeight: "800" },
  logoutButton: { flex: 1, minHeight: 47, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.danger },
  logoutText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});
