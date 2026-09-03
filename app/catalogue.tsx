import { SoftPressable } from "@/components/soft-pressable";
import { GARMENT_IMAGES } from "@/constants/garment-images";
import { LaundryTheme } from "@/constants/laundry-theme";
import { LAUNDRY_CATALOG } from "@/constants/pricing";
import { formatNaira } from "@/lib/pricing";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CatalogueScreen() {
  return (
    <LinearGradient colors={["#F4EEFC", "#FFFFFF", "#E9E0F8"]} style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <SoftPressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={21} color={LaundryTheme.colors.ink} />
          </SoftPressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DR LAUNDRY PRICE GUIDE</Text>
            <Text style={styles.title}>Garment catalogue</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{LAUNDRY_CATALOG.length}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["#3E0A6C", "#6C22B8"]} style={styles.hero}>
            <View style={styles.heroOrb} />
            <Ionicons name="sparkles" size={18} color="#F3D26D" />
            <Text style={styles.heroTitle}>Clear prices. Beautiful care.</Text>
            <Text style={styles.heroBody}>
              Prices shown are for Washing + Ironing per unit. Your exact mode and order total are confirmed before checkout.
            </Text>
          </LinearGradient>

          <View style={styles.grid}>
            {LAUNDRY_CATALOG.map((item) => (
              <View key={item.id} style={styles.card}>
                <LinearGradient colors={["#F2E9FF", "#E4D4FF"]} style={styles.imageWrap}>
                  <Image source={GARMENT_IMAGES[item.id]} style={styles.image} contentFit="contain" />
                </LinearGradient>
                <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.price}>
                  {formatNaira(item.basePrice)}
                  <Text style={styles.unit}> / unit</Text>
                </Text>
              </View>
            ))}
          </View>

          <SoftPressable onPress={() => router.push("/new-order")} style={styles.bookButton}>
            <Ionicons name="bag-add-outline" size={19} color="#FFFFFF" />
            <Text style={styles.bookText}>Build an order</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </SoftPressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  header: { minHeight: 70, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 11 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft },
  headerCopy: { flex: 1 },
  eyebrow: { color: LaundryTheme.colors.primary, fontSize: 8.5, fontWeight: "900", letterSpacing: 1.1 },
  title: { marginTop: 2, color: LaundryTheme.colors.ink, fontSize: 23, fontWeight: "900", letterSpacing: -0.5 },
  countPill: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  countText: { color: LaundryTheme.colors.primaryDark, fontSize: 14, fontWeight: "900" },
  content: { paddingHorizontal: 16, paddingBottom: LaundryTheme.layout.bottomMenuSpace + 28 },
  hero: { minHeight: 150, marginTop: 8, marginBottom: 16, borderRadius: 25, padding: 20, overflow: "hidden", justifyContent: "center", ...LaundryTheme.shadow.strong },
  heroOrb: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -55, top: -80, backgroundColor: "rgba(255,255,255,0.08)" },
  heroTitle: { marginTop: 9, color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  heroBody: { maxWidth: 310, marginTop: 6, color: "rgba(255,255,255,0.76)", fontSize: 11.5, lineHeight: 17, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 11 },
  card: { width: "48.4%", minHeight: 205, borderRadius: 20, padding: 10, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECE5F4", ...LaundryTheme.shadow.soft },
  imageWrap: { width: "100%", height: 105, borderRadius: 15, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  image: { width: "92%", height: "92%" },
  itemName: { minHeight: 38, marginTop: 9, color: LaundryTheme.colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  price: { width: "100%", color: LaundryTheme.colors.primaryDark, fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "center" },
  unit: { color: LaundryTheme.colors.muted, fontSize: 10, fontWeight: "600" },
  bookButton: { minHeight: 54, marginTop: 18, borderRadius: 18, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, backgroundColor: LaundryTheme.colors.primaryDark, ...LaundryTheme.shadow.strong },
  bookText: { flex: 1, color: "#FFFFFF", fontSize: 13.5, fontWeight: "900", textAlign: "center" },
});
