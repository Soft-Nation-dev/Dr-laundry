import { AppToast, type AppToastMessage } from "@/components/app-toast";
import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { getIncomeAnalytics, type IncomeAnalytics, type IncomeView } from "@/lib/admin-api";
import { formatDateTime, formatNaira } from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const now = new Date();

export default function IncomeScreen() {
  const [view, setView] = useState<IncomeView>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<IncomeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<AppToastMessage | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setData(await getIncomeAnalytics({ view, year, month }));
    } catch (error) {
      setToast({ id: Date.now(), title: "Income unavailable", message: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, view, year]);

  useEffect(() => {
    void load();
    const channel = supabase.channel(`admin-income-${view}-${year}-${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, month, view, year]);

  const periodLabel = useMemo(() => view === "year"
    ? String(year)
    : new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }), [month, view, year]);

  const movePeriod = (direction: -1 | 1) => {
    if (view === "year") {
      setYear((value) => value + direction);
      return;
    }
    const next = new Date(Date.UTC(year, month - 1 + direction, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
  };

  return (
    <LinearGradient colors={["#22063F", "#681DA6", "#F8F4FB"]} locations={[0, 0.27, 0.27]} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <SoftPressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></SoftPressable>
          <View style={styles.headerCopy}><Text style={styles.kicker}>BUSINESS OVERVIEW</Text><Text style={styles.title}>Income</Text><Text style={styles.subtitle}>Track revenue and payment activity over time.</Text></View>
        </View>

        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor="#681DA6" />} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.viewSwitch}>
            {(["month", "year"] as IncomeView[]).map((option) => <SoftPressable key={option} onPress={() => setView(option)} style={[styles.viewOption, view === option && styles.viewOptionActive]}><Text style={[styles.viewText, view === option && styles.viewTextActive]}>{option === "month" ? "Monthly" : "Yearly"}</Text></SoftPressable>)}
          </View>
          <View style={styles.periodPicker}>
            <SoftPressable onPress={() => movePeriod(-1)} style={styles.periodButton}><Ionicons name="chevron-back" size={19} color="#5B168F" /></SoftPressable>
            <View style={styles.periodCopy}><Text style={styles.periodEyebrow}>{view === "month" ? "SELECTED MONTH" : "SELECTED YEAR"}</Text><Text style={styles.periodLabel}>{periodLabel}</Text></View>
            <SoftPressable onPress={() => movePeriod(1)} style={styles.periodButton}><Ionicons name="chevron-forward" size={19} color="#5B168F" /></SoftPressable>
          </View>

          {loading ? <ActivityIndicator color="#681DA6" style={styles.loader} /> : data ? <>
            <LinearGradient colors={["#4A0E75", "#8A30C2"]} style={styles.hero}>
              <Text style={styles.heroLabel}>{periodLabel.toUpperCase()} REVENUE</Text>
              <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>{formatNaira(data.period.revenue)}</Text>
              <View style={styles.heroRow}><Text style={styles.heroMeta}>{data.period.payments} verified payment{data.period.payments === 1 ? "" : "s"}</Text><Text style={styles.heroMeta}>All time {formatNaira(data.totals.successfulRevenue)}</Text></View>
            </LinearGradient>

            <View style={styles.metricGrid}>
              <Metric icon="today-outline" label="Today" value={formatNaira(data.totals.todayRevenue)} tint="#087A58" />
              <Metric icon="calendar-outline" label="This month" value={formatNaira(data.totals.monthRevenue)} tint="#5B168F" />
              <Metric icon="time-outline" label="Pending checkout" value={formatNaira(data.totals.pendingCheckoutValue)} tint="#B86B00" />
              <Metric icon="cash-outline" label="Pay on delivery" value={formatNaira(data.totals.unpaidDeliveryValue)} tint="#7A3B98" />
            </View>

            <Text style={styles.section}>{view === "month" ? "Daily movement" : "Monthly movement"}</Text>
            {data.series.length ? data.series.map((entry) => <View key={entry.period} style={styles.seriesRow}><View style={styles.seriesIcon}><Ionicons name="trending-up" size={16} color="#681DA6" /></View><View style={styles.seriesCopy}><Text style={styles.seriesPeriod}>{formatSeriesPeriod(entry.period, view)}</Text><Text style={styles.seriesMeta}>{entry.payments} payment{entry.payments === 1 ? "" : "s"}</Text></View><Text style={styles.seriesValue}>{formatNaira(entry.revenue)}</Text></View>) : <EmptyState text={`No verified income recorded for ${periodLabel}.`} />}

            <Text style={styles.section}>Transaction history</Text>
            {data.history.length ? data.history.map((payment) => <View key={payment.id} style={styles.paymentRow}><View style={styles.paymentIcon}><Ionicons name={payment.paymentMethod === "paystack" ? "card-outline" : "cash-outline"} size={18} color="#681DA6" /></View><View style={styles.paymentCopy}><Text style={styles.order}>#{payment.orderId}</Text><Text style={styles.paymentMeta}>{formatDateTime(payment.occurredAt)} · {payment.paymentMethod === "paystack" ? "Paystack" : "Pay on delivery"}</Text></View><Text style={styles.paymentAmount} adjustsFontSizeToFit numberOfLines={1}>{formatNaira(payment.amount)}</Text></View>) : <EmptyState text="Transactions for this period will appear here." />}
          </> : null}
        </ScrollView>
        <AppToast toast={toast} onDismiss={() => setToast(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

function formatSeriesPeriod(period: string, view: IncomeView) {
  const iso = view === "year" ? `${period}-01T00:00:00Z` : `${period}T00:00:00Z`;
  return new Date(iso).toLocaleDateString("en-NG", view === "year" ? { month: "long", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });
}

function Metric({ icon, label, value, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: string }) {
  return <View style={styles.metric}><View style={[styles.metricIcon, { backgroundColor: `${tint}12` }]}><Ionicons name={icon} size={17} color={tint} /></View><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text></View>;
}

function EmptyState({ text }: { text: string }) {
  return <View style={styles.empty}><Ionicons name="file-tray-outline" size={21} color="#A18DAC" /><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, safe: { flex: 1 }, header: { minHeight: 130, paddingHorizontal: 18, paddingTop: 9, flexDirection: "row", alignItems: "flex-start", gap: 12 }, headerCopy: { flex: 1 }, back: { width: 41, height: 41, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" }, kicker: { color: "#D9BDEB", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 }, title: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 3 }, subtitle: { color: "#DEC9EC", fontSize: 9.5, lineHeight: 14, marginTop: 3, maxWidth: 320 }, content: { minHeight: 690, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 17, paddingBottom: 60, backgroundColor: "#F8F4FB" },
  viewSwitch: { padding: 4, borderRadius: 15, flexDirection: "row", backgroundColor: "#E9DEEF" }, viewOption: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" }, viewOptionActive: { backgroundColor: "#FFFFFF", ...LaundryTheme.shadow.soft }, viewText: { color: "#806E8A", fontSize: 10.5, fontWeight: "900" }, viewTextActive: { color: "#5B168F" },
  periodPicker: { minHeight: 64, marginTop: 10, borderRadius: 18, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECE2F1" }, periodButton: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F3E9FA" }, periodCopy: { flex: 1, alignItems: "center" }, periodEyebrow: { color: "#9989A1", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.8 }, periodLabel: { color: "#3B2B44", fontSize: 13, fontWeight: "900", marginTop: 2 }, loader: { marginTop: 60 },
  hero: { minHeight: 132, borderRadius: 23, padding: 18, marginTop: 12, overflow: "hidden", ...LaundryTheme.shadow.strong }, heroLabel: { color: "#DCC3EE", fontSize: 8.5, fontWeight: "900", letterSpacing: 1.1 }, heroValue: { color: "#FFFFFF", fontSize: 29, fontWeight: "900", marginTop: 6, width: "100%" }, heroRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 13 }, heroMeta: { color: "#E7D7F3", fontSize: 9.5, fontWeight: "800" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 11 }, metric: { width: "48.6%", minHeight: 98, borderRadius: 18, padding: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDE5F1" }, metricIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" }, metricLabel: { color: "#8C7E94", fontSize: 8.8, fontWeight: "800", marginTop: 8 }, metricValue: { width: "100%", fontSize: 14, fontWeight: "900", marginTop: 2 },
  section: { color: "#33263B", fontSize: 17, fontWeight: "900", marginTop: 21, marginBottom: 9 }, seriesRow: { minHeight: 61, borderRadius: 17, paddingHorizontal: 12, marginBottom: 7, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF" }, seriesIcon: { width: 35, height: 35, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1E5FA" }, seriesCopy: { flex: 1, marginLeft: 10 }, seriesPeriod: { color: "#3B2E43", fontSize: 11.5, fontWeight: "900" }, seriesMeta: { color: "#97899F", fontSize: 8.7, marginTop: 2 }, seriesValue: { maxWidth: 110, color: "#087A58", fontSize: 12, fontWeight: "900", textAlign: "right" },
  paymentRow: { minHeight: 70, borderRadius: 18, padding: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FFFFFF" }, paymentIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F1E5FA" }, paymentCopy: { flex: 1 }, order: { color: "#3B2E43", fontSize: 11, fontWeight: "900" }, paymentMeta: { color: "#96899D", fontSize: 8.3, marginTop: 3 }, paymentAmount: { width: 88, color: "#087A58", fontSize: 11.5, fontWeight: "900", textAlign: "right" }, empty: { minHeight: 78, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFFFFF" }, emptyText: { color: "#95889D", fontSize: 9.5, textAlign: "center" },
});
