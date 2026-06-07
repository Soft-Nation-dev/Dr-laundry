import AsyncStorage from "@react-native-async-storage/async-storage";

import { resolvePickupAtISO, resolvePromisedDeliveryISO, resolveDeliveryAtISO } from "@/lib/pricing";
import { OrderDraft, OrderRecord, OrderStatus } from "@/types/order";

const ORDERS_STORAGE_KEY = "dr-laundry-orders-v1";

function createOrderId(): string {
  const timeChunk = Date.now().toString().slice(-6);
  const randomChunk = Math.floor(100 + Math.random() * 900);
  return `DL-${timeChunk}${randomChunk}`;
}

function parseOrders(raw: string | null): OrderRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as OrderRecord[];
  } catch {
    return [];
  }
}

async function writeOrders(orders: OrderRecord[]): Promise<void> {
  await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export async function getOrders(): Promise<OrderRecord[]> {
  const raw = await AsyncStorage.getItem(ORDERS_STORAGE_KEY);
  const orders = parseOrders(raw);

  return orders.sort((a, b) => {
    return (
      new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime()
    );
  });
}

export async function getOrderById(
  orderId: string,
): Promise<OrderRecord | null> {
  const orders = await getOrders();
  return orders.find((order) => order.id === orderId) ?? null;
}

export async function saveOrder(order: OrderRecord): Promise<void> {
  const existing = await getOrders();
  const next = [order, ...existing.filter((entry) => entry.id !== order.id)];
  await writeOrders(next);
}

export async function createOrderFromDraft(
  draft: OrderDraft,
  isExpress: boolean,
): Promise<OrderRecord> {
  const createdAtISO = new Date().toISOString();
  const pickupWindow = isExpress ? "asap" : draft.pickupWindow;
  const pickupAtISO = resolvePickupAtISO(
    draft.pickupDay,
    pickupWindow,
    isExpress,
  );

  const deliveryWindow = isExpress ? "asap" : (draft.deliveryWindow ?? "afternoon");
  const deliveryDay = isExpress ? "tomorrow" : (draft.deliveryDay ?? "tomorrow");
  const deliveryAtISO = resolveDeliveryAtISO(
    deliveryDay,
    deliveryWindow,
    isExpress,
  );

  const promisedDeliveryISO = resolvePromisedDeliveryISO(
    pickupAtISO,
    isExpress,
  );

  const order: OrderRecord = {
    ...draft,
    id: createOrderId(),
    createdAtISO,
    pickupWindow,
    pickupAtISO,
    deliveryDay,
    deliveryWindow,
    deliveryAtISO,
    promisedDeliveryISO,
    isExpress,
    status: "pickup-confirmed",
    paidAmount: isExpress
      ? draft.totals.expressTotal
      : draft.totals.standardTotal,
  };

  await saveOrder(order);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<OrderRecord | null> {
  const orders = await getOrders();
  let updated: OrderRecord | null = null;

  const next = orders.map((order) => {
    if (order.id !== orderId) {
      return order;
    }

    updated = {
      ...order,
      status,
      actualDeliveryISO:
        status === "delivered"
          ? (order.actualDeliveryISO ?? new Date().toISOString())
          : order.actualDeliveryISO,
    };

    return updated;
  });

  await writeOrders(next);
  return updated;
}
