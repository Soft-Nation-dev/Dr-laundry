import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  calculateTotals,
  getTurnaroundHours,
} from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import {
  CatalogItemCategory,
  LaundryMode,
  OrderLineItem,
  OrderRecord,
  OrderStatus,
  PickupDayCode,
  PickupWindowCode,
  DriverTaskStatus,
  DriverTaskType,
  PaymentMethod,
  PaymentStatus,
} from "@/types/order";

const ORDERS_STORAGE_KEY = "dr-laundry-orders-v1";

type OrderRow = {
  id: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  mode: LaundryMode;
  pickup_day: PickupDayCode;
  pickup_window: PickupWindowCode;
  delivery_day: PickupDayCode | null;
  delivery_window: PickupWindowCode | null;
  pickup_at: string;
  delivery_at: string | null;
  promised_delivery_at: string;
  actual_delivery_at: string | null;
  is_express: boolean;
  turnaround_hours: 24 | 72;
  status: OrderStatus;
  paid_amount: number | string;
  created_at: string;
  driver_id: string | null;
  driver_task_type: DriverTaskType | null;
  driver_task_status: DriverTaskStatus | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_marked_by: string | null;
  payment_marked_by_role: string | null;
  payment_marked_at: string | null;
  order_items?: {
    item_id: string;
    name: string;
    unit_price: number | string;
    quantity: number;
    category: CatalogItemCategory;
    mode?: LaundryMode | null;
  }[];
};

function parseOrders(raw: string | null): OrderRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OrderRecord[]) : [];
  } catch {
    return [];
  }
}

async function readCachedOrders(): Promise<OrderRecord[]> {
  return parseOrders(await AsyncStorage.getItem(ORDERS_STORAGE_KEY));
}

async function writeOrders(orders: OrderRecord[]): Promise<void> {
  await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

function mapOrderRow(row: OrderRow): OrderRecord {
  const lineItems: OrderLineItem[] = (row.order_items ?? []).map((item) => ({
    id: item.item_id,
    name: item.name,
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
    category: item.category,
    mode: item.mode ?? undefined,
  }));

  return {
    id: row.id,
    address: row.address,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    note: row.note ?? "",
    mode: row.mode,
    pickupDay: row.pickup_day,
    pickupWindow: row.pickup_window,
    deliveryDay: row.delivery_day ?? undefined,
    deliveryWindow: row.delivery_window ?? undefined,
    lineItems,
    totals: calculateTotals(lineItems, row.mode),
    createdAtISO: row.created_at,
    pickupAtISO: row.pickup_at,
    deliveryAtISO: row.delivery_at ?? undefined,
    promisedDeliveryISO: row.promised_delivery_at,
    actualDeliveryISO: row.actual_delivery_at ?? undefined,
    isExpress: row.is_express,
    turnaroundHours: row.turnaround_hours ?? getTurnaroundHours(row.is_express),
    status: row.status,
    paidAmount: Number(row.paid_amount),
    driverId: row.driver_id ?? undefined,
    driverTaskType: row.driver_task_type ?? undefined,
    driverTaskStatus: row.driver_task_status ?? undefined,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentMarkedBy: row.payment_marked_by ?? undefined,
    paymentMarkedByRole: row.payment_marked_by_role ?? undefined,
    paymentMarkedAt: row.payment_marked_at ?? undefined,
  };
}

export async function getOrders(): Promise<OrderRecord[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return readCachedOrders();

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(item_id,name,unit_price,quantity,category,mode)")
    .eq("user_id", user.id)
    .in("payment_status", ["paid", "unpaid"])
    .order("created_at", { ascending: false });

  if (error) {
    const cached = await readCachedOrders();
    if (cached.length > 0) return cached;
    throw new Error(error.message);
  }

  const orders = ((data ?? []) as OrderRow[]).map(mapOrderRow);
  await writeOrders(orders);
  return orders;
}

export async function getOrderById(orderId: string): Promise<OrderRecord | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(item_id,name,unit_price,quantity,category,mode)")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .in("payment_status", ["paid", "unpaid"])
      .maybeSingle();
    if (!error && data) return mapOrderRow(data as OrderRow);
  }

  const cached = await readCachedOrders();
  return cached.find((order) => order.id === orderId) ?? null;
}

export async function saveOrder(order: OrderRecord): Promise<void> {
  const existing = await readCachedOrders();
  await writeOrders([
    order,
    ...existing.filter((entry) => entry.id !== order.id),
  ]);
}
