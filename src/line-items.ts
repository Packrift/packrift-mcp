import { z } from "zod";

// Tolerant cart/shipping line-item schema shared by create_cart_url and
// get_shipping_estimate.
//
// WHY: real buying agents mix the two quantity spellings this server itself
// uses (get_pricing takes `quantity`, cart items take `qty`) and routinely
// send variant IDs as JSON numbers despite the schema saying string. Both
// mistakes are unambiguous, so coerce instead of hard-erroring: `quantity` is
// accepted as an alias for `qty`, and numeric variant_id values are
// stringified. Canonical shape in tools/list is unchanged (`variant_id`
// string + `qty` integer).
export const tolerantLineItemZod = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const item = { ...(raw as Record<string, unknown>) };
    if (item.qty === undefined && item.quantity !== undefined) item.qty = item.quantity;
    delete item.quantity;
    if (typeof item.variant_id === "number" && Number.isFinite(item.variant_id)) {
      item.variant_id = String(item.variant_id);
    }
    if (typeof item.qty === "string" && /^\d+$/.test(item.qty.trim())) {
      item.qty = Number(item.qty.trim());
    }
    return item;
  },
  z.object({
    variant_id: z.string(),
    qty: z.number().int().min(1),
  })
);
