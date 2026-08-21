import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { setAppMode } from "@/lib/app-mode";
import { clearAuthSession } from "@/lib/auth-storage";
import { getProfile, updateProfile } from "@/lib/profile-api";
import { disableCurrentDevicePushToken } from "@/lib/push-notifications";
import { canUseDriverMode } from "@/lib/role-routing";
import type { Profile } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ActionItem = {
  key: "edit" | "settings" | "support" | "driver" | "logout";
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "danger" | "driver";
};

const baseActions: ActionItem[] = [
  { key: "edit", label: "Personal details", description: "Update your name, phone and address", icon: "person-outline" },
  { key: "settings", label: "App settings", description: "Theme, notifications and security", icon: "settings-outline" },
  { key: "support", label: "Help & support", description: "Get help with your account or an order", icon: "headset-outline" },
  { key: "logout", label: "Log out", description: "Sign out securely on this device", icon: "log-out-outline", tone: "danger" },
];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const entrance = useRef(new Animated.Value(0)).current;
  const dismissToast = useCallback(() => setToast(null), []);

  const initials = useMemo(() => {
    const words = (profile?.name || profile?.email || "User").trim().split(/\s+/);
    return words.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
  }, [profile]);

  const resetDraft = (next: Profile | null) => {
    if (!next) return;
    setName(next.name);
    setPhoneNumber(next.phoneNumber);
    setAddress(next.address);
  };

  useEffect(() => {
    let active = true;
    void getProfile().then(async (result) => {
      if (!active) return;
      if (!result.success || !result.data) {
        await clearAuthSession();
        router.replace("/login");
        return;
      }
      setProfile(result.data);
      resetDraft(result.data);
      setLoading(false);
      Animated.spring(entrance, { toValue: 1, damping: 17, stiffness: 120, useNativeDriver: true }).start();
    });
    return () => { active = false; };
  }, [entrance]);

  const saveProfile = async () => {
    if (saving) return;
    if (!name.trim() || !phoneNumber.trim() || !address.trim()) {
      Alert.alert("Missing details", "Fill in your name, phone number and address.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateProfile({ name: name.trim(), phoneNumber: phoneNumber.trim(), address: address.trim() });
      if (!result.success) { Alert.alert("Update failed", result.message); return; }
      const refreshed = await getProfile();
      if (refreshed.success && refreshed.data) { setProfile(refreshed.data); resetDraft(refreshed.data); }
      setEditing(false);
    } finally { setSaving(false); }
  };

  const actions = useMemo(() => {
    const next = [...baseActions];
    if (profile && canUseDriverMode(profile.role)) {
      next.splice(3, 0, { key: "driver", label: "Driver workspace", description: "Open live pickup and delivery tasks", icon: "bicycle-outline", tone: "driver" });
    }
    return next;
  }, [profile]);

  const performLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setToast({ id: Date.now(), title: "Signing out", message: "Securing this device session…", tone: "info", persistent: true });
    try {
      try {
        await disableCurrentDevicePushToken();
      } catch {
        // Notification cleanup must not trap a user inside a session.
      }
      await clearAuthSession();
      router.replace("/login");
    } catch {
      setToast({ id: Date.now(), title: "Could not sign out", message: "Please check your connection and try again.", tone: "error" });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleAction = async (key: ActionItem["key"]) => {
    if (key === "edit") { setEditing((value) => !value); return; }
    if (key === "settings") { router.push("/settings"); return; }
    if (key === "support") { router.push("/support"); return; }
    if (key === "driver") { await setAppMode("driver"); router.replace("/driver/home" as never); return; }
    setToast({
      id: Date.now(),
      title: "Sign out?",
      message: "You’ll need to enter your login details to use this account again.",
      tone: "info",
      actionLabel: "Log out",
      dismissLabel: "Stay signed in",
      persistent: true,
      onAction: () => void performLogout(),
    });
  };

  return (
    <LinearGradient colors={["#F8F1FF", "#FFFFFF", "#F1E6FF"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}><Text style={styles.title}>My Profile</Text><SoftPressable onPress={() => router.push("/settings")} style={styles.headerButton}><Ionicons name="settings-outline" size={21} color="#321343" /></SoftPressable></View>

          {loading ? <View style={styles.loadingCard}><ActivityIndicator color="#6A1BB1" /><Text style={styles.loadingText}>Loading your profile…</Text></View> : profile ? (
            <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
              <LinearGradient colors={["#7C28D3", "#52107F", "#321343"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroOrbOne} /><View style={styles.heroOrbTwo} />
                <View style={styles.avatarRing}>
                  {profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} contentFit="cover" style={styles.avatarImage} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials}</Text></View>}
                </View>
                <View style={styles.heroCopy}><Text style={styles.name} numberOfLines={1}>{profile.name || "Laundry customer"}</Text><Text style={styles.email} numberOfLines={1}>{profile.email}</Text><View style={styles.rolePill}><Ionicons name={profile.role === "customer" ? "sparkles" : "shield-checkmark"} size={12} color="#FFFFFF" /><Text style={styles.roleText}>{profile.role === "customer" ? "Customer" : `${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)} access`}</Text></View></View>
              </LinearGradient>

              <View style={styles.infoGrid}>
                <View style={styles.infoCard}><View style={styles.infoIcon}><Ionicons name="call-outline" size={18} color="#6A1BB1" /></View><Text style={styles.infoLabel}>PHONE</Text><Text style={styles.infoValue} numberOfLines={1}>{profile.phoneNumber || "Not added"}</Text></View>
                <View style={styles.infoCard}><View style={styles.infoIcon}><Ionicons name="location-outline" size={18} color="#6A1BB1" /></View><Text style={styles.infoLabel}>DEFAULT ADDRESS</Text><Text style={styles.infoValue} numberOfLines={2}>{profile.address || "Not added"}</Text></View>
              </View>

              <View style={styles.actionSection}><Text style={styles.sectionTitle}>Account</Text><Text style={styles.sectionCaption}>Your profile and app preferences</Text><View style={styles.actionList}>{actions.map((item) => <SoftPressable key={item.key} onPress={() => void handleAction(item.key)} style={styles.actionRow}><View style={[styles.actionIcon, item.tone === "driver" && styles.driverIcon, item.tone === "danger" && styles.dangerIcon]}><Ionicons name={item.icon} size={19} color={item.tone === "danger" ? "#C44262" : item.tone === "driver" ? "#FFFFFF" : "#6319A4"} /></View><View style={styles.actionCopy}><Text style={[styles.actionLabel, item.tone === "danger" && styles.dangerText]}>{item.label}</Text><Text style={styles.actionDescription} numberOfLines={1}>{item.description}</Text></View><Ionicons name="chevron-forward" size={17} color="#A69AAD" /></SoftPressable>)}</View></View>
            </Animated.View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <Modal
        transparent
        visible={editing}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!saving) {
            setEditing(false);
            resetDraft(profile);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!saving) {
                setEditing(false);
                resetDraft(profile);
              }
            }}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.editHeading}>
              <View>
                <Text style={styles.sectionTitle}>Personal details</Text>
                <Text style={styles.sectionCaption}>Keep delivery information accurate</Text>
              </View>
              <SoftPressable disabled={saving} onPress={() => { setEditing(false); resetDraft(profile); }} style={styles.closeButton}>
                <Ionicons name="close" size={18} color="#5B168F" />
              </SoftPressable>
            </View>
            <Text style={styles.label}>Full name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" placeholderTextColor="#9A8BB8" />
            <Text style={styles.label}>Phone number</Text>
            <TextInput value={phoneNumber} onChangeText={setPhoneNumber} style={styles.input} keyboardType="phone-pad" placeholder="+234…" placeholderTextColor="#9A8BB8" />
            <Text style={styles.label}>Address</Text>
            <TextInput value={address} onChangeText={setAddress} style={[styles.input, styles.addressInput]} multiline placeholder="Your delivery address" placeholderTextColor="#9A8BB8" />
            <SoftPressable disabled={saving} onPress={() => void saveProfile()} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.saveText}>Save Changes</Text><Ionicons name="checkmark" size={18} color="#FFFFFF" /></>}
            </SoftPressable>
          </View>
        </View>
      </Modal>
      <AppToast toast={toast} topInset={12} onDismiss={dismissToast} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safeArea: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: LaundryTheme.layout.bottomMenuSpace + 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, title: { fontSize: 31, fontWeight: "900", color: "#211429", letterSpacing: -1 }, headerButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E9DFEF", ...LaundryTheme.shadow.soft },
  loadingCard: { borderRadius: 22, padding: 28, backgroundColor: "#FFFFFF", alignItems: "center", gap: 10 }, loadingText: { color: "#766B7F", fontWeight: "600" },
  hero: { minHeight: 170, borderRadius: 28, padding: 20, overflow: "hidden", flexDirection: "row", alignItems: "center", shadowColor: "#3E0A65", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7 }, heroOrbOne: { position: "absolute", width: 155, height: 155, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.08)", right: -34, top: -62 }, heroOrbTwo: { position: "absolute", width: 100, height: 100, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.06)", left: -35, bottom: -46 },
  avatarRing: { width: 92, height: 92, borderRadius: 32, padding: 4, backgroundColor: "rgba(255,255,255,0.24)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" }, avatarImage: { flex: 1, borderRadius: 28 }, avatarFallback: { flex: 1, borderRadius: 28, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#5B168F", fontSize: 25, fontWeight: "900" }, heroCopy: { flex: 1, marginLeft: 15 }, name: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", letterSpacing: -0.4 }, email: { color: "#E7D2FA", fontSize: 12, marginTop: 4 }, rolePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 11, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.16)" }, roleText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  infoGrid: { flexDirection: "row", gap: 12, marginTop: 15 }, infoCard: { flex: 1, minHeight: 117, borderRadius: 20, padding: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECE4F1", ...LaundryTheme.shadow.soft }, infoIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F1E5FA", alignItems: "center", justifyContent: "center" }, infoLabel: { color: "#9A8DA2", fontSize: 9, fontWeight: "900", letterSpacing: 0.7, marginTop: 10 }, infoValue: { color: "#302338", fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 4 },
  editCard: { marginTop: 16, borderRadius: 23, padding: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E0EE" }, editHeading: { flexDirection: "row", justifyContent: "space-between", marginBottom: 13 }, sectionTitle: { color: "#26182F", fontSize: 17, fontWeight: "900" }, sectionCaption: { color: "#918598", fontSize: 11, marginTop: 2 }, closeButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F2E8FA", alignItems: "center", justifyContent: "center" }, label: { color: "#4A3C52", fontSize: 11, fontWeight: "800", marginBottom: 6, marginTop: 10 }, input: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: "#DED4E5", backgroundColor: "#FCFAFD", paddingHorizontal: 14, color: "#271D2D", fontSize: 14 }, addressInput: { minHeight: 70, paddingTop: 13, textAlignVertical: "top" }, saveButton: { minHeight: 50, borderRadius: 16, backgroundColor: "#5B168F", marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, saveText: { color: "#FFFFFF", fontWeight: "900" }, disabled: { opacity: 0.65 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,14,34,0.55)" }, modalCard: { width: "100%", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E0EE", ...LaundryTheme.shadow.strong }, modalHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 15, backgroundColor: "#DED4E5" },
  actionSection: { marginTop: 22 }, actionList: { marginTop: 11, borderRadius: 23, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE1EF", overflow: "hidden" }, actionRow: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E9E0EE" }, actionIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F2E7FA", alignItems: "center", justifyContent: "center" }, driverIcon: { backgroundColor: "#5B168F" }, dangerIcon: { backgroundColor: "#FBE8ED" }, actionCopy: { flex: 1, marginHorizontal: 12 }, actionLabel: { color: "#2C2133", fontSize: 14, fontWeight: "800" }, dangerText: { color: "#B93958" }, actionDescription: { color: "#978B9D", fontSize: 11, marginTop: 3 },
});
