import {
    EXPRESS_DELIVERY_FEE,
    EXPRESS_SURCHARGE_RATE,
    MODE_OPTIONS,
    PICKUP_DAY_OPTIONS,
    PICKUP_WINDOW_OPTIONS,
    ROUNDING_STEP,
    STANDARD_PICKUP_AND_DELIVERY_FEE,
} from "@/constants/pricing";
import {
    LaundryMode,
    OrderLineItem,
    OrderStatus,
    PickupDayCode,
    PickupWindowCode,
    PricingTotals,
} from "@/types/order";

export function roundToNearest(value: number, step = ROUNDING_STEP): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value / step) * step;
}

export function formatNaira(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `₦${Math.round(value).toLocaleString("en-US")}`;
}

export function getModeLabel(mode: LaundryMode): string {
  return MODE_OPTIONS[mode].label;
}

export function getPickupWindowLabel(windowCode: PickupWindowCode): string {
  const pickupWindow = PICKUP_WINDOW_OPTIONS.find(
    (option) => option.code === windowCode,
  );
  return pickupWindow?.label ?? "Pickup window";
}

export function getPickupDayLabel(dayCode: PickupDayCode): string {
  const pickupDay = PICKUP_DAY_OPTIONS.find(
    (option) => option.code === dayCode,
  );
  return pickupDay?.label ?? "Pickup day";
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "pickup-confirmed":
      return "Pickup confirmed";
    case "processing":
      return "Cleaning in progress";
    case "out-for-delivery":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    default:
      return "Pending";
  }
}

export function buildSelectedItems(
  allItems: OrderLineItem[],
  mode: LaundryMode,
): OrderLineItem[] {
  return allItems
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      ...item,
      unitPrice: roundToNearest(item.unitPrice * MODE_OPTIONS[mode].multiplier),
    }));
}

export function calculateTotals(
  lineItems: OrderLineItem[],
  mode: LaundryMode,
): PricingTotals {
  const baseSubtotal = lineItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const modeSubtotal = lineItems.reduce((sum, item) => {
    const itemMode = item.mode ?? mode;
    const adjusted = roundToNearest(
      item.unitPrice * MODE_OPTIONS[itemMode].multiplier,
    );
    return sum + adjusted * item.quantity;
  }, 0);

  const standardTotal = modeSubtotal + STANDARD_PICKUP_AND_DELIVERY_FEE;
  const expressPremium = roundToNearest(standardTotal * EXPRESS_SURCHARGE_RATE);
  const expressTotal = standardTotal + expressPremium + EXPRESS_DELIVERY_FEE;

  return {
    baseSubtotal,
    modeSubtotal,
    pickupDeliveryFee: STANDARD_PICKUP_AND_DELIVERY_FEE,
    standardTotal,
    expressPremium,
    expressDeliveryFee: EXPRESS_DELIVERY_FEE,
    expressTotal,
  };
}

export function resolvePickupAtISO(
  pickupDay: PickupDayCode,
  pickupWindow: PickupWindowCode,
  isExpress: boolean,
): string {
  if (isExpress || pickupWindow === "asap") {
    return new Date().toISOString();
  }

  const dayConfig = PICKUP_DAY_OPTIONS.find(
    (option) => option.code === pickupDay,
  );
  const windowConfig = PICKUP_WINDOW_OPTIONS.find(
    (option) => option.code === pickupWindow,
  );

  const pickupAt = new Date();
  pickupAt.setSeconds(0, 0);

  const dayOffset = dayConfig?.offsetDays ?? 0;
  pickupAt.setDate(pickupAt.getDate() + dayOffset);

  const hour = windowConfig?.startHour ?? 10;
  pickupAt.setHours(hour, 0, 0, 0);

  return pickupAt.toISOString();
}

export function resolvePromisedDeliveryISO(
  pickupAtISO: string,
  isExpress: boolean,
): string {
  const promised = new Date(pickupAtISO);
  promised.setHours(promised.getHours() + (isExpress ? 48 : 72));
  return promised.toISOString();
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDayOnly(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTimeOnly(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function hoursUntil(isoDate: string): number {
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) {
    return 0;
  }
  const deltaMs = target - Date.now();
  return Math.max(0, Math.ceil(deltaMs / (1000 * 60 * 60)));
}

export function resolveDeliveryAtISO(
  deliveryDay: PickupDayCode,
  deliveryWindow: PickupWindowCode,
  isExpress: boolean,
): string {
  if (isExpress || deliveryWindow === "asap") {
    const date = new Date();
    date.setHours(date.getHours() + 48);
    return date.toISOString();
  }

  const dayConfig = PICKUP_DAY_OPTIONS.find(
    (option) => option.code === deliveryDay,
  );
  const windowConfig = PICKUP_WINDOW_OPTIONS.find(
    (option) => option.code === deliveryWindow,
  );

  const deliveryAt = new Date();
  deliveryAt.setSeconds(0, 0);

  const dayOffset = dayConfig?.offsetDays ?? 1;
  deliveryAt.setDate(deliveryAt.getDate() + dayOffset);

  const hour = windowConfig?.startHour ?? 15;
  deliveryAt.setHours(hour, 0, 0, 0);

  return deliveryAt.toISOString();
}

export function getDeliveryWindowLabel(windowCode: PickupWindowCode): string {
  return getPickupWindowLabel(windowCode);
}

export function getDeliveryDayLabel(dayCode: PickupDayCode): string {
  return getPickupDayLabel(dayCode);
}

