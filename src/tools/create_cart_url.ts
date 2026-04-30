import { z } from "zod";
import { Env, variantIdToNumeric } from "../shopify.js";

export const createCartUrlSchema = {
  name: "create_cart_url",
  description:
    "Builds a Shopify cart permalink for the given variants and quantities. Always appends ?ref=mcp for attribution. Optionally appends &discount=<code>.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            variant_id: { type: "string" },
            qty: { type: "integer", minimum: 1 },
          },
          required: ["variant_id", "qty"],
        },
      },
      discount_code: { type: "string" },
      ref: { type: "string", default: "mcp" },
    },
    required: ["items"],
  },

  annotations: { readOnlyHint: true, openWorldHint: true },
};

export const createCartUrlZod = z.object({
  items: z
    .array(
      z.object({
        variant_id: z.string(),
        qty: z.number().int().min(1),
      })
    )
    .min(1),
  discount_code: z.string().min(1).optional(),
  ref: z.string().default("mcp"),
});

export function createCartUrlHandler(env: Env, raw: unknown) {
  const input = createCartUrlZod.parse(raw);
  const path = input.items
    .map((it) => `${variantIdToNumeric(it.variant_id)}:${it.qty}`)
    .join(",");
  const params = new URLSearchParams();
  params.set("ref", input.ref);
  if (input.discount_code) params.set("discount", input.discount_code);
  return {
    url: `https://${env.STOREFRONT_DOMAIN}/cart/${path}?${params.toString()}`,
    items: input.items,
    ref: input.ref,
    discount_code: input.discount_code ?? null,
  };
}
