import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { setAppMode } from "@/lib/app-mode";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

type DriverTask = {
  id: string;
  type: "pickup" | "delivery";
  customerName: string;
  address: string;
  timeSlot: string;
  status: "available" | "accepted" | "completed";
  latitude: number;
  longitude: number;
};

const mockTasks: DriverTask[] = [
  {
    id: "TASK-101",
    type: "pickup",
    customerName: "Nnamdi Ezenwachi",
    address: "12 Okpara Avenue, Independence Layout, Enugu",
    timeSlot: "Today, 10:00 AM - 12:00 PM",
    status: "available",
    latitude: 6.4425,
    longitude: 7.4983,
  },
  {
    id: "TASK-102",
    type: "delivery",
    customerName: "Adaeze Onyekachi",
    address: "8 Ogui Road, New Haven, Enugu",
    timeSlot: "Today, 3:00 PM - 5:00 PM",
    status: "available",
    latitude: 6.4561,
    longitude: 7.5094,
  },
  {
    id: "TASK-103",
    type: "pickup",
    customerName: "Emeka Ugwuanyi",
    address: "23 Agbani Road, Uwani, Enugu",
    timeSlot: "Tomorrow, 10:00 AM - 12:00 PM",
    status: "available",
    latitude: 6.4198,
    longitude: 7.5042,
  },
];

export default function DriverHomeScreen() {
  const [tasks, setTasks] = useState<DriverTask[]>(mockTasks);

  const handleToggleMode = async () => {
    await setAppMode("customer");
    router.replace("/home" as any);
  };

  const handleTaskPress = (taskId: string) => {
    router.push({
      pathname: "/driver/task-detail" as any,
      params: { taskId },
    });
  };

  return (
    <LinearGradient
      colors={["#1A103C", "#0D0722", "#050212"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>Driver Mode</Text>
              <Text style={styles.title}>Available Tasks</Text>
            </View>
            <SoftPressable onPress={handleToggleMode} style={styles.toggleBtn}>
              <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
              <Text style={styles.toggleBtnText}>Customer</Text>
            </SoftPressable>
          </View>

          {/* MAP OVERVIEW */}
          <View style={styles.mapCard}>
            <Text style={styles.mapTitle}>Task Clusters (Ikeja / Yaba)</Text>
            <View style={styles.mapFrame}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: 6.558,
                  longitude: 3.375,
                  latitudeDelta: 0.12,
                  longitudeDelta: 0.12,
                }}
              >
                {tasks.map((task) => (
                  <Marker
                    key={task.id}
                    coordinate={{ latitude: task.latitude, longitude: task.longitude }}
                    title={task.customerName}
                    description={task.type === "pickup" ? "Pickup Task" : "Delivery Task"}
                  >
                    <View style={[styles.marker, task.type === "delivery" && styles.markerDelivery]}>
                      <Ionicons
                        name={task.type === "pickup" ? "log-in" : "log-out"}
                        size={12}
                        color="#fff"
                      />
                    </View>
                  </Marker>
                ))}
              </MapView>
            </View>
          </View>

          {/* TASKS LIST */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Task Queue ({tasks.length})</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Active</Text>
            </View>
          </View>

          <View style={styles.taskList}>
            {tasks.map((task) => (
              <SoftPressable
                key={task.id}
                onPress={() => handleTaskPress(task.id)}
                style={styles.taskCard}
              >
                <View style={styles.taskHeader}>
                  <View style={styles.taskTypeRow}>
                    <View style={[styles.typeBadge, task.type === "delivery" && styles.typeBadgeDelivery]}>
                      <Text style={styles.typeText}>{task.type.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.taskId}>{task.id}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#A79BCE" />
                </View>

                <Text style={styles.customerName}>{task.customerName}</Text>
                <Text style={styles.taskAddress} numberOfLines={2}>
                  {task.address}
                </Text>

                <View style={styles.divider} />

                <View style={styles.taskFooter}>
                  <Ionicons name="time-outline" size={14} color="#A79BCE" />
                  <Text style={styles.timeText}>{task.timeSlot}</Text>
                </View>
              </SoftPressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  kicker: {
    color: "#BCA3FF",
    textTransform: "uppercase",
    fontWeight: "800",
    letterSpacing: 1.6,
    fontSize: 11,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 4,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  toggleBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  mapCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 20,
  },
  mapTitle: {
    color: "#D2C5FF",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 10,
  },
  mapFrame: {
    borderRadius: 14,
    overflow: "hidden",
  },
  map: {
    height: 180,
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerDelivery: {
    backgroundColor: LaundryTheme.colors.success,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  badge: {
    backgroundColor: "#10B981",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 16,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  taskTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeDelivery: {
    backgroundColor: "#10B981",
  },
  typeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
    letterSpacing: 0.6,
  },
  taskId: {
    color: "#A79BCE",
    fontSize: 12,
    fontWeight: "700",
  },
  customerName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  taskAddress: {
    color: "#D2C5FF",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 12,
  },
  taskFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    color: "#A79BCE",
    fontSize: 12,
    fontWeight: "600",
  },
});
