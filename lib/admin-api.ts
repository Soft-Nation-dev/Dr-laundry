import { supabase } from "@/lib/supabase-client";
import { apiRequest } from "@/lib/api-client";
import type { AppRole } from "@/types/profile";
import type { OrderStatus, PaymentMethod } from "@/types/order";

export type AdminOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type AdminOrder = {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  locationAvailable: boolean;
  status: OrderStatus;
  isExpress: boolean;
  paidAmount: number;
  paymentStatus: string;
  paymentMethod: "paystack" | "pay_on_delivery";
  paymentMarkedByRole?: string;
  paymentMarkedAt?: string;
  createdAt: string;
  promisedDeliveryAt: string;
  driverId?: string;
  driverTaskStatus?: string;
  availableToDrivers: boolean;
  availabilitySource?: "auto" | "staff";
  availableAt?: string;
  availableByName?: string;
  availableByRole?: "system" | "admin" | "superadmin";
  cancellationReason?: string;
  cancelledByName?: string;
  cancelledByRole?: "system" | "admin" | "superadmin";
  sharedPickupOrderId?: string;
  sharedPickupDiscount: number;
  isReviewOrder: boolean;
  items: AdminOrderItem[];
};

export type StaffOrderAction = "make_available" | "cancel" | "unassign_driver" | "ready_for_delivery";

export type ManagedProfile = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: AppRole;
  createdAt: string;
};

export type LocationAnalytics = {
  totals: { uniqueCustomers: number; mappedOrders: number; mappedLocations: number; clusterRadiusKm: number };
  locations: {
    placeId: string | null;
    label: string;
    latitude: number | null;
    longitude: number | null;
    customerCount: number;
    orderCount: number;
    paidRevenue: number;
    lastOrderAt: string;
    heatScore: number;
    radiusKm: number;
  }[];
};

export type IncomeView = "month" | "year";

export type IncomeAnalytics = {
  totals: {
    successfulRevenue: number;
    pendingCheckoutValue: number;
    unpaidDeliveryValue: number;
    todayRevenue: number;
    monthRevenue: number;
    successfulPayments: number;
    pendingPayments: number;
    unpaidDeliveryOrders: number;
    cancelledOrders: number;
  };
  view: IncomeView;
  year: number;
  month: number;
  period: { from: string; to: string; revenue: number; payments: number };
  series: { period: string; revenue: number; payments: number }[];
  history: {
    id: number;
    orderId: string;
    amount: number;
    occurredAt: string;
    paymentMethod: PaymentMethod;
    source: string;
    actorRole: string;
  }[];
  availableYears: number[];
};

export async function getLocationAnalytics(): Promise<LocationAnalytics> {
  const response = await apiRequest<LocationAnalytics>("/api/admin/analytics/locations", { auth: true });
  if (!response.success || !response.data) throw new Error(response.message || "Location analytics could not be loaded");
  return response.data;
}

export async function getIncomeAnalytics(input: { view: IncomeView; year: number; month: number }): Promise<IncomeAnalytics> {
  const params = new URLSearchParams({
    view: input.view,
    year: String(input.year),
    month: String(input.month),
  });
  const response = await apiRequest<IncomeAnalytics>(`/api/admin/analytics/income?${params}`, { auth: true });
  if (!response.success || !response.data) throw new Error(response.message || "Income analytics could not be loaded");
  return response.data;
}

export async function getAdminOrders(): Promise<AdminOrder[]> {
  const { data: orderRows, error } = await supabase
    .from("orders")
    .select("id,user_id,address,latitude,longitude,status,is_express,paid_amount,payment_status,payment_method,payment_marked_by_role,payment_marked_at,created_at,promised_delivery_at,driver_id,driver_task_status,available_to_drivers,availability_source,available_at,available_by_name,available_by_role,cancellation_reason,cancelled_by_name,cancelled_by_role,shared_pickup_order_id,shared_pickup_discount,is_review_order,order_items(name,quantity,unit_price)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const userIds = [...new Set((orderRows ?? []).map((row: any) => row.user_id).filter(Boolean))];
  const profilesById = new Map<string, any>();
  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id,name,email,phone_number")
      .in("id", userIds);
    if (profileError) throw new Error(profileError.message);
    (profiles ?? []).forEach((profile: any) => profilesById.set(profile.id, profile));
  }

  return (orderRows ?? []).map((row: any) => {
    const profile = profilesById.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      customerName: profile?.name || "Customer",
      customerEmail: profile?.email || "",
      customerPhone: profile?.phone_number || "",
      address: row.address || "",
      locationAvailable: Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)),
      status: row.status,
      isExpress: !!row.is_express,
      paidAmount: Number(row.paid_amount || 0),
      paymentStatus: row.payment_status || "pending",
      paymentMethod: row.payment_method || "paystack",
      paymentMarkedByRole: row.payment_marked_by_role || undefined,
      paymentMarkedAt: row.payment_marked_at || undefined,
      createdAt: row.created_at,
      promisedDeliveryAt: row.promised_delivery_at,
      driverId: row.driver_id || undefined,
      driverTaskStatus: row.driver_task_status || undefined,
      availableToDrivers: Boolean(row.available_to_drivers),
      availabilitySource: row.availability_source || undefined,
      availableAt: row.available_at || undefined,
      availableByName: row.available_by_name || undefined,
      availableByRole: row.available_by_role || undefined,
      cancellationReason: row.cancellation_reason || undefined,
      cancelledByName: row.cancelled_by_name || undefined,
      cancelledByRole: row.cancelled_by_role || undefined,
      sharedPickupOrderId: row.shared_pickup_order_id || undefined,
      sharedPickupDiscount: Number(row.shared_pickup_discount || 0),
      isReviewOrder: Boolean(row.is_review_order),
      items: (row.order_items ?? []).map((item: any) => ({
        name: item.name,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
      })),
    } satisfies AdminOrder;
  });
}

export async function createReviewOrder(): Promise<string> {
  const { data, error } = await supabase.rpc("create_review_order");
  if (error) throw new Error(error.message || "The review workflow could not be created");
  if (typeof data !== "string" || !data) throw new Error("The review order ID was not returned");
  return data;
}

export async function markAdminOrderPaid(orderId: string): Promise<void> {
  const response = await apiRequest(`/api/orders/${encodeURIComponent(orderId)}/mark-paid`, {
    method: "POST",
    auth: true,
  });
  if (!response.success) throw new Error(response.message || "Payment could not be recorded");
}

export async function performAdminOrderAction(
  orderId: string,
  action: StaffOrderAction,
  reason = "",
): Promise<void> {
  const response = await apiRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/action`, {
    method: "POST",
    auth: true,
    body: { action, reason },
  });
  if (!response.success) throw new Error(response.message || "Order could not be updated");
}

export async function getManagedProfiles(): Promise<ManagedProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,email,phone_number,role,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name || "Unnamed account",
    email: row.email || "",
    phoneNumber: row.phone_number || "",
    role: (["driver", "admin", "superadmin"] as string[]).includes(row.role) ? row.role : "customer",
    createdAt: row.created_at,
  }));
}

export async function updateManagedProfileRole(profileId: string, role: AppRole): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}
