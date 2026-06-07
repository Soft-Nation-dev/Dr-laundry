import StepHeader from "@/components/order/step-header";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { LAUNDRY_CATALOG, MODE_OPTIONS } from "@/constants/pricing";
import { getDraft, saveDraft } from "@/lib/order-draft";
import { calculateTotals, formatNaira } from "@/lib/pricing";
import type { LaundryMode, OrderLineItem } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/* ---------- CONSTANTS ---------- */

const QUICK_ITEMS = ["tshirt","trouser","jean-trouser","bedsheet","jean-jacket"];

const MODE_SHORT_LABELS: Record<LaundryMode, string> = {
  "wash-iron": "Wash + Iron",
  "ironing-only": "Iron only",
  "washing-only": "Wash only",
};

/* ---------- SCREEN ---------- */

export default function NewOrderStep3() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"quick" | "all">("quick");
  const [selected, setSelected] = useState<Record<string, { quantity: number; mode: LaundryMode }>>({});
  const [draftMode, setDraftMode] = useState<LaundryMode>("wash-iron");
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await getDraft();
      if (d?.lineItems) {
        const map: any = {};
        d.lineItems.forEach((li: any) => {
          map[li.id] = {
            quantity: li.quantity,
            mode: li.mode ?? d.mode ?? "wash-iron",
          };
        });
        setSelected(map);
      }
      if (d?.mode) setDraftMode(d.mode);
    })();
  }, []);

  const inc = (id: string) =>
    setSelected((s) => ({
      ...s,
      [id]: {
        quantity: (s[id]?.quantity ?? 0) + 1,
        mode: s[id]?.mode ?? draftMode,
      },
    }));

  const dec = (id: string) =>
    setSelected((s) => ({
      ...s,
      [id]: {
        quantity: Math.max(0, (s[id]?.quantity ?? 0) - 1),
        mode: s[id]?.mode ?? draftMode,
      },
    }));

  const setItemMode = (id: string, mode: LaundryMode) =>
    setSelected((s) => ({
      ...s,
      [id]: { quantity: s[id]?.quantity ?? 1, mode },
    }));

  const handleContinue = async () => {
    const lineItems = buildLineItems(selected);
    const totals = calculateTotals(lineItems, draftMode);
    await saveDraft({ lineItems, totals });
    router.push("/payment");
  };

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    const base =
      tab === "quick"
        ? LAUNDRY_CATALOG.filter((c) => QUICK_ITEMS.includes(c.id))
        : LAUNDRY_CATALOG;

    return base.filter((c) => c.name.toLowerCase().includes(lower));
  }, [query, tab]);

  const selectedPieces = useMemo(
    () => Object.values(selected).reduce((sum, i) => sum + i.quantity, 0),
    [selected]
  );

  const previewTotals = useMemo(
    () => calculateTotals(buildLineItems(selected), draftMode),
    [selected, draftMode]
  );

  const canContinue = selectedPieces > 0;

  return (
    <SafeAreaView style={styles.container}>

      <StepHeader title="Select items" subtitle="Build your basket" step={3} />

      {/* SEARCH */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={LaundryTheme.colors.muted} />
        <TextInput
          placeholder="Search items"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          placeholderTextColor={LaundryTheme.colors.muted}
        />
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        {["quick", "all"].map((t) => (
          <SoftPressable
            key={t}
            onPress={() => setTab(t as any)}
            style={[styles.tabBtn, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "quick" ? "Quick" : "All"}
            </Text>
          </SoftPressable>
        ))}
      </View>

      {/* LIST */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        renderItem={({ item }) => {
          const sel = selected[item.id] ?? { quantity: 0, mode: draftMode };

          return (
            <View style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.price}>{formatNaira(item.basePrice)}</Text>
              </View>

              {/* MODE */}
              <View style={styles.modeRow}>
                {(Object.keys(MODE_OPTIONS) as LaundryMode[]).map((m) => (
                  <SoftPressable
                    key={m}
                    onPress={() => setItemMode(item.id, m)}
                    style={[
                      styles.modeChip,
                      sel.mode === m && styles.modeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeText,
                        sel.mode === m && styles.modeTextActive,
                      ]}
                    >
                      {MODE_SHORT_LABELS[m]}
                    </Text>
                  </SoftPressable>
                ))}
              </View>

              {/* QTY */}
              <View style={styles.qtyRow}>
                <SoftPressable onPress={() => dec(item.id)} style={styles.stepper}>
                  <Ionicons name="remove" size={14} />
                </SoftPressable>

                <Text style={styles.qty}>{sel.quantity}</Text>

                <SoftPressable onPress={() => inc(item.id)} style={styles.stepper}>
                  <Ionicons name="add" size={14} />
                </SoftPressable>
              </View>
            </View>
          );
        }}
      />

      {/* SUMMARY */}
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>{selectedPieces} items</Text>
          <Text style={styles.summaryPrice}>
            {formatNaira(previewTotals.standardTotal)}
          </Text>
        </View>

        <SoftPressable
          onPress={handleContinue}
          style={[styles.cta, !canContinue && { opacity: 0.5 }]}
          disabled={!canContinue}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </SoftPressable>
      </View>

    </SafeAreaView>
  );
}

/* ---------- HELPERS ---------- */

function buildLineItems(selected: any): OrderLineItem[] {
  return Object.entries(selected)
    .filter(([, item]: any) => item.quantity > 0)
    .map(([id, item]: any) => {
      const c = LAUNDRY_CATALOG.find((x) => x.id === id)!;
      return {
        id: c.id,
        name: c.name,
        unitPrice: c.basePrice,
        quantity: item.quantity,
        category: c.category,
        mode: item.mode,
      };
    });
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: LaundryTheme.colors.bgStart,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 10,
  },

  tabRow: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 8,
  },

  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
  },

  tabActive: {
    backgroundColor: LaundryTheme.colors.primarySoft,
  },

  tabText: {
    fontWeight: "700",
    color: LaundryTheme.colors.muted,
  },

  tabTextActive: {
    color: LaundryTheme.colors.primaryDark,
  },

  row: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  itemName: {
    fontWeight: "700",
    color: LaundryTheme.colors.ink,
  },

  price: {
    fontWeight: "700",
    color: LaundryTheme.colors.primaryDark,
  },

  modeRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 6,
  },

  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F5F5F5",
  },

  modeChipActive: {
    backgroundColor: LaundryTheme.colors.primarySoft,
  },

  modeText: {
    fontSize: 11,
    color: LaundryTheme.colors.muted,
  },

  modeTextActive: {
    color: LaundryTheme.colors.primaryDark,
    fontWeight: "700",
  },

  qtyRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },

  stepper: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#F2F2F2",
    alignItems: "center",
    justifyContent: "center",
  },

  qty: {
    width: 24,
    textAlign: "center",
    fontWeight: "700",
  },

  summary: {
    marginBottom: LaundryTheme.layout.bottomMenuSpace - 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
  },

  summaryLabel: {
    color: LaundryTheme.colors.muted,
    fontWeight: "600",
  },

  summaryPrice: {
    fontWeight: "800",
    color: LaundryTheme.colors.primaryDark,
    fontSize: 18,
  },

  cta: {
    backgroundColor: LaundryTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },

  ctaText: {
    color: "#fff",
    fontWeight: "800",
  },
});