// CORS Helper Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS, PUT, PATCH, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// Response Helpers
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle OPTIONS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Public image delivery. The bucket remains private; only this route serves files.
      const mediaPrefix = "/media/profile-images/";
      if (pathname.startsWith(mediaPrefix) && request.method === "GET") {
        const key = decodeURIComponent(pathname.slice(mediaPrefix.length));
        if (!key.startsWith("profiles/") || key.includes("..")) {
          return jsonResponse(
            { success: false, message: "Invalid image path", data: null },
            400,
          );
        }

        const object = await env.PROFILE_IMAGES.get(key);
        if (!object) {
          return jsonResponse(
            { success: false, message: "Image not found", data: null },
            404,
          );
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Cache-Control", "public, max-age=86400, immutable");
        headers.set("X-Content-Type-Options", "nosniff");
        return new Response(object.body, { headers });
      }

      // 1. JWT Authentication verification helper
      const authHeader = request.headers.get("Authorization");
      let userJwt = "";
      if (authHeader && authHeader.startsWith("Bearer ")) {
        userJwt = authHeader.substring(7);
      }

      // Verify JWT with Supabase Auth endpoint
      let user: any = null;
      if (
        pathname !== "/api/orders/paystack-webhook" &&
        pathname !== "/api/health"
      ) {
        if (!userJwt) {
          return jsonResponse(
            { success: false, message: "Authorization token is missing", data: null },
            401,
          );
        }

        const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${userJwt}`,
          },
        });

        if (!userResponse.ok) {
          return jsonResponse(
            { success: false, message: "Invalid authorization token", data: null },
            401,
          );
        }
        user = await userResponse.json();
      }

      // ==========================================
      // ROUTING
      // ==========================================

      // GET /api/health
      if (pathname === "/api/health") {
        return jsonResponse({ status: "healthy", timestamp: Date.now() });
      }

      // POST /api/profile/avatar
      if (pathname === "/api/profile/avatar" && request.method === "POST") {
        const declaredSize = Number(request.headers.get("content-length") || 0);
        if (declaredSize > 6 * 1024 * 1024) {
          return jsonResponse(
            { success: false, message: "Profile photos must be smaller than 5 MB", data: null },
            413,
          );
        }

        const formData = await request.formData();
        const image = formData.get("image");
        if (!image || typeof image === "string") {
          return jsonResponse(
            { success: false, message: "Choose an image to upload", data: null },
            400,
          );
        }

        const allowedTypes: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = allowedTypes[image.type];
        if (!extension) {
          return jsonResponse(
            { success: false, message: "Use a JPG, PNG, or WebP image", data: null },
            415,
          );
        }
        if (image.size > 5 * 1024 * 1024) {
          return jsonResponse(
            { success: false, message: "Profile photos must be smaller than 5 MB", data: null },
            413,
          );
        }

        const profileUrl = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`;
        const supabaseHeaders = {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${userJwt}`,
        };
        let previousAvatarUrl = "";
        const currentProfileResponse = await fetch(
          `${profileUrl}&select=avatar_url`,
          { headers: supabaseHeaders },
        );
        if (currentProfileResponse.ok) {
          const currentProfiles: Array<{ avatar_url?: string | null }> =
            await currentProfileResponse.json();
          previousAvatarUrl = currentProfiles[0]?.avatar_url || "";
        }

        const key = `profiles/${user.id}/${crypto.randomUUID()}.${extension}`;
        await env.PROFILE_IMAGES.put(key, image.stream(), {
          httpMetadata: { contentType: image.type },
          customMetadata: { userId: user.id },
        });

        const avatarUrl = `${url.origin}${mediaPrefix}${key}`;
        const updateResponse = await fetch(profileUrl, {
          method: "PATCH",
          headers: {
            ...supabaseHeaders,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          }),
        });

        if (!updateResponse.ok) {
          await env.PROFILE_IMAGES.delete(key);
          const details = await updateResponse.text();
          return jsonResponse(
            {
              success: false,
              message: details.includes("avatar_url")
                ? "Run the Supabase profile avatar migration, then try again"
                : "Could not save the profile photo",
              data: null,
            },
            500,
          );
        }

        if (previousAvatarUrl) {
          try {
            const previousUrl = new URL(previousAvatarUrl);
            if (
              previousUrl.origin === url.origin &&
              previousUrl.pathname.startsWith(mediaPrefix)
            ) {
              const previousKey = decodeURIComponent(
                previousUrl.pathname.slice(mediaPrefix.length),
              );
              if (previousKey.startsWith(`profiles/${user.id}/`)) {
                await env.PROFILE_IMAGES.delete(previousKey);
              }
            }
          } catch {
            // Ignore legacy or externally hosted avatar URLs.
          }
        }

        return jsonResponse({
          success: true,
          message: "Profile photo updated",
          data: { avatarUrl },
        });
      }

      // POST /api/orders/create
      if (pathname === "/api/orders/create" && request.method === "POST") {
        const body: any = await request.json();
        const { draft, isExpress } = body;

        if (!draft || !draft.totals || !draft.lineItems) {
          return jsonResponse(
            { success: false, message: "Order draft details are incomplete", data: null },
            400,
          );
        }

        // Generate unique order reference ID
        const timeChunk = Date.now().toString().slice(-6);
        const randomChunk = Math.floor(100 + Math.random() * 900);
        const orderId = `DL-${timeChunk}${randomChunk}`;

        const finalAmount = isExpress
          ? draft.totals.expressTotal
          : draft.totals.standardTotal;

        // Initialize Paystack checkout
        const paystackAmount = Math.round(finalAmount * 100); // Paystack expects amount in Kobo (Naira * 100)
        const paystackResponse = await fetch(
          "https://api.paystack.co/transaction/initialize",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.email,
              amount: paystackAmount,
              reference: orderId,
              callback_url: "https://standard.paystack.co/close",
              metadata: {
                orderId,
                userId: user.id,
                isExpress,
              },
            }),
          },
        );

        const paystackResult: any = await paystackResponse.json();

        if (!paystackResult.status) {
          return jsonResponse(
            {
              success: false,
              message: paystackResult.message || "Failed to initialize payment gateway",
              data: null,
            },
            500,
          );
        }

        // Create ISO pickup and delivery dates
        const pickupAtISO = new Date().toISOString(); // standard fallback
        const deliveryAtISO = new Date(
          Date.now() + (isExpress ? 48 : 72) * 60 * 60 * 1000,
        ).toISOString();

        // Save order inside Supabase (using user JWT to enforce RLS policies)
        const orderRecord = {
          id: orderId,
          user_id: user.id,
          address: draft.address,
          note: draft.note || "",
          mode: draft.mode,
          pickup_day: draft.pickupDay,
          pickup_window: draft.pickupWindow,
          delivery_day: draft.deliveryDay || "tomorrow",
          delivery_window: draft.deliveryWindow || "afternoon",
          pickup_at: pickupAtISO,
          delivery_at: deliveryAtISO,
          promised_delivery_at: deliveryAtISO,
          is_express: isExpress,
          status: "pickup-confirmed",
          paid_amount: finalAmount,
          payment_status: "pending",
          payment_reference: paystackResult.data.reference,
        };

        const supabaseOrderRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/orders`,
          {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${userJwt}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(orderRecord),
          },
        );

        if (!supabaseOrderRes.ok) {
          const errText = await supabaseOrderRes.text();
          return jsonResponse(
            {
              success: false,
              message: "Failed to write order record to database",
              data: errText,
            },
            500,
          );
        }

        // Save line items
        const items = draft.lineItems.map((item: any) => ({
          order_id: orderId,
          item_id: item.id,
          name: item.name,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          category: item.category,
        }));

        const supabaseItemsRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/order_items`,
          {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${userJwt}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(items),
          },
        );

        if (!supabaseItemsRes.ok) {
          return jsonResponse(
            {
              success: false,
              message: "Order was created, but failed to insert line items",
              data: null,
            },
            500,
          );
        }

        return jsonResponse({
          success: true,
          message: "Order initialized. Complete payment to finalize.",
          data: {
            authorization_url: paystackResult.data.authorization_url,
            reference: paystackResult.data.reference,
            orderId,
          },
        });
      }

      // POST /api/orders/verify-payment
      if (
        pathname === "/api/orders/verify-payment" &&
        request.method === "POST"
      ) {
        const { reference } = (await request.json()) as any;
        if (!reference) {
          return jsonResponse(
            { success: false, message: "Reference code is required", data: null },
            400,
          );
        }

        // Call Paystack verification API
        const paystackVerifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
            },
          },
        );

        const verifyResult: any = await paystackVerifyRes.json();

        if (!verifyResult.status || verifyResult.data.status !== "success") {
          return jsonResponse(
            {
              success: false,
              message: "Payment could not be verified by gateway",
              data: null,
            },
            400,
          );
        }

        // Update Order in Supabase
        const updateRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/orders?id=eq.${reference}`,
          {
            method: "PATCH",
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${userJwt}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payment_status: "paid",
            }),
          },
        );

        if (!updateRes.ok) {
          return jsonResponse(
            {
              success: false,
              message: "Payment verified, but failed to update status in database",
              data: null,
            },
            500,
          );
        }

        // Insert order tracking log
        await fetch(`${env.SUPABASE_URL}/rest/v1/order_tracking`, {
          method: "POST",
          headers: {
            apikey: env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${userJwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: reference,
            status: "pickup-confirmed",
            note: "Payment successfully verified via Paystack",
          }),
        });

        return jsonResponse({
          success: true,
          message: "Payment successfully verified and logged",
          data: { reference, status: "paid" },
        });
      }

      // GET /api/orders/list
      if (pathname === "/api/orders/list" && request.method === "GET") {
        const orderListRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`,
          {
            headers: {
              apikey: env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${userJwt}`,
            },
          },
        );

        if (!orderListRes.ok) {
          return jsonResponse(
            { success: false, message: "Failed to query orders", data: null },
            500,
          );
        }

        const ordersList = await orderListRes.json();
        return jsonResponse({
          success: true,
          message: "Orders retrieved",
          data: ordersList,
        });
      }

      // POST /api/orders/paystack-webhook (Server-to-Server webhook event fallback)
      if (pathname === "/api/orders/paystack-webhook" && request.method === "POST") {
        const event: any = await request.json();

        // Verify Paystack event type
        if (event.event === "charge.success") {
          const reference = event.data.reference;

          // Perform updates via Supabase REST API bypass RLS (using anon key but standard updates, or direct patch)
          // Webhooks should ideally check the Paystack signature header x-paystack-signature.
          // For now, we will simply process the update.
          await fetch(
            `${env.SUPABASE_URL}/rest/v1/orders?id=eq.${reference}`,
            {
              method: "PATCH",
              headers: {
                apikey: env.SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                payment_status: "paid",
              }),
            },
          );
        }

        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // Route Not Found
      return jsonResponse(
        { success: false, message: "Route not found", data: null },
        404,
      );
    } catch (err: any) {
      return jsonResponse(
        {
          success: false,
          message: err.message || "Internal server error occurred",
          data: null,
        },
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;
