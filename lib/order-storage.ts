import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  calculateTotals,
  resolveDeliveryAtISO,
  resolvePickupAtISO,
  resolvePromisedDeliveryISO,
} from "@/lib/pricing";
import { supabase } from "@/lib/supabase-client";
import {
  CatalogItemCategory,
  LaundryMode,
  OrderDraft,
  OrderLineItem,
  OrderRecord,
  OrderStatus,
  PickupDayCode,
  PickupWindowCode,
} from "@/types/order";

const ORDERS_STORAGE_KEY = "dr-laundry-orders-v1";

type OrderRow = {
  id: string;
  address: string;
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
  status: OrderStatus;
  paid_amount: number | string;
  created_at: string;
  order_items?: Array<{
    item_id: string;
    name: string;
    unit_price: number | string;
    quantity: number;
    category: CatalogItemCategory;
    mode?: LaundryMode | null;
  }>;
};

function createOrderId(): string {
  const timeChunk = Date.now().toString().slice(-6);
  const randomChunk = Math.floor(100 + Math.random() * 900);
  return `DL-${timeChunk}${randomChunk}`;
}

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
    status: row.status,
    paidAmount: Number(row.paid_amount),
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

export async function createOrderFromDraft(
  draft: OrderDraft,
  isExpress: boolean,
): Promise<OrderRecord> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again before placing an order.");

  const createdAtISO = new Date().toISOString();
  const pickupWindow = isExpress ? "asap" : draft.pickupWindow;
  const pickupAtISO = resolvePickupAtISO(draft.pickupDay, pickupWindow, isExpress);
  const deliveryWindow = isExpress
    ? "asap"
    : (draft.deliveryWindow ?? "afternoon");
  const deliveryDay = isExpress ? "tomorrow" : (draft.deliveryDay ?? "tomorrow");
  const deliveryAtISO = resolveDeliveryAtISO(
    deliveryDay,
    deliveryWindow,
    isExpress,
  );
  const promisedDeliveryISO = resolvePromisedDeliveryISO(pickupAtISO, isExpress);
  const paidAmount = isExpress
    ? draft.totals.expressTotal
    : draft.totals.standardTotal;
  const id = createOrderId();

  const { error: orderError } = await supabase.from("orders").insert({
    id,
    user_id: user.id,
    address: draft.address,
    note: draft.note,
    mode: draft.mode,
    pickup_day: draft.pickupDay,
    pickup_window: pickupWindow,
    delivery_day: deliveryDay,
    delivery_window: deliveryWindow,
    pickup_at: pickupAtISO,
    delivery_at: deliveryAtISO,
    promised_delivery_at: promisedDeliveryISO,
    is_express: isExpress,
    status: "pickup-confirmed",
    paid_amount: paidAmount,
    payment_status: "paid",
    payment_reference: `SIM-${id}`,
  });

  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await supabase.from("order_items").insert(
    draft.lineItems.map((item) => ({
      order_id: id,
      item_id: item.id,
      name: item.name,
      unit_price: item.unitPrice,
      quantity: item.quantity,
      category: item.category,
      mode: item.mode ?? draft.mode,
    })),
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", id).eq("user_id", user.id);
    throw new Error(itemsError.message);
  }

  const order: OrderRecord = {
    ...draft,
    id,
    createdAtISO,
    pickupWindow,
    pickupAtISO,
    deliveryDay,
    deliveryWindow,
    deliveryAtISO,
    promisedDeliveryISO,
    isExpress,
    status: "pickup-confirmed",
    paidAmount,
  };
  await saveOrder(order);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<OrderRecord | null> {
  const update: Record<string, string> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "delivered") update.actual_delivery_at = new Date().toISOString();

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) throw new Error(error.message);

  const updated = await getOrderById(orderId);
  if (updated) await saveOrder(updated);
  return updated;
}
