#!/usr/bin/env node

import { approvalForSku } from "../dist/approval.js";
import { createCartUrlHandler } from "../dist/tools/create_cart_url.js";
import { MCP_COMMERCE_HELD_SKUS } from "../dist/mcp-commerce-holds.js";

const sku1066 = approvalForSku("1066");
const skuMfl1295 = approvalForSku("MFL1295");

if (!sku1066 || !skuMfl1295) {
  throw new Error("Required AI_APPROVE fixture SKUs 1066 and MFL1295 were not found in the compiled catalog.");
}

const env = {
  STOREFRONT_DOMAIN: "packrift.com",
  CATALOG_CACHE: {
    async put() {
      throw new Error("Synthetic continuity checks must not write analytics events.");
    },
  },
};

function synthetic(args) {
  return {
    ...args,
    suppress_analytics: true,
    analytics_context: { synthetic: true, source: "check_create_cart_continuity" },
  };
}

function assertCheck(condition, message, details = {}) {
  if (!condition) {
    const suffix = Object.keys(details).length ? ` ${JSON.stringify(details)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

async function expectPass(name, args, validate, context = {}) {
  const result = await createCartUrlHandler(env, synthetic(args), context);
  validate(result);
  return { name, pass: true };
}

async function expectBlock(name, args, text) {
  try {
    await createCartUrlHandler(env, synthetic(args));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assertCheck(message.includes(text), `${name} blocked with the wrong error`, { message, expected: text });
    return { name, pass: true, blocked: true };
  }
  throw new Error(`${name} should have been blocked.`);
}

const checks = [];

assertCheck(MCP_COMMERCE_HELD_SKUS.includes("12104"), "MCP commerce hold list must include SKU 12104", {
  held_skus: MCP_COMMERCE_HELD_SKUS,
});

checks.push(
  await expectPass("sku_shortcut_resolves_variant", { sku: "1066", quantity: 2 }, (result) => {
    assertCheck(result.items?.[0]?.variant_id === sku1066.variantId, "SKU shortcut used the wrong variant", result.items?.[0]);
    assertCheck(result.items?.[0]?.qty === 2, "SKU shortcut used the wrong quantity", result.items?.[0]);
    assertCheck(result.url?.startsWith("https://mcp.packrift.com/r/cart/1066"), "SKU shortcut did not return measured MCP cart landing", {
      url: result.url,
    });
    assertCheck(result.cart_continuity?.mode === "sku_shortcut", "SKU shortcut did not mark cart continuity mode", result.cart_continuity);
  })
);

checks.push(
  await expectPass(
    "explicit_matching_sku_variant_passes",
    {
      sku: "1066",
      items: [{ variant_id: sku1066.variantId, qty: 1 }],
      selected_handle: sku1066.handle,
    },
    (result) => {
      assertCheck(result.resolved_from_catalog?.sku === "1066", "Matching SKU and variant did not resolve catalog identity", {
        resolved_from_catalog: result.resolved_from_catalog,
      });
    }
  )
);

checks.push(
  await expectPass(
    "mcp_session_id_flows_to_cart_handoff",
    {
      sku: "1066",
      quantity: 1,
      selected_sku: "1066",
      selected_handle: sku1066.handle,
    },
    (result) => {
      assertCheck(result.mcp_session_id === "session-continuity-check-123", "Result did not expose the MCP session ID", {
        mcp_session_id: result.mcp_session_id,
      });
      assertCheck(result.url?.includes("mcp_session_id=session-continuity-check-123"), "Measured MCP cart URL did not include the MCP session ID", {
        url: result.url,
      });
      assertCheck(result.final_cart_url?.includes("mcp_session_id=session-continuity-check-123"), "Final Shopify cart URL did not include the MCP session ID", {
        final_cart_url: result.final_cart_url,
      });
      assertCheck(
        result.cart_handoff?.attribution_required?.mcp_session_id === "session-continuity-check-123",
        "Cart handoff attribution did not include the MCP session ID",
        result.cart_handoff?.attribution_required
      );
    },
    { sessionId: "session-continuity-check-123" }
  )
);

checks.push(
  await expectBlock(
    "sku_variant_mismatch_blocks",
    { sku: "1066", items: [{ variant_id: skuMfl1295.variantId, qty: 1 }] },
    "cart continuity blocked"
  )
);

checks.push(
  await expectBlock(
    "selected_sku_variant_mismatch_blocks",
    { items: [{ variant_id: skuMfl1295.variantId, qty: 1 }], selected_sku: "1066" },
    "cart continuity blocked"
  )
);

checks.push(
  await expectBlock(
    "selected_handle_variant_mismatch_blocks",
    { items: [{ variant_id: sku1066.variantId, qty: 1 }], selected_handle: skuMfl1295.handle },
    "cart continuity blocked"
  )
);

for (const heldSku of MCP_COMMERCE_HELD_SKUS) {
  checks.push(
    await expectBlock(
      `held_sku_${heldSku}_shortcut_blocks`,
      { sku: heldSku, quantity: 1 },
      `MCP commerce hold blocked ${heldSku}`
    )
  );

  const heldItem = approvalForSku(heldSku);
  if (!heldItem) continue;

  checks.push(
    await expectBlock(
      `held_sku_${heldSku}_variant_blocks`,
      { items: [{ variant_id: heldItem.variantId, qty: 1 }] },
      `MCP commerce hold blocked ${heldSku}`
    )
  );
  checks.push(
    await expectBlock(
      `held_sku_${heldSku}_selected_sku_blocks`,
      { items: [{ variant_id: heldItem.variantId, qty: 1 }], selected_sku: heldItem.sku },
      `MCP commerce hold blocked ${heldSku}`
    )
  );
  checks.push(
    await expectBlock(
      `held_sku_${heldSku}_selected_handle_blocks`,
      { items: [{ variant_id: heldItem.variantId, qty: 1 }], selected_handle: heldItem.handle },
      `MCP commerce hold blocked ${heldSku}`
    )
  );
}

const output = {
  created_at: new Date().toISOString(),
  pass: checks.every((check) => check.pass),
  checks,
};

console.log(JSON.stringify(output, null, 2));
