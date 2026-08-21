import { AuthNotice, type AuthNoticeState } from "@/components/auth-notice";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getManagedProfiles, updateManagedProfileRole, type ManagedProfile } from "@/lib/admin-api";
import { getProfile } from "@/lib/profile-api";
import { getLandingRoute } from "@/lib/role-routing";
import type { AppRole } from "@/types/profile";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const roles: AppRole[] = ["customer", "driver", "admin", "superadmin"];
const protectedEmails = new Set(["ifeanyieee8105@gmail.com", "drlaundry6@gmail.com"]);

export default function ManageRolesScreen() {
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ profile: ManagedProfile; role: AppRole } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<AuthNoticeState | null>(null);

  const load = async () => {
    try { setProfiles(await getManagedProfiles()); }
    catch (error) { setNotice({ title: "Couldn’t load accounts", message: error instanceof Error ? error.message : "Please try again.", tone: "error" }); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let mounted = true;
    void getProfile().then((result) => {
      if (!mounted) return;
      if (result.data?.role !== "superadmin") { router.replace(getLandingRoute(result.data?.role ?? "customer") as never); return; }
      void load();
    });
    return () => { mounted = false; };
  }, []);

  const commitRole = async () => {
    if (!pending || saving) return;
    setSaving(true);
    try {
      await updateManagedProfileRole(pending.profile.id, pending.role);
      setProfiles((current) => current.map((profile) => profile.id === pending.profile.id ? { ...profile, role: pending.role } : profile));
      setNotice({ title: "Access updated", message: `${pending.profile.name} is now ${pending.role}.`, tone: "success" });
      setPending(null);
    } catch (error) {
      setNotice({ title: "Role update failed", message: error instanceof Error ? error.message : "Please try again.", tone: "error" });
    } finally { setSaving(false); }
  };

  return <LinearGradient colors={["#F8F0FF", "#FFFFFF"]} style={styles.container}>
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><SoftPressable onPress={() => router.canGoBack() ? router.back() : router.replace("/admin" as never)} style={styles.back}><Ionicons name="chevron-back" size={21} color="#4A1766" /></SoftPressable><View style={styles.headerCopy}><Text style={styles.kicker}>SUPERADMIN ONLY</Text><Text style={styles.title}>Manage Roles</Text></View></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.info}><Ionicons name="shield-checkmark-outline" size={20} color="#681DA6" /><Text style={styles.infoText}>Roles are enforced by Supabase policies, not only hidden in the interface.</Text></View>
        {loading ? <View style={styles.loading}><ActivityIndicator color="#681DA6" /><Text style={styles.loadingText}>Loading app accounts…</Text></View> : profiles.map((profile) => {
          const protectedSuperadmin = protectedEmails.has(profile.email.toLowerCase());
          return <View key={profile.id} style={styles.card}><View style={styles.personRow}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text></View><View style={styles.personCopy}><Text style={styles.name}>{profile.name}</Text><Text style={styles.email} numberOfLines={1}>{profile.email || profile.phoneNumber || profile.id}</Text></View>{protectedSuperadmin ? <Ionicons name="lock-closed" size={16} color="#681DA6" /> : null}</View><View style={styles.roleRow}>{roles.map((role) => { const active = profile.role === role; const disabled = protectedSuperadmin && role !== "superadmin"; return <SoftPressable key={role} disabled={disabled || active} onPress={() => setPending({ profile, role })} style={[styles.role, active && styles.activeRole, disabled && styles.disabledRole]}><Text style={[styles.roleText, active && styles.activeRoleText]}>{role === "superadmin" ? "Super" : role.charAt(0).toUpperCase() + role.slice(1)}</Text></SoftPressable>; })}</View></View>;
        })}
      </ScrollView>
    </SafeAreaView>

    <Modal transparent visible={!!pending} animationType="fade" statusBarTranslucent onRequestClose={() => !saving && setPending(null)}><View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && setPending(null)} /><View style={styles.modal}><View style={styles.modalIcon}><Ionicons name="key-outline" size={24} color="#681DA6" /></View><Text style={styles.modalTitle}>Change account access?</Text><Text style={styles.modalText}>{pending ? `${pending.profile.name} will receive ${pending.role} access immediately.` : ""}</Text><View style={styles.actions}><SoftPressable disabled={saving} onPress={() => setPending(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></SoftPressable><SoftPressable disabled={saving} onPress={() => void commitRole()} style={styles.confirm}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Update role</Text>}</SoftPressable></View></View></View></Modal>
    <AuthNotice notice={notice} onClose={() => setNotice(null)} />
  </LinearGradient>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, header: { padding: 18, paddingTop: 12, flexDirection: "row", alignItems: "center" }, back: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8DFED" }, headerCopy: { marginLeft: 12 }, kicker: { color: "#856A95", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, title: { color: LaundryTheme.colors.ink, fontSize: 25, fontWeight: "900", marginTop: 1 }, content: { paddingHorizontal: 18, paddingBottom: 32, gap: 12 }, info: { padding: 14, borderRadius: 17, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F1E5FA" }, infoText: { flex: 1, color: "#5C4770", fontSize: 10.5, lineHeight: 16 }, loading: { padding: 28, alignItems: "center", gap: 9 }, loadingText: { color: LaundryTheme.colors.muted },
  card: { padding: 15, borderRadius: 22, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EAE2EF", ...LaundryTheme.shadow.soft }, personRow: { flexDirection: "row", alignItems: "center" }, avatar: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#EEE0F9" }, avatarText: { color: "#5B168F", fontWeight: "900", fontSize: 16 }, personCopy: { flex: 1, marginHorizontal: 10 }, name: { color: LaundryTheme.colors.ink, fontSize: 13.5, fontWeight: "900" }, email: { color: LaundryTheme.colors.muted, fontSize: 9.5, marginTop: 3 }, roleRow: { marginTop: 13, flexDirection: "row", gap: 6 }, role: { flex: 1, minHeight: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#F4EFF7" }, activeRole: { backgroundColor: "#5B168F" }, disabledRole: { opacity: 0.38 }, roleText: { color: "#715F7D", fontSize: 8.5, fontWeight: "900" }, activeRoleText: { color: "#FFFFFF" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(25,14,34,0.55)" }, modal: { width: "100%", maxWidth: 360, padding: 22, borderRadius: 26, alignItems: "center", backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.strong }, modalIcon: { width: 54, height: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F1E5FA" }, modalTitle: { marginTop: 14, color: LaundryTheme.colors.ink, fontSize: 18, fontWeight: "900" }, modalText: { marginTop: 7, color: LaundryTheme.colors.muted, textAlign: "center", fontSize: 11.5, lineHeight: 18 }, actions: { width: "100%", marginTop: 19, flexDirection: "row", gap: 9 }, cancel: { flex: 1, minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#F3EDF7" }, cancelText: { color: "#5B168F", fontWeight: "900" }, confirm: { flex: 1, minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#5B168F" }, confirmText: { color: "#FFFFFF", fontWeight: "900" },
});
