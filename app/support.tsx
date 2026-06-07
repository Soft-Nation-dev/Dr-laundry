import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const supportItems = [
  { icon: "logo-whatsapp", title: "WhatsApp", subtitle: "+234 900 000 0000" },
  { icon: "call-outline", title: "Call", subtitle: "Mon - Sun, 7am - 10pm" },
  { icon: "mail-outline", title: "Email", subtitle: "help@drlaundry.app" },
];

export default function SupportScreen() {
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
          <Text style={styles.title}>Support</Text>
          <View style={styles.roundButton} />
        </View>

        <Text style={styles.subtitle}>Pick a channel and we respond fast.</Text>

        <View style={styles.list}>
          {supportItems.map((item) => (
            <View key={item.title} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={LaundryTheme.colors.primary}
                />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
          ))}
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
  subtitle: {
    marginTop: 16,
    color: LaundryTheme.colors.muted,
    fontSize: 14,
  },
  list: {
    marginTop: 14,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LaundryTheme.colors.primarySoft,
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    color: LaundryTheme.colors.ink,
    fontWeight: "800",
    fontSize: 15,
  },
  cardSubtitle: {
    marginTop: 3,
    color: LaundryTheme.colors.muted,
    fontSize: 13,
  },
});
