import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { clearAuthSession } from "@/lib/auth-storage";
import { setAppMode } from "@/lib/app-mode";
import { getProfile, updateProfile } from "@/lib/profile-api";
import type { Profile } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ProfileAction = {
  key: "edit" | "driverMode" | "logout";
  label: string;
};

const profileActions: ProfileAction[] = [
  { key: "edit", label: "Edit profile" },
  { key: "driverMode", label: "Switch to Driver Mode" },
  { key: "logout", label: "Logout" },
];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");

  const initials = useMemo(() => {
    const label = profile?.name || profile?.email || "User";
    return label.trim().charAt(0).toUpperCase();
  }, [profile]);

  const resetDraft = (next: Profile | null) => {
    if (!next) {
      return;
    }

    setName(next.name ?? "");
    setPhoneNumber(next.phoneNumber ?? "");
    setAddress(next.address ?? "");
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setIsLoading(true);
      const result = await getProfile();

      if (!active) {
        return;
      }

      if (!result.success || !result.data) {
        Alert.alert("Session error", result.message || "Please sign in again.");
        await clearAuthSession();
        router.replace("/login");
        return;
      }

      setProfile(result.data);
      resetDraft(result.data);
      setIsLoading(false);
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await clearAuthSession();
    router.replace("/login");
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (!name.trim() || !phoneNumber.trim() || !address.trim()) {
      Alert.alert("Missing info", "Fill in all profile fields before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProfile({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
      });

      if (!result.success) {
        Alert.alert("Update failed", result.message);
        return;
      }

      const refreshed = await getProfile();
      if (refreshed.success && refreshed.data) {
        setProfile(refreshed.data);
        resetDraft(refreshed.data);
      }

      setIsEditing(false);
      Alert.alert("Profile updated", result.message || "Changes saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (key: ProfileAction["key"]) => {
    if (key === "edit") {
      setIsEditing(true);
      return;
    }

    if (key === "driverMode") {
      await setAppMode("driver");
      router.replace("/driver/home" as any);
      return;
    }

    Alert.alert("Sign out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: handleLogout },
    ]);
  };

  return (
    <LinearGradient
      colors={[
        LaundryTheme.colors.bgStart,
        "#FFFFFF",
        LaundryTheme.colors.bgEnd,
      ]}
      style={styles.container}
    >
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <SoftPressable
              onPress={() => router.back()}
              style={styles.roundButton}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={LaundryTheme.colors.ink}
              />
            </SoftPressable>
            <Text style={styles.title}>Profile</Text>
            <View style={styles.roundButton} />
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator
                color={LaundryTheme.colors.primary}
                size="small"
              />
            </View>
          ) : (
            <>
              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <Text style={styles.name}>{profile?.name || ""}</Text>
                <Text style={styles.email}>{profile?.email || ""}</Text>
                <Text style={styles.meta}>{profile?.phoneNumber || ""}</Text>
                <Text style={styles.meta}>{profile?.address || ""}</Text>
              </View>

              {isEditing ? (
                <View style={styles.editCard}>
                  <View style={styles.inputBlock}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Amina Yusuf"
                      placeholderTextColor="#9A8BB8"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.inputBlock}>
                    <Text style={styles.label}>Phone number</Text>
                    <TextInput
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      placeholder="+234 000 000 0000"
                      placeholderTextColor="#9A8BB8"
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.inputBlock}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                      value={address}
                      onChangeText={setAddress}
                      placeholder="12 Kudirat Abiola Way"
                      placeholderTextColor="#9A8BB8"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.editActions}>
                    <SoftPressable
                      onPress={() => {
                        setIsEditing(false);
                        resetDraft(profile);
                      }}
                      style={styles.ghostButton}
                    >
                      <Text style={styles.ghostText}>Cancel</Text>
                    </SoftPressable>
                    <SoftPressable
                      onPress={handleSave}
                      style={[
                        styles.primaryButton,
                        isSaving && styles.buttonDisabled,
                      ]}
                    >
                      {isSaving ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryText}>Save</Text>
                      )}
                    </SoftPressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.list}>
                {profileActions.map((item) => (
                  <SoftPressable
                    key={item.key}
                    style={styles.itemRow}
                    onPress={() => handleAction(item.key)}
                  >
                    <Text style={styles.itemText}>{item.label}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={LaundryTheme.colors.muted}
                    />
                  </SoftPressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: LaundryTheme.layout.bottomMenuSpace + 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    letterSpacing: -0.4,
  },
  loadingCard: {
    marginTop: 20,
    borderRadius: 18,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    alignItems: "center",
  },
  profileCard: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  name: {
    marginTop: 10,
    color: LaundryTheme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  email: {
    marginTop: 3,
    color: LaundryTheme.colors.muted,
    fontSize: 13,
  },
  meta: {
    marginTop: 4,
    color: LaundryTheme.colors.muted,
    fontSize: 12,
  },
  editCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    padding: 16,
  },
  inputBlock: {
    marginBottom: 12,
  },
  label: {
    color: LaundryTheme.colors.ink,
    fontSize: 14,
    marginBottom: 6,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: LaundryTheme.colors.ink,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  ghostButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    alignItems: "center",
  },
  ghostText: {
    fontWeight: "700",
    color: LaundryTheme.colors.primaryDark,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: LaundryTheme.colors.primary,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  list: {
    marginTop: 14,
    gap: 10,
  },
  itemRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: {
    color: LaundryTheme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
});
