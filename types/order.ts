export type LaundryMode = "wash-iron" | "ironing-only" | "washing-only";

export type PickupDayCode = "today" | "tomorrow" | "next-day";

export type PickupWindowCode = "morning" | "afternoon" | "asap";

export type TurnaroundHours = 24 | 72;
export type PaymentMethod = "paystack" | "pay_on_delivery";
export type PaymentStatus = "pending" | "unpaid" | "paid" | "failed" | "expired";

export type OrderStatus =
  | "pickup-confirmed"
  | "processing"
  | "ready-for-delivery"
  | "out-for-delivery"
  | "delivered"
  | "cancelled";

export type DriverTaskType = "pickup" | "delivery";

export type DriverTaskStatus =
  | "available"
  | "accepted"
  | "arrived"
  | "completed";

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
  sharedPickupDiscount?: number;
};

export type OrderDraft = {
  address: string;
  addressPlaceId?: string;
  latitude?: number;
  longitude?: number;
  note: string;
  mode: LaundryMode;
  pickupDay: PickupDayCode;
  pickupWindow: PickupWindowCode;
  deliveryDay?: PickupDayCode;
  deliveryWindow?: PickupWindowCode;
  isExpress?: boolean;
  turnaroundHours: TurnaroundHours;
  lineItems: OrderLineItem[];
  totals: PricingTotals;
  sharedPickupOrderId?: string;
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
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentMarkedBy?: string;
  paymentMarkedByRole?: string;
  paymentMarkedAt?: string;
  sharedPickupOrderId?: string;
  deliveryConfirmationStatus?: "not_required" | "pending" | "confirmed";
  deliveryAddress?: string;
  deliveryAddressPlaceId?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryConfirmedAt?: string;
  driverId?: string;
  driverTaskType?: DriverTaskType;
  driverTaskStatus?: DriverTaskStatus;
};

