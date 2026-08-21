import { SoftPressable } from "@/components/soft-pressable";
import { getGarmentImage } from "@/constants/garment-images";
import { LaundryTheme } from "@/constants/laundry-theme";
import { MODE_OPTIONS } from "@/constants/pricing";
import {
  formatNaira,
  formatDateTime,
  getTurnaroundHours,
  getPickupDayLabel,
  getPickupWindowLabel,
  resolvePromisedDeliveryISO,
  roundToNearest,
} from "@/lib/pricing";
import type { OrderDraft, OrderLineItem } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  draft: OrderDraft;
  note: string;
  setNote: (note: string) => void;
  onBack: () => void;
  onProceed: () => void;
};

type ReviewLineItem = OrderLineItem & {
  adjustedUnitPrice: number;
  lineTotal: number;
};

const PREVIEW_POSITIONS = [
  { top: 3, left: 46, transform: [{ rotate: "8deg" }] },
  { top: 37, left: 3, transform: [{ rotate: "-8deg" }] },
  { top: 70, left: 49, transform: [{ rotate: "5deg" }] },
];

export function OrderReviewStep({
  draft,
  note,
  setNote,
  onBack,
  onProceed,
}: Props) {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const reviewLineItems = useMemo<ReviewLineItem[]>(
    () =>
      draft.lineItems.map((item) => {
        const itemMode = item.mode ?? draft.mode;
        const adjustedUnitPrice = roundToNearest(
          item.unitPrice * MODE_OPTIONS[itemMode].multiplier,
        );
        return {
          ...item,
          adjustedUnitPrice,
          lineTotal: adjustedUnitPrice * item.quantity,
        };
      }),
    [draft.lineItems, draft.mode],
  );

  const totalItemsCount = reviewLineItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const isExpress = Boolean(draft.isExpress);
  const estimatedTotal = isExpress
    ? draft.totals.expressTotal
    : draft.totals.standardTotal;

  const pickupLabel = `${getPickupDayLabel(draft.pickupDay)} • ${getPickupWindowLabel(
    draft.pickupWindow,
  )}`;
  const turnaroundHours = draft.turnaroundHours ?? getTurnaroundHours(isExpress);
  const deliveryLabel = `${formatDateTime(
    resolvePromisedDeliveryISO(new Date().toISOString(), isExpress),
  )} • within ${turnaroundHours}h of ordering`;

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
        <View style={styles.headingCopy}>
          <Text style={styles.mainHeading}>Review your order</Text>
          <Text style={styles.headingSubtext}>
            Confirm your garments and schedule before payment
          </Text>
        </View>
        <View style={styles.readyPill}>
          <Ionicons name="checkmark-circle" size={14} color={LaundryTheme.colors.success} />
          <Text style={styles.readyText}>Ready</Text>
        </View>
      </View>

      <LinearGradient
        colors={["#42106F", "#6F26CE", "#8B5CF6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <View style={styles.heroCopy}>
          <View style={styles.heroEyebrowRow}>
            <Ionicons name={isExpress ? "flash" : "sparkles"} size={13} color="#F7D56B" />
            <Text style={styles.heroEyebrow}>
              {isExpress ? "EXPRESS ORDER" : "ORDER OVERVIEW"}
            </Text>
          </View>
          <Text style={styles.heroTitle}>
            {totalItemsCount} {totalItemsCount === 1 ? "garment" : "garments"}
          </Text>
          <Text style={styles.heroSubtext}>
            {reviewLineItems.length} {reviewLineItems.length === 1 ? "item type" : "item types"} • {MODE_OPTIONS[draft.mode].label}
          </Text>
          <Text style={styles.heroTotalLabel}>Estimated total</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            style={styles.heroTotal}
          >
            {formatNaira(estimatedTotal)}
          </Text>
        </View>

        <View style={styles.previewCollage}>
          {reviewLineItems.slice(0, 3).map((item, index) => {
            const imageSource = getGarmentImage(item.id);
            return (
              <View
                key={item.id}
                style={[styles.previewCard, PREVIEW_POSITIONS[index]]}
              >
                {imageSource ? (
                  <Image source={imageSource} style={styles.previewImage} resizeMode="contain" />
                ) : (
                  <Ionicons name="shirt-outline" size={30} color={LaundryTheme.colors.primaryDark} />
                )}
              </View>
            );
          })}
          {reviewLineItems.length > 3 ? (
            <View style={styles.moreBadge}>
              <Text style={styles.moreBadgeText}>+{reviewLineItems.length - 3}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <View style={styles.card}>
        <SectionHeader
          icon="shirt-outline"
          title="Selected garments"
          caption={`${totalItemsCount} ${totalItemsCount === 1 ? "piece" : "pieces"}`}
        />

        <View style={styles.itemList}>
          {reviewLineItems.map((item, index) => {
            const imageSource = getGarmentImage(item.id);
            return (
              <View key={item.id}>
                {index > 0 ? <View style={styles.itemDivider} /> : null}
                <View style={styles.itemRow}>
                  <LinearGradient
                    colors={["#F4ECFF", "#E5D6FF"]}
                    style={styles.itemImageWrap}
                  >
                    {imageSource ? (
                      <Image source={imageSource} style={styles.itemImage} resizeMode="contain" />
                    ) : (
                      <Ionicons name="shirt-outline" size={32} color={LaundryTheme.colors.primaryDark} />
                    )}
                  </LinearGradient>

                  <View style={styles.itemMeta}>
                    <Text numberOfLines={2} style={styles.itemName}>
                      {item.name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      style={styles.itemUnitPrice}
                    >
                      {item.quantity} × {formatNaira(item.adjustedUnitPrice)} / unit
                    </Text>
                  </View>

                  <View style={styles.itemPriceBlock}>
                    <View style={styles.quantityPill}>
                      <Text style={styles.quantityText}>×{item.quantity}</Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                      style={styles.itemTotal}
                    >
                      {formatNaira(item.lineTotal)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <SectionHeader
          icon="calendar-outline"
          title="Schedule & pickup"
          caption={isExpress ? "Express • 24h" : "Standard • 72h"}
        />
        <DetailRow icon="arrow-up-circle-outline" label="Pickup" value={pickupLabel} />
        <DetailRow icon="arrow-down-circle-outline" label="Delivery" value={deliveryLabel} />
        <DetailRow
          icon="location-outline"
          label="Pickup location"
          value={draft.address || "No address selected"}
          multiline
        />
      </View>

      <View style={styles.priceCard}>
        <SectionHeader icon="receipt-outline" title="Price details" />
        <MoneyRow
          label={`${MODE_OPTIONS[draft.mode].label} subtotal`}
          value={draft.totals.modeSubtotal}
        />
        <MoneyRow label="Pickup & delivery" value={draft.totals.pickupDeliveryFee} />
        {isExpress ? (
          <>
            <MoneyRow label="Express priority premium" value={draft.totals.expressPremium} />
            <MoneyRow label="Express delivery" value={draft.totals.expressDeliveryFee} />
          </>
        ) : null}

        <LinearGradient
          colors={["#F2E8FF", "#E9DCFF"]}
          style={styles.totalPanel}
        >
          <View>
            <Text style={styles.totalLabel}>Estimated total</Text>
            <Text style={styles.totalCaption}>Final amount before payment</Text>
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={styles.totalValue}
          >
            {formatNaira(estimatedTotal)}
          </Text>
        </LinearGradient>
      </View>

      <View style={styles.card}>
        <SectionHeader icon="create-outline" title="Special instructions" caption="Optional" />
        <TextInput
          style={styles.noteInput}
          multiline
          numberOfLines={3}
          placeholder="e.g. Delicate silk, extra starch on trousers..."
          placeholderTextColor="#9B8BAD"
          value={note}
          onChangeText={setNote}
          maxLength={240}
        />
        <Text style={styles.characterCount}>{note.length}/240</Text>
      </View>

      <View style={styles.assuranceRow}>
        <View style={styles.assuranceIcon}>
          <Ionicons name="shield-checkmark-outline" size={19} color={LaundryTheme.colors.success} />
        </View>
        <View style={styles.assuranceCopy}>
          <Text style={styles.assuranceTitle}>Carefully checked</Text>
          <Text style={styles.assuranceText}>
            Your garment count, schedule, and pricing are ready for checkout.
          </Text>
        </View>
      </View>

      <View style={styles.navRow}>
        <SoftPressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={LaundryTheme.colors.ink} />
          <Text style={styles.backBtnText}>Edit Items</Text>
        </SoftPressable>

        <SoftPressable onPress={onProceed} style={styles.proceedBtn}>
          <Text style={styles.proceedText}>Proceed to Payment</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </SoftPressable>
      </View>
    </Animated.View>
  );
}

function SectionHeader({
  icon,
  title,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={16} color={LaundryTheme.colors.primaryDark} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  multiline = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={17} color={LaundryTheme.colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text numberOfLines={multiline ? 2 : 1} style={styles.detailValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.moneyRow}>
      <Text numberOfLines={2} style={styles.moneyLabel}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={styles.moneyValue}
      >
        {formatNaira(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 10 },
  headingRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, paddingHorizontal: 4, marginBottom: 2 },
  headingCopy: { flex: 1 },
  mainHeading: { color: LaundryTheme.colors.ink, fontSize: 26, lineHeight: 31, fontWeight: "900", letterSpacing: -0.7 },
  headingSubtext: { marginTop: 4, color: LaundryTheme.colors.muted, fontSize: 11.5, lineHeight: 16, fontWeight: "600" },
  readyPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#E8FAF3" },
  readyText: { color: "#087A58", fontSize: 10.5, fontWeight: "900" },

  heroCard: { minHeight: 194, borderRadius: 26, overflow: "hidden", padding: 20, flexDirection: "row", ...LaundryTheme.shadow.strong },
  heroOrbLarge: { position: "absolute", width: 170, height: 170, borderRadius: 85, right: -65, top: -72, backgroundColor: "rgba(255,255,255,0.08)" },
  heroOrbSmall: { position: "absolute", width: 90, height: 90, borderRadius: 45, left: -38, bottom: -46, backgroundColor: "rgba(255,255,255,0.08)" },
  heroCopy: { flex: 1, zIndex: 2, paddingRight: 8 },
  heroEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroEyebrow: { color: "#F7D56B", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.1 },
  heroTitle: { marginTop: 12, color: "#FFFFFF", fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5 },
  heroSubtext: { marginTop: 4, color: "rgba(255,255,255,0.76)", fontSize: 10.5, lineHeight: 15, fontWeight: "600" },
  heroTotalLabel: { marginTop: 18, color: "rgba(255,255,255,0.65)", fontSize: 9.5, fontWeight: "700" },
  heroTotal: { maxWidth: 165, marginTop: 1, color: "#FFFFFF", fontSize: 23, lineHeight: 30, fontWeight: "900" },
  previewCollage: { width: 116, height: 142, alignSelf: "center", position: "relative" },
  previewCard: { position: "absolute", width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 2, borderColor: "rgba(255,255,255,0.75)", shadowColor: "#21043A", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  previewImage: { width: "88%", height: "88%" },
  moreBadge: { position: "absolute", right: -2, bottom: -2, minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#F7D56B", borderWidth: 2, borderColor: "#FFFFFF" },
  moreBadgeText: { color: LaundryTheme.colors.ink, fontSize: 10, fontWeight: "900" },

  card: { borderRadius: 23, padding: 15, backgroundColor: "rgba(255,255,255,0.91)", borderWidth: 1, borderColor: "rgba(230,220,250,0.8)", ...LaundryTheme.shadow.soft },
  priceCard: { borderRadius: 23, padding: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: LaundryTheme.colors.primarySoft, ...LaundryTheme.shadow.soft },
  sectionHeader: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  sectionTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  cardTitle: { flex: 1, color: LaundryTheme.colors.ink, fontSize: 15.5, lineHeight: 21, fontWeight: "900" },
  sectionCaption: { color: LaundryTheme.colors.primaryDark, fontSize: 10.5, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: LaundryTheme.colors.primarySoft },

  itemList: { borderRadius: 18, overflow: "hidden", backgroundColor: "#FCFAFF", borderWidth: 1, borderColor: "#EEE7F5" },
  itemRow: { minHeight: 86, paddingHorizontal: 10, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10 },
  itemDivider: { height: 1, marginHorizontal: 10, backgroundColor: "#EEE7F5" },
  itemImageWrap: { width: 66, height: 66, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  itemImage: { width: "91%", height: "91%" },
  itemMeta: { flex: 1, minWidth: 0 },
  itemName: { color: LaundryTheme.colors.ink, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  itemUnitPrice: { width: "100%", marginTop: 4, color: LaundryTheme.colors.muted, fontSize: 10.5, lineHeight: 16, fontWeight: "600" },
  itemPriceBlock: { width: 71, alignItems: "flex-end", gap: 5 },
  quantityPill: { minWidth: 28, height: 23, borderRadius: 9, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", backgroundColor: LaundryTheme.colors.primarySoft },
  quantityText: { color: LaundryTheme.colors.primaryDark, fontSize: 10, fontWeight: "900" },
  itemTotal: { width: "100%", minHeight: 21, color: LaundryTheme.colors.ink, fontSize: 13, lineHeight: 19, fontWeight: "900", textAlign: "right", paddingVertical: 1 },

  detailRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F0EAF6" },
  detailIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F2FC" },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: LaundryTheme.colors.muted, fontSize: 9.5, lineHeight: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  detailValue: { marginTop: 2, color: LaundryTheme.colors.ink, fontSize: 12.5, lineHeight: 17, fontWeight: "800" },

  moneyRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: "#F0EAF6" },
  moneyLabel: { flex: 1, color: LaundryTheme.colors.muted, fontSize: 11.5, lineHeight: 16, fontWeight: "600" },
  moneyValue: { width: 96, minHeight: 20, color: LaundryTheme.colors.ink, fontSize: 12.5, lineHeight: 19, fontWeight: "800", textAlign: "right", paddingVertical: 1 },
  totalPanel: { minHeight: 75, marginTop: 8, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  totalLabel: { color: LaundryTheme.colors.ink, fontSize: 14.5, lineHeight: 20, fontWeight: "900" },
  totalCaption: { marginTop: 2, color: LaundryTheme.colors.muted, fontSize: 8.8, lineHeight: 12, fontWeight: "600" },
  totalValue: { maxWidth: 135, minHeight: 30, color: LaundryTheme.colors.primaryDark, fontSize: 21, lineHeight: 29, fontWeight: "900", textAlign: "right", paddingVertical: 1 },

  noteInput: { minHeight: 84, borderRadius: 16, borderWidth: 1, borderColor: LaundryTheme.colors.border, backgroundColor: "#FCFAFF", paddingHorizontal: 13, paddingVertical: 11, color: LaundryTheme.colors.ink, fontSize: 13, lineHeight: 19, textAlignVertical: "top" },
  characterCount: { marginTop: 5, color: LaundryTheme.colors.muted, fontSize: 9.5, fontWeight: "600", textAlign: "right" },
  assuranceRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, padding: 12, backgroundColor: "#EAF9F3", borderWidth: 1, borderColor: "#C8F0E1" },
  assuranceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#D7F5E9" },
  assuranceCopy: { flex: 1 },
  assuranceTitle: { color: "#086649", fontSize: 11.5, fontWeight: "900" },
  assuranceText: { marginTop: 2, color: "#347660", fontSize: 9.5, lineHeight: 14, fontWeight: "600" },

  navRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  backBtn: { flex: 0.85, minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: LaundryTheme.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFFFFF" },
  backBtnText: { color: LaundryTheme.colors.ink, fontSize: 12, fontWeight: "900" },
  proceedBtn: { flex: 1.65, minHeight: 52, borderRadius: 17, paddingHorizontal: 12, backgroundColor: LaundryTheme.colors.primaryDark, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, ...LaundryTheme.shadow.soft },
  proceedText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },
});
