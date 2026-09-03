import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { GARMENT_IMAGES } from "@/constants/garment-images";
import { LAUNDRY_CATALOG } from "@/constants/pricing";
import { formatNaira } from "@/lib/pricing";
import type { CatalogItem, CatalogItemCategory } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  quantities: Record<string, number>;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
};

type CategoryFilter = "all" | CatalogItemCategory;

type SmartGroup = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
  itemIds: string[];
};

const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All Items" },
  { id: "regular", label: "Regular" },
  { id: "extras", label: "Footwear & Bags" },
];

const SMART_GROUPS: SmartGroup[] = [
  {
    id: "tops",
    label: "Tops",
    icon: "shirt-outline",
    colors: ["#F2E9FF", "#E4D4FF"],
    itemIds: ["polo", "long-sleeved-shirt"],
  },
  {
    id: "bottoms",
    label: "Bottoms",
    icon: "body-outline",
    colors: ["#EAF2FF", "#D7E6FF"],
    itemIds: ["trouser", "shorts", "skirt", "wrapper"],
  },
  {
    id: "sets",
    label: "Sets & Occasion Wear",
    icon: "sparkles-outline",
    colors: ["#FFF0E3", "#FFE0C1"],
    itemIds: [
      "up-and-down",
      "overall",
      "jean-overall",
      "full-suit",
      "gown",
      "jalabia",
      "agbada",
      "ceremonial-gown",
    ],
  },
  {
    id: "home",
    label: "Home & Bedding",
    icon: "bed-outline",
    colors: ["#E8FAF5", "#CFF4E8"],
    itemIds: ["duvet", "blanket", "bedsheet", "towel", "curtains", "foot-mat"],
  },
  {
    id: "accessories",
    label: "Small Items",
    icon: "albums-outline",
    colors: ["#FFF7DA", "#FFEDAF"],
    itemIds: ["underwear", "socks-caps"],
  },
  {
    id: "footwear",
    label: "Footwear & Bags",
    icon: "bag-handle-outline",
    colors: ["#FCE9F1", "#F8D5E4"],
    itemIds: ["slippers-palms", "shoe-canvas", "bags"],
  },
];

const ITEM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  polo: "shirt-outline",
  "long-sleeved-shirt": "shirt-outline",
  underwear: "layers-outline",
  shorts: "body-outline",
  skirt: "woman-outline",
  trouser: "body-outline",
  "up-and-down": "layers-outline",
  overall: "accessibility-outline",
  "jean-overall": "accessibility-outline",
  duvet: "bed-outline",
  blanket: "bed-outline",
  "full-suit": "business-outline",
  gown: "woman-outline",
  bedsheet: "bed-outline",
  wrapper: "reader-outline",
  jalabia: "person-outline",
  "socks-caps": "ellipse-outline",
  agbada: "person-outline",
  towel: "water-outline",
  curtains: "home-outline",
  "ceremonial-gown": "ribbon-outline",
  "foot-mat": "grid-outline",
  "slippers-palms": "footsteps-outline",
  "shoe-canvas": "footsteps-outline",
  bags: "bag-handle-outline",
};

export function ItemSelectorStep({
  quantities,
  onIncrement,
  onDecrement,
}: Props) {
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return LAUNDRY_CATALOG.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch =
        !normalizedQuery ||
        item.name.toLocaleLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const groupedItems = useMemo(() => {
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    return SMART_GROUPS.map((group) => ({
      ...group,
      items: group.itemIds
        .filter((id) => visibleIds.has(id))
        .map((id) => LAUNDRY_CATALOG.find((item) => item.id === id))
        .filter((item): item is CatalogItem => Boolean(item)),
    })).filter((group) => group.items.length > 0);
  }, [filteredItems]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.mainHeading}>Select Garments</Text>
          <Text style={styles.headingSubtext}>Add everything in your laundry bag</Text>
        </View>
        <View style={styles.itemCountPill}>
          <Text style={styles.itemCountText}>{filteredItems.length} items</Text>
        </View>
      </View>

      <View style={styles.catalogCard}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={21} color={LaundryTheme.colors.ink} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search garments (e.g. Polo, Suit)..."
            placeholderTextColor="#9B8BAD"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery ? (
            <SoftPressable
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
              accessibilityLabel="Clear garment search"
            >
              <Ionicons name="close" size={15} color={LaundryTheme.colors.muted} />
            </SoftPressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORY_FILTERS.map((category) => {
            const active = selectedCategory === category.id;
            return (
              <SoftPressable
                key={category.id}
                onPress={() => setSelectedCategory(category.id)}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    active && styles.categoryPillTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </SoftPressable>
            );
          })}
        </ScrollView>

        {groupedItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={28} color={LaundryTheme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No garments found</Text>
            <Text style={styles.emptyText}>Try another name or category.</Text>
          </View>
        ) : (
          groupedItems.map((group) => (
            <View key={group.id} style={styles.groupSection}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleWrap}>
                  <View style={styles.groupIcon}>
                    <Ionicons name={group.icon} size={15} color={LaundryTheme.colors.primaryDark} />
                  </View>
                  <Text style={styles.groupTitle}>{group.label}</Text>
                </View>
                <Text style={styles.groupCount}>{group.items.length}</Text>
              </View>

              <View style={styles.itemGrid}>
                {group.items.map((item) => (
                  <GarmentCard
                    key={item.id}
                    item={item}
                    count={quantities[item.id] || 0}
                    colors={group.colors}
                    onIncrement={onIncrement}
                    onDecrement={onDecrement}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </View>
    </Animated.View>
  );
}

const GarmentCard = React.memo(function GarmentCard({
  item,
  count,
  colors,
  onIncrement,
  onDecrement,
}: {
  item: CatalogItem;
  count: number;
  colors: readonly [string, string];
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
}) {
  const imageSource = GARMENT_IMAGES[item.id];

  return (
    <View style={[styles.itemCard, count > 0 && styles.itemCardSelected]}>
      {count > 0 ? (
        <View style={styles.selectedBadge}>
          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
        </View>
      ) : null}

      <LinearGradient colors={colors} style={styles.garmentVisual}>
        <View style={styles.visualGlow} />
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.garmentImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        ) : (
          <>
            <Ionicons
              name={ITEM_ICONS[item.id] || "shirt-outline"}
              size={43}
              color={LaundryTheme.colors.primaryDark}
            />
            <View style={styles.placeholderTag}>
              <Text style={styles.placeholderText}>IMAGE</Text>
            </View>
          </>
        )}
      </LinearGradient>

      <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.84}
        style={styles.itemPrice}
      >
        {formatNaira(item.basePrice)}
        <Text style={styles.unitText}> / unit</Text>
      </Text>

      <View style={styles.stepperRow}>
        <SoftPressable
          onPress={() => onDecrement(item.id)}
          disabled={count === 0}
          style={[styles.stepButton, count === 0 && styles.stepButtonDisabled]}
          accessibilityLabel={`Remove one ${item.name}`}
        >
          <Ionicons
            name="remove"
            size={18}
            color={count === 0 ? "#B8AEC8" : LaundryTheme.colors.primaryDark}
          />
        </SoftPressable>

        <Text style={[styles.quantity, count > 0 && styles.quantitySelected]}>
          {count}
        </Text>

        <SoftPressable
          onPress={() => onIncrement(item.id)}
          style={[styles.stepButton, styles.stepButtonPlus]}
          accessibilityLabel={`Add one ${item.name}`}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
        </SoftPressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { paddingBottom: 8 },
  headingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, paddingHorizontal: 4, marginBottom: 14 },
  mainHeading: { fontSize: 26, lineHeight: 31, fontWeight: "900", color: LaundryTheme.colors.ink, letterSpacing: -0.7 },
  headingSubtext: { marginTop: 4, color: LaundryTheme.colors.muted, fontSize: 11.5, fontWeight: "600" },
  itemCountPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: LaundryTheme.colors.primarySoft },
  itemCountText: { color: LaundryTheme.colors.primaryDark, fontSize: 10.5, fontWeight: "900" },
  catalogCard: { borderRadius: 26, paddingVertical: 16, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(230,220,250,0.72)", ...LaundryTheme.shadow.soft },
  searchBar: { marginHorizontal: 16, minHeight: 52, borderRadius: 17, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFFFFF", borderWidth: 1.2, borderColor: "#D9D2E3" },
  searchInput: { flex: 1, color: LaundryTheme.colors.ink, fontSize: 14, fontWeight: "600", paddingVertical: 11 },
  clearButton: { width: 27, height: 27, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F2EDF8" },
  categoryRow: { gap: 8, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 4 },
  categoryPill: { minHeight: 38, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCD4E6" },
  categoryPillActive: { backgroundColor: LaundryTheme.colors.primaryDark, borderColor: LaundryTheme.colors.primaryDark, ...LaundryTheme.shadow.soft },
  categoryPillText: { color: LaundryTheme.colors.ink, fontSize: 12.5, fontWeight: "800" },
  categoryPillTextActive: { color: "#FFFFFF" },
  groupSection: { marginTop: 17, paddingHorizontal: 13 },
  groupHeader: { marginBottom: 9, paddingHorizontal: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupTitleWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  groupIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  groupTitle: { color: LaundryTheme.colors.ink, fontSize: 14, fontWeight: "900" },
  groupCount: { color: LaundryTheme.colors.muted, fontSize: 10.5, fontWeight: "800" },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 11 },
  itemCard: { position: "relative", width: "48.4%", minHeight: 238, padding: 10, borderRadius: 21, alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1.2, borderColor: "#ECE5F4", ...LaundryTheme.shadow.soft },
  itemCardSelected: { borderColor: LaundryTheme.colors.primary, backgroundColor: "#FDFBFF" },
  selectedBadge: { position: "absolute", zIndex: 3, right: 8, top: 8, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primary },
  garmentVisual: { width: "100%", height: 92, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  garmentImage: { width: "94%", height: "94%" },
  visualGlow: { position: "absolute", width: 74, height: 74, borderRadius: 37, backgroundColor: "rgba(255,255,255,0.42)" },
  placeholderTag: { position: "absolute", right: 6, bottom: 6, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: "rgba(255,255,255,0.72)" },
  placeholderText: { color: LaundryTheme.colors.muted, fontSize: 6.5, fontWeight: "900", letterSpacing: 0.6 },
  itemName: { minHeight: 38, marginTop: 10, color: LaundryTheme.colors.ink, fontSize: 13.5, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  itemPrice: { width: "100%", minHeight: 22, color: LaundryTheme.colors.primaryDark, fontSize: 13.5, lineHeight: 20, fontWeight: "900", textAlign: "center", paddingVertical: 1 },
  unitText: { color: LaundryTheme.colors.muted, fontSize: 10, fontWeight: "600" },
  stepperRow: { alignSelf: "stretch", marginTop: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepButton: { width: 38, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1.4, borderColor: LaundryTheme.colors.primaryDark },
  stepButtonDisabled: { borderColor: "#D9D1E3", backgroundColor: "#F7F4FA" },
  stepButtonPlus: { borderColor: LaundryTheme.colors.primaryDark, backgroundColor: LaundryTheme.colors.primaryDark },
  quantity: { minWidth: 26, color: LaundryTheme.colors.muted, fontSize: 17, fontWeight: "800", textAlign: "center" },
  quantitySelected: { color: LaundryTheme.colors.ink, fontWeight: "900" },
  emptyWrap: { margin: 16, paddingVertical: 34, alignItems: "center", borderRadius: 20, backgroundColor: "#FAF7FE" },
  emptyIcon: { width: 56, height: 56, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  emptyTitle: { marginTop: 11, color: LaundryTheme.colors.ink, fontSize: 15, fontWeight: "900" },
  emptyText: { marginTop: 4, color: LaundryTheme.colors.muted, fontSize: 11.5 },
});
