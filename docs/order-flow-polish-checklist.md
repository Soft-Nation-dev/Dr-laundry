# Order Flow Polish Checklist

Status legend: `[ ]` pending, `[~]` in progress, `[x]` complete.

## Requirements

- [x] 1. Combined-pickup delivery pricing
  - A customer with a paid, not-yet-picked-up order must not pay the pickup/delivery fee twice when a second order can share the same pickup.
  - Eligibility and discount must be calculated and enforced by the backend, not trusted from the client.
  - Checkout, order records, payment verification, summaries, admin screens, and payment history must agree.
  - Prevent reuse after pickup, cancellation, expiry, incompatible address/window, or another claimed order.

- [x] 2. Step 1 address reliability and responsiveness
  - Keep verified Google place ID and coordinates.
  - Reduce stalls, handle timeouts and stale searches, and provide immediate user feedback/retry.
  - Preserve the saved profile address as the default.

- [x] 3. Catalogue contents and artwork
  - The Tops group contains only Polos and Long-sleeved Shirts.
  - Generate matching catalogue artwork for the changed top item(s).
  - Add Underwear with matching artwork at NGN 300.
  - Update every catalogue/summary/backend reference.

- [x] 4. Plural catalogue names
  - All customer-facing garment names use plural labels consistently.
  - Historical order records remain readable.

- [x] 5. Pickup windows
  - Morning: 8:00-10:00.
  - Evening: 17:00-19:00.
  - Use the same windows in frontend labels, backend validation, persisted orders, admin, driver, and notifications.

- [x] 6. Home catalogue shortcut
  - Replace the chat/service shortcut with Catalogue.
  - Add a catalogue page listing every item and current price.

- [x] 7. Customer-confirmed delivery scheduling
  - Replace customer-facing "Out for delivery" with "Ready for delivery" where appropriate.
  - A customer confirms delivery date, time window, and location before dispatch.
  - Existing saved/order address is selected by default but can be changed through verified address selection.
  - Backend validates and stores the confirmation; drivers/admins see the confirmed schedule.

- [x] 8. Important-step notifications
  - Notify customers for important order, payment, pickup, processing, delivery-scheduling, dispatch, cancellation, and completion events.
  - Avoid duplicates; persist events and deliver in-app/native where available.

- [x] 9. Admin popular locations
  - Add a dashboard showing customer/order counts grouped by useful location/area.
  - Include hotspot ranking for planning and expansion without exposing individual customer details.
  - Keep data current from backend records.

- [x] 10. Admin income dashboard
  - Show real-time gross successful payments, pending/unpaid amounts, counts, trends, and relevant totals.
  - Calculate from immutable backend payment/order records with admin/superadmin authorization.

## Cross-cutting acceptance checks

- [x] Price calculations are authoritative on the backend and resistant to client tampering.
- [x] No new exposed table was required; new functions validate the authenticated actor and a Worker-only secret, with explicit grants.
- [x] Realtime subscriptions attach callbacks before `subscribe()` and clean up correctly.
- [x] Existing orders remain compatible with new catalogue names and delivery states.
- [x] TypeScript, database verification queries, `git diff --check`, and Worker dry-run pass.
- [x] Production backend is deployed and its authentication boundary is smoke-tested.

## Implementation notes

- This document is the source-of-truth checklist for this batch. Update it as each requirement is completed.
- Preserve unrelated user changes in the working tree.
- Supabase migration: `order_flow_polish_notification_trigger_expansion` (after the base and notification-fix migrations).
- Production Worker: `https://dr-laundry-backend.drlaundry6.workers.dev`, final verified version `c295d25d-1515-4384-8b24-2698810e257f`.
