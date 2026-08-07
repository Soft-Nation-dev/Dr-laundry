import { supabase } from "@/lib/supabase-client";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  orderId: string | null;
  route: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications(): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to view notifications.");

  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,body,kind,order_id,route,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    kind: item.kind,
    orderId: item.order_id,
    route: item.route,
    readAt: item.read_at,
    createdAt: item.created_at,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}
