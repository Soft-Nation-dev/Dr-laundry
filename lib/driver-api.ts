import { apiRequest, type ApiResponse } from "@/lib/api-client";
import type {
  DriverTaskStatus,
  DriverTaskType,
  OrderLineItem,
  OrderStatus,
} from "@/types/order";

export type DriverTask = {
  id: string;
  orderId: string;
  type: DriverTaskType;
  status: DriverTaskStatus;
  orderStatus: OrderStatus;
  customerName: string;
  phoneNumber: string;
  address: string;
  timeSlot: string;
  scheduledAtISO: string;
  promisedDeliveryISO: string;
  isExpress: boolean;
  paidAmount: number;
  paymentStatus: "pending" | "unpaid" | "paid" | "failed" | "expired";
  paymentMethod: "paystack" | "pay_on_delivery";
  paymentMarkedBy: string | null;
  paymentMarkedByRole: string | null;
  paymentMarkedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  lineItems: OrderLineItem[];
  assignedToMe: boolean;
  availableToDrivers: boolean;
  availableByName: string | null;
  availableByRole: string | null;
  availableAt: string | null;
  cancellationReason: string | null;
  completedAtISO?: string;
};

export type DriverTaskAction = "accept" | "arrive" | "complete";

export function getDriverTasks(): Promise<ApiResponse<DriverTask[]>> {
  return apiRequest<DriverTask[]>("/api/driver/tasks", { auth: true });
}

export function getCompletedDriverTasks(): Promise<ApiResponse<DriverTask[]>> {
  return apiRequest<DriverTask[]>("/api/driver/tasks/completed", { auth: true });
}

export function getDriverTask(
  taskId: string,
  completedType?: DriverTask["type"],
): Promise<ApiResponse<DriverTask>> {
  const suffix = completedType ? `?completedType=${encodeURIComponent(completedType)}` : "";
  return apiRequest<DriverTask>(
    `/api/driver/tasks/${encodeURIComponent(taskId)}${suffix}`,
    { auth: true },
  );
}

export function performDriverTaskAction(
  taskId: string,
  action: DriverTaskAction,
): Promise<ApiResponse<DriverTask>> {
  return apiRequest<DriverTask>(
    `/api/driver/tasks/${encodeURIComponent(taskId)}/action`,
    {
      method: "POST",
      auth: true,
      body: { action },
    },
  );
}

export function markDriverOrderPaid(taskId: string) {
  return apiRequest<{
    orderId: string;
    paymentStatus: "paid";
    markedBy: string;
    markedByRole: string;
    markedAt: string;
  }>(`/api/orders/${encodeURIComponent(taskId)}/mark-paid`, {
    method: "POST",
    auth: true,
  });
}

export function startDriverCustomerContact(taskId: string, action: "call" | "sms") {
  return apiRequest<{ orderId: string; customerName: string; uri: string }>(
    `/api/driver/tasks/${encodeURIComponent(taskId)}/contact`,
    { method: "POST", auth: true, body: { action } },
  );
}
