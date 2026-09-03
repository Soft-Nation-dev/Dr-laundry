import { supabase } from "@/lib/supabase-client";
import { OrderStatus } from "@/types/order";

export type HomeOrderSummary = {
  id: string;
  pickupAtISO: string;
  status: OrderStatus;
  isExpress: boolean;
};

export type HomeDashboard = {
  profileName: string;
  nextOrder: HomeOrderSummary | null;
  latestActiveOrderId: string | null;
  inProcess: number;
  delivered: number;
  pendingAmount: number;
  pendingPaymentCount: number;
  pendingPaymentExpiresAt: string | null;
  unreadNotifications: number;
};

export async function getHomeDashboard(): Promise<HomeDashboard> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Your session has expired. Sign in again.");

  const [profileResult, ordersResult, notificationsResult] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id,pickup_at,status,is_express,paid_amount,payment_status,payment_expires_at,created_at")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  if (ordersResult.error) throw new Error(ordersResult.error.message);

  const orders = ordersResult.data ?? [];
  const now = Date.now();
  const active = orders.filter(
    (order) => ["paid", "unpaid"].includes(order.payment_status) && !["delivered", "cancelled"].includes(order.status),
  );
  const pendingPayments = orders.filter(
    (order) =>
      order.payment_status === "pending" &&
      new Date(order.payment_expires_at ?? 0).getTime() > now,
  );
  const pickupCandidates = active
    .filter((order) => order.status === "pickup-confirmed")
    .sort(
      (a, b) =>
        new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime(),
    );
  const next = pickupCandidates[0] ?? active[0] ?? null;

  return {
    profileName:
      profileResult.data?.name ??
      user.user_metadata?.name ??
      user.user_metadata?.full_name ??
      "",
    nextOrder: next
      ? {
          id: next.id,
          pickupAtISO: next.pickup_at,
          status: next.status as OrderStatus,
          isExpress: Boolean(next.is_express),
        }
      : null,
    latestActiveOrderId: active[0]?.id ?? null,
    inProcess: active.length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    pendingAmount: pendingPayments
      .reduce((total, order) => total + Number(order.paid_amount ?? 0), 0),
    pendingPaymentCount: pendingPayments.length,
    pendingPaymentExpiresAt: pendingPayments
      .map((order) => order.payment_expires_at as string)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null,
    unreadNotifications: notificationsResult.error
      ? 0
      : (notificationsResult.count ?? 0),
  };
}
