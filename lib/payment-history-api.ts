import { apiRequest } from "@/lib/api-client";

export type PaymentStatus = "pending" | "unpaid" | "paid" | "failed" | "expired";

export type PaymentHistoryItem = {
  id: string;
  reference: string;
  status: PaymentStatus;
  amount: number;
  expiresAt: string | null;
  paidAt: string | null;
  authorizationUrl: string | null;
  createdAt: string;
  isExpress: boolean;
  mode: string;
  orderStatus: string;
  paymentMethod: "paystack" | "pay_on_delivery";
  markedByRole: string | null;
  markedAt: string | null;
  pickupDeliveryFee: number;
  sharedPickupDiscount: number;
  sharedPickupOrderId: string | null;
};

type PaymentHistoryRow = {
  id: string;
  payment_reference: string | null;
  payment_status: PaymentStatus;
  paid_amount: number | string;
  payment_expires_at: string | null;
  payment_paid_at: string | null;
  payment_authorization_url: string | null;
  created_at: string;
  is_express: boolean;
  mode: string;
  status: string;
  payment_method: "paystack" | "pay_on_delivery";
  payment_marked_by_role: string | null;
  payment_marked_at: string | null;
  pickup_delivery_fee: number | string;
  shared_pickup_discount: number | string;
  shared_pickup_order_id: string | null;
};

export async function getPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const response = await apiRequest<PaymentHistoryRow[]>("/api/payments/history", { auth: true });
  if (!response.success || !Array.isArray(response.data)) {
    throw new Error(response.message || "Could not load payment history");
  }
  return response.data.map((row) => ({
    id: row.id,
    reference: row.payment_reference || row.id,
    status: row.payment_status,
    amount: Number(row.paid_amount || 0),
    expiresAt: row.payment_expires_at,
    paidAt: row.payment_paid_at,
    authorizationUrl: row.payment_authorization_url,
    createdAt: row.created_at,
    isExpress: Boolean(row.is_express),
    mode: row.mode,
    orderStatus: row.status,
    paymentMethod: row.payment_method || "paystack",
    markedByRole: row.payment_marked_by_role,
    markedAt: row.payment_marked_at,
    pickupDeliveryFee: Number(row.pickup_delivery_fee || 0),
    sharedPickupDiscount: Number(row.shared_pickup_discount || 0),
    sharedPickupOrderId: row.shared_pickup_order_id,
  }));
}

export async function startOrderPayment(orderId: string) {
  const response = await apiRequest<{
    orderId: string;
    reference: string;
    authorization_url: string;
    payment_expires_at: string;
  }>(`/api/orders/${encodeURIComponent(orderId)}/pay`, {
    method: "POST",
    auth: true,
  });
  if (!response.success || !response.data?.authorization_url) {
    throw new Error(response.message || "Payment could not be started");
  }
  return response.data;
}

export async function verifyPayment(reference: string) {
  const response = await apiRequest<{ reference: string; status: string }>(
    "/api/orders/verify-payment",
    { method: "POST", auth: true, body: { reference } },
  );
  if (!response.success) throw new Error(response.message || "Payment could not be verified");
  return response.data;
}
