import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { LAUNDRY_CATALOG } from "@/constants/pricing";
import { formatNaira } from "@/lib/pricing";
import { CatalogItem } from "@/types/order";

type Props = {
  quantities: Record<string, number>;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onBack: () => void;
  onNext: () => void;
};

const CATEGORIES = [
  { id: "all", label: "All Items" },
  { id: "regular", label: "Regular Garments" },
  { id: "extras", label: "Footwear & Bags" },
];

export function ItemSelectorStep({
  quantities,
  onIncrement,
  onDecrement,
  onBack,
  onNext,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    return LAUNDRY_CATALOG.filter((item: CatalogItem) => {
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesSearch = item.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const totalSelectedCount = useMemo(() => {
    return Object.values(quantities).reduce((acc, qty) => acc + qty, 0);
  }, [quantities]);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={LaundryTheme.colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search garments (e.g. Polo, Suit, Duvet)..."
          placeholderTextColor="#A090C0"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <SoftPressable onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={LaundryTheme.colors.muted} />
          </SoftPressable>
        )}
      </View>

      {/* Category Pills */}
      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <SoftPressable
              key={cat.id}
              onPress={() => setSelectedCategory(cat.id)}
              style={[styles.categoryPill, active && styles.categoryPillActive]}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  active && styles.categoryPillTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </SoftPressable>
          );
        })}
      </View>

      {/* Item Compact Grid */}
      <Text style={styles.sectionHeader}>
        Items ({filteredItems.length})
      </Text>

      {filteredItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="shirt-outline" size={32} color={LaundryTheme.colors.muted} />
          <Text style={styles.emptyText}>No items found matching filter</Text>
        </View>
      ) : (
        <View style={styles.itemGrid}>
          {filteredItems.map((item: CatalogItem) => {
            const count = quantities[item.id] || 0;
            return (
              <View
                key={item.id}
                style={[styles.itemCard, count > 0 && styles.itemCardSelected]}
              >
                <View style={styles.itemMeta}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    {formatNaira(item.basePrice)}
                  </Text>
                </View>

                {/* Counter Stepper */}
                <View style={styles.stepperRow}>
                  {count > 0 && (
                    <SoftPressable
                      onPress={() => onDecrement(item.id)}
                      style={styles.stepBtnMinus}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={LaundryTheme.colors.primaryDark}
                      />
                    </SoftPressable>
                  )}

                  {count > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{count}</Text>
                    </View>
                  )}

                  <SoftPressable
                    onPress={() => onIncrement(item.id)}
                    style={styles.stepBtnPlus}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </SoftPressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Bottom Nav Buttons */}
      <View style={styles.navRow}>
        <SoftPressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={LaundryTheme.colors.ink} />
          <Text style={styles.backBtnText}>Back</Text>
        </SoftPressable>

        <SoftPressable
          onPress={onNext}
          style={[styles.nextBtn, totalSelectedCount === 0 && styles.btnDisabled]}
        >
          <Text style={styles.nextBtnText}>
            Review ({totalSelectedCount} {totalSelectedCount === 1 ? "item" : "items"})
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </SoftPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  searchBar: {
    ...LaundryTheme.glass,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: LaundryTheme.colors.ink,
    fontWeight: "600",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 4,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
  },
  categoryPillActive: {
    backgroundColor: LaundryTheme.colors.primary,
    borderColor: LaundryTheme.colors.primaryDark,
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: LaundryTheme.colors.muted,
  },
  categoryPillTextActive: { color: "#fff" },

  sectionHeader: {
    fontSize: 17,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    color: LaundryTheme.colors.muted,
    fontWeight: "600",
    fontSize: 14,
  },

  itemGrid: { gap: 10 },
  itemCard: {
    ...LaundryTheme.glass,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemCardSelected: {
    borderColor: LaundryTheme.colors.primary,
    backgroundColor: "rgba(237, 233, 254, 0.65)",
  },
  itemMeta: { flex: 1, marginRight: 12, flexShrink: 1 },
  itemName: {
    fontSize: 16,
    fontWeight: "800",
    color: LaundryTheme.colors.ink,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: LaundryTheme.colors.primaryDark,
    marginTop: 2,
    flexShrink: 0,
    lineHeight: 18,
    paddingVertical: 1,
  },

  stepperRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  stepBtnMinus: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: LaundryTheme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPlus: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    fontSize: 18,
    fontWeight: "900",
    color: LaundryTheme.colors.ink,
  },

  navRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  backBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: LaundryTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
  },
  backBtnText: { fontWeight: "800", color: LaundryTheme.colors.ink },
  nextBtn: {
    flex: 2,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: LaundryTheme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...LaundryTheme.shadow.soft,
  },
  nextBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
