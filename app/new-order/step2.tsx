import StepHeader from "@/components/order/step-header";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getDraft, saveDraft } from "@/lib/order-draft";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NewOrderStep2() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [note, setNote] = useState(
    "Please call on arrival and use the side gate.",
  );

  useEffect(() => {
    (async () => {
      const d = await getDraft();
      if (d?.address) setAddress(d.address);
      if (d?.note) setNote(d.note);
    })();
  }, []);

  const goBack = () => router.back();

  const applyQuickAddress = (label: string) => {
    setAddress(label);
  };

  const handleContinue = async () => {
    if (!address.trim()) return;
    await saveDraft({ address: address.trim(), note: note.trim() });
    router.push("/new-order/step3");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <StepHeader title="Address & Notes" subtitle="Quick details" step={2} />

        {/* QUICK PICKS */}
        <View style={styles.quickRow}>
          {["Home address", "Office address", "Campus hostel"].map((item, i) => (
            <SoftPressable
              key={i}
              onPress={() => applyQuickAddress(item)}
              style={styles.quickChip}
            >
              <Text style={styles.quickChipText}>
                {item.split(" ")[0]}
              </Text>
            </SoftPressable>
          ))}
        </View>

        {/* INPUT GROUP */}
        <View style={styles.card}>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>Pickup address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Enter pickup address"
              placeholderTextColor={LaundryTheme.colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.inputBlock}>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              style={[styles.input, styles.noteInput]}
            />
          </View>
        </View>

      </ScrollView>

      {/* ACTIONS */}
      <View style={styles.rowButtons}>
        <SoftPressable onPress={goBack} style={styles.ghostBtn}>
          <Text style={styles.ghostText}>Back</Text>
        </SoftPressable>

        <SoftPressable onPress={handleContinue} style={styles.cta}>
          <Text style={styles.ctaText}>Continue</Text>
        </SoftPressable>
      </View>
    </SafeAreaView>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: LaundryTheme.colors.bgStart,
  },

  scrollContent: {
    paddingBottom: 16,
  },

  /* QUICK CHIPS */

  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },

  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
  },

  quickChipText: {
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
  },

  /* CARD GROUP */

  card: {
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    overflow: "hidden",
  },

  inputBlock: {
    padding: 12,
  },

  label: {
    fontSize: 12,
    marginBottom: 6,
    color: LaundryTheme.colors.muted,
    fontWeight: "700",
  },

  input: {
    fontSize: 14,
    color: LaundryTheme.colors.ink,
  },

  noteInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LaundryTheme.colors.border,
  },

  /* BUTTONS */

  rowButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: LaundryTheme.layout.bottomMenuSpace - 20,
  },

  ghostBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    backgroundColor: "#fff",
  },

  ghostText: {
    color: LaundryTheme.colors.ink,
    fontWeight: "700",
  },

  cta: {
    flex: 1,
    backgroundColor: LaundryTheme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  ctaText: {
    color: "#fff",
    fontWeight: "800",
  },
});