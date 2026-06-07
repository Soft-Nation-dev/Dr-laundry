import { SoftPressable } from "@/components/soft-pressable";
import { LaundryTheme } from "@/constants/laundry-theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

type DriverTask = {
  id: string;
  type: "pickup" | "delivery";
  customerName: string;
  phoneNumber: string;
  address: string;
  timeSlot: string;
  latitude: number;
  longitude: number;
};

const mockTasks: Record<string, DriverTask> = {
  "TASK-101": {
    id: "TASK-101",
    type: "pickup",
    customerName: "Nnamdi Ezenwachi",
    phoneNumber: "+234 809 341 2278",
    address: "12 Okpara Avenue, Independence Layout, Enugu",
    timeSlot: "Today, 10:00 AM - 12:00 PM",
    latitude: 6.4425,
    longitude: 7.4983,
  },
  "TASK-102": {
    id: "TASK-102",
    type: "delivery",
    customerName: "Adaeze Onyekachi",
    phoneNumber: "+234 812 567 9034",
    address: "8 Ogui Road, New Haven, Enugu",
    timeSlot: "Today, 3:00 PM - 5:00 PM",
    latitude: 6.4561,
    longitude: 7.5094,
  },
  "TASK-103": {
    id: "TASK-103",
    type: "pickup",
    customerName: "Emeka Ugwuanyi",
    phoneNumber: "+234 803 812 6650",
    address: "23 Agbani Road, Uwani, Enugu",
    timeSlot: "Tomorrow, 10:00 AM - 12:00 PM",
    latitude: 6.4198,
    longitude: 7.5042,
  },
};

type TaskStatus = "available" | "accepted" | "arrived" | "completed";

export default function TaskDetailScreen() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const [task, setTask] = useState<DriverTask | null>(null);
  const [status, setStatus] = useState<TaskStatus>("available");

  // Simulated Driver starting point
  const driverStart = {
    latitude: (task?.latitude ?? 6.558) - 0.015,
    longitude: (task?.longitude ?? 3.375) + 0.012,
  };

  useEffect(() => {
    if (taskId && mockTasks[taskId]) {
      setTask(mockTasks[taskId]);
    } else {
      setTask(mockTasks["TASK-101"]); // Fallback
    }
  }, [taskId]);

  if (!task) {
    return null;
  }

  const handleAction = () => {
    if (status === "available") {
      setStatus("accepted");
      Alert.alert("Task Accepted", "Navigate to customer address to proceed.");
    } else if (status === "accepted") {
      setStatus("arrived");
      Alert.alert("Arrived", "Confirm you have reached the customer location.");
    } else if (status === "arrived") {
      setStatus("completed");
      Alert.alert(
        task.type === "pickup" ? "Pickup Confirmed" : "Delivery Confirmed",
        "Task marked as completed successfully."
      );
    }
  };

  const getActionLabel = () => {
    switch (status) {
      case "available":
        return "Accept Task";
      case "accepted":
        return "Arrived at Location";
      case "arrived":
        return task.type === "pickup" ? "Confirm Pickup" : "Confirm Delivery";
      case "completed":
        return "Task Completed";
      default:
        return "Action";
    }
  };

  const handleContact = (type: "call" | "sms") => {
    Alert.alert(
      type === "call" ? "Calling Customer" : "Sending SMS",
      `${type === "call" ? "Dialing" : "Sms to"} ${task.customerName} (${task.phoneNumber})`
    );
  };

  return (
    <LinearGradient
      colors={["#1A103C", "#0D0722", "#050212"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        {/* HEADER */}
        <View style={styles.header}>
          <SoftPressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </SoftPressable>
          <Text style={styles.title}>{task.id}</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>

        {/* MAP ROUTE */}
        <View style={styles.mapFrame}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (driverStart.latitude + task.latitude) / 2,
              longitude: (driverStart.longitude + task.longitude) / 2,
              latitudeDelta: Math.abs(driverStart.latitude - task.latitude) * 2,
              longitudeDelta: Math.abs(driverStart.longitude - task.longitude) * 2,
            }}
          >
            {/* Driver Location */}
            {status !== "completed" && (
              <Marker coordinate={driverStart} title="Your Location">
                <View style={styles.driverMarker}>
                  <Ionicons name="bicycle" size={14} color="#FFF" />
                </View>
              </Marker>
            )}

            {/* Customer Location */}
            <Marker coordinate={{ latitude: task.latitude, longitude: task.longitude }} title="Customer Location">
              <View style={[styles.customerMarker, task.type === "delivery" && styles.customerMarkerDelivery]}>
                <Ionicons name="location" size={14} color="#FFF" />
              </View>
            </Marker>

            {/* Route Line */}
            {status !== "completed" && (
              <Polyline
                coordinates={[driverStart, { latitude: task.latitude, longitude: task.longitude }]}
                strokeColor={LaundryTheme.colors.primary}
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>

        {/* BOTTOM SHEET DETAIL */}
        <View style={styles.detailsSheet}>
          <View style={styles.statusRow}>
            <View style={[styles.typeBadge, task.type === "delivery" && styles.typeBadgeDelivery]}>
              <Text style={styles.typeText}>{task.type.toUpperCase()}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{status.toUpperCase()}</Text>
            </View>
          </View>

          <Text style={styles.customerName}>{task.customerName}</Text>
          <Text style={styles.addressText}>{task.address}</Text>

          <View style={styles.timeRow}>
            <Ionicons name="time" size={16} color="#A79BCE" />
            <Text style={styles.timeText}>{task.timeSlot}</Text>
          </View>

          <View style={styles.divider} />

          {/* CONTACT BUTTONS */}
          {status !== "completed" && (
            <View style={styles.contactRow}>
              <SoftPressable onPress={() => handleContact("call")} style={styles.contactBtn}>
                <Ionicons name="call" size={18} color="#FFFFFF" />
                <Text style={styles.contactBtnText}>Call Customer</Text>
              </SoftPressable>
              <SoftPressable onPress={() => handleContact("sms")} style={styles.contactBtn}>
                <Ionicons name="chatbox-ellipses" size={18} color="#FFFFFF" />
                <Text style={styles.contactBtnText}>Text Message</Text>
              </SoftPressable>
            </View>
          )}

          {/* MAIN ACTION CTA */}
          <SoftPressable
            onPress={status === "completed" ? () => router.back() : handleAction}
            style={[styles.actionCta, status === "completed" && styles.actionCtaCompleted]}
          >
            <Text style={styles.actionCtaText}>
              {status === "completed" ? "Back to Tasks" : getActionLabel()}
            </Text>
          </SoftPressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  backBtnPlaceholder: {
    width: 38,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  mapFrame: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  driverMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LaundryTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  customerMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LaundryTheme.colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  customerMarkerDelivery: {
    backgroundColor: LaundryTheme.colors.success,
  },
  detailsSheet: {
    backgroundColor: "#161030",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
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
  statusBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: "#BCA3FF",
    fontWeight: "800",
    fontSize: 9,
  },
  customerName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  addressText: {
    color: "#D2C5FF",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  timeText: {
    color: "#A79BCE",
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 16,
  },
  contactRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  contactBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  actionCta: {
    backgroundColor: LaundryTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: LaundryTheme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionCtaCompleted: {
    backgroundColor: LaundryTheme.colors.success,
    shadowColor: LaundryTheme.colors.success,
  },
  actionCtaText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});
