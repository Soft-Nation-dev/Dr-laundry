export type LaundryMode = "wash-iron" | "ironing-only" | "washing-only";

export type PickupDayCode = "today" | "tomorrow" | "next-day";

export type PickupWindowCode = "morning" | "afternoon" | "asap";

export type OrderStatus =
  | "pickup-confirmed"
  | "processing"
  | "out-for-delivery"
  | "delivered";

export type CatalogItemCategory = "regular" | "extras";

export type CatalogItem = {
  id: string;
  name: string;
  basePrice: number;
  category: CatalogItemCategory;
};

export type OrderLineItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  category: CatalogItemCategory;
  mode?: LaundryMode;
};

export type PricingTotals = {
  baseSubtotal: number;
  modeSubtotal: number;
  pickupDeliveryFee: number;
  standardTotal: number;
  expressPremium: number;
  expressDeliveryFee: number;
  expressTotal: number;
};

export type OrderDraft = {
  address: string;
  note: string;
  mode: LaundryMode;
  pickupDay: PickupDayCode;
  pickupWindow: PickupWindowCode;
  deliveryDay?: PickupDayCode;
  deliveryWindow?: PickupWindowCode;
  lineItems: OrderLineItem[];
  totals: PricingTotals;
};

export type OrderRecord = OrderDraft & {
  id: string;
  createdAtISO: string;
  pickupAtISO: string;
  promisedDeliveryISO: string;
  actualDeliveryISO?: string;
  deliveryAtISO?: string;
  isExpress: boolean;
  status: OrderStatus;
  paidAmount: number;
};

