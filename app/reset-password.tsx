import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { resetPassword } from "@/lib/auth-api";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ResetPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const initialEmail = useMemo(() => {
    return typeof emailParam === "string" ? emailParam : "";
  }, [emailParam]);

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!email.trim() || !token.trim() || !newPassword) {
      Alert.alert("Missing info", "Fill in all fields to reset password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match", "Re-enter your new password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await resetPassword({
        email: email.trim(),
        token: token.trim(),
        newPassword,
      });

      if (!result.success) {
        Alert.alert("Reset failed", result.message);
        return;
      }

      Alert.alert("Password reset", result.message || "You can sign in now.");
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
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
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
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
          <Text style={styles.title}>Reset password</Text>
          <View style={styles.roundButton} />
        </View>

        <View style={styles.card}>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor="#9A8BB8"
              style={styles.input}
            />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>Reset code</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor="#9A8BB8"
              style={styles.input}
            />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Enter a new password"
              placeholderTextColor="#9A8BB8"
              style={styles.input}
            />
          </View>
          <View style={styles.inputBlock}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Re-enter your password"
              placeholderTextColor="#9A8BB8"
              style={styles.input}
            />
          </View>

          <SoftPressable
            onPress={handleSubmit}
            style={[
              styles.primaryButton,
              isSubmitting && styles.buttonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryText}>Reset password</Text>
            )}
          </SoftPressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
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
    fontSize: 22,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
  },
  card: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    padding: 18,
  },
  inputBlock: {
    marginBottom: 14,
  },
  label: {
    color: LaundryTheme.colors.ink,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: LaundryTheme.colors.ink,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
