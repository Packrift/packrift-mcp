export interface WorkflowGalleryRuntime {
  serverVersion: string;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
}

const MCP_ENDPOINT = "https://mcp.packrift.com/mcp";

function toolCall(id: string, name: string, args: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  };
}

const EXACT_SKU_WORKFLOWS = [
  {
    id: "one_call_purchase_handoff_1066",
    title: "One-call exact SKU live confirmation",
    audience: "Agent hosts and demos that need the shortest useful Packrift MCP flow from known SKU to guarded cart handoff.",
    buyer_prompt:
      "Use Packrift SKU 1066. Confirm the exact product, live price, and inventory; create the cart only after I confirm quantity 1.",
    success_outcome:
      "Agent uses prepare_purchase_handoff to collapse product, price, inventory, and guarded cart handoff into one safe MCP tool call.",
    sequence: [
      toolCall("prepare-1066-unconfirmed", "prepare_purchase_handoff", {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: false,
        source_context: "workflow_gallery_one_call",
      }),
      toolCall("prepare-1066-confirmed", "prepare_purchase_handoff", {
        sku: "1066",
        quantity: 1,
        buyer_confirmed: true,
        source_context: "workflow_gallery_one_call",
      }),
    ],
    expected_checks: [
      "unconfirmed result has status live_confirmed_awaiting_buyer_confirmation and cart null",
      "confirmed result has status cart_handoff_ready",
      "cart result url starts with https://mcp.packrift.com/r/cart/1066",
      "live_confirmation includes product, pricing, inventory, price_ok, and inventory_ok",
    ],
  },
  {
    id: "exact_sku_reorder_1066",
    title: "Exact SKU reorder to measured cart",
    audience: "AI shopping agents, procurement copilots, and agent-host demos that need the shortest buyer-ready flow.",
    buyer_prompt:
      "Reorder Packrift SKU 1066. Confirm the exact product, live price, and inventory, then prepare a cart for quantity 1.",
    success_outcome:
      "Agent presents SKU 1066 only after live checks and hands off the MCP /r/cart URL before the final Shopify cart URL.",
    sequence: [
      toolCall("candidate-1066", "get_cart_handoff_candidates", { sku: "1066", limit: 1 }),
      toolCall("product-1066", "get_product", {
        handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      }),
      toolCall("price-1066", "get_pricing", {
        variant_ids: ["53472879935856"],
        quantity: 1,
        selected_sku: "1066",
        selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
        match_type: "workflow_gallery_exact_sku",
      }),
      toolCall("inventory-1066", "check_inventory", {
        variant_ids: ["53472879935856"],
        selected_sku: "1066",
        selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
        match_type: "workflow_gallery_exact_sku",
      }),
      toolCall("cart-1066", "create_cart_url", {
        sku: "1066",
        quantity: 1,
        selected_sku: "1066",
        selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
        match_type: "workflow_gallery_exact_sku",
        source_context: "mcp_workflow_gallery",
        journey_id: "mcp_workflow_gallery_1066_53472879935856",
        result_set_id: "mcp_workflow_gallery",
        utm_term: "1066",
      }),
    ],
    expected_checks: [
      "candidate result includes selected_sku 1066",
      "product result has ai_status AI_APPROVE",
      "pricing result has unit_price and currency",
      "inventory result has in_stock true before cart handoff",
      "cart result url starts with https://mcp.packrift.com/r/cart/1066",
    ],
  },
  {
    id: "label_reorder_ll251wr",
    title: "Weather-resistant label reorder",
    audience: "Procurement agents handling repeat label purchases where printer type, material, size, and case count must stay exact.",
    buyer_prompt:
      "Prepare a procurement-ready reorder for Packrift SKU LL251WR and confirm live price and inventory before giving me a cart path.",
    success_outcome:
      "Agent confirms the 2 5/8 x 1 weather-resistant polyester laser label spec and keeps the label case count exact.",
    sequence: [
      toolCall("product-ll251wr", "get_product", {
        handle: "2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case",
      }),
      toolCall("price-ll251wr", "get_pricing", {
        variant_ids: ["53475925492080"],
        quantity: 1,
        selected_sku: "LL251WR",
        selected_handle: "2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case",
        match_type: "workflow_gallery_label_reorder",
      }),
      toolCall("inventory-ll251wr", "check_inventory", {
        variant_ids: ["53475925492080"],
        selected_sku: "LL251WR",
        selected_handle: "2-5-8-x-1-weather-resistant-polyester-laser-labels-3000-case",
        match_type: "workflow_gallery_label_reorder",
      }),
      toolCall("reorder-ll251wr", "get_reorder_link", {
        sku: "LL251WR",
        source_context: "mcp_workflow_gallery",
      }),
    ],
    expected_checks: [
      "product result has approved_sku LL251WR",
      "label material and printer type are not substituted",
      "pricing and inventory are current before purchase handoff",
      "reorder link contains Packrift product and procurement-spec continuity",
    ],
  },
  {
    id: "literature_mailer_mfl1295",
    title: "Literature mailer lookup and cart handoff",
    audience: "Fulfillment agents choosing a repeat mailer SKU for ecommerce shipping.",
    buyer_prompt:
      "Find Packrift SKU MFL1295, confirm it is the white self-seal literature mailer, and prepare a quantity 1 cart only if it is in stock.",
    success_outcome:
      "Agent confirms the exact white self-seal literature mailer SKU and avoids nearby mailer sizes or colors.",
    sequence: [
      toolCall("product-mfl1295", "get_product", {
        handle: "12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
      }),
      toolCall("price-mfl1295", "get_pricing", {
        variant_ids: ["53472994427248"],
        quantity: 1,
        selected_sku: "MFL1295",
        selected_handle: "12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
        match_type: "workflow_gallery_mailer_cart",
      }),
      toolCall("inventory-mfl1295", "check_inventory", {
        variant_ids: ["53472994427248"],
        selected_sku: "MFL1295",
        selected_handle: "12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
        match_type: "workflow_gallery_mailer_cart",
      }),
      toolCall("cart-mfl1295", "create_cart_url", {
        sku: "MFL1295",
        quantity: 1,
        selected_sku: "MFL1295",
        selected_handle: "12-1-8-x-9-1-4-x-5-white-corrugated-literature-mailer-self-seal-50-pack",
        match_type: "workflow_gallery_mailer_cart",
        source_context: "mcp_workflow_gallery",
        journey_id: "mcp_workflow_gallery_mfl1295_53472994427248",
        result_set_id: "mcp_workflow_gallery",
        utm_term: "MFL1295",
      }),
    ],
    expected_checks: [
      "product result has approved_sku MFL1295",
      "mailer color, closure, and pack count stay exact",
      "cart result uses https://mcp.packrift.com/r/cart/MFL1295",
    ],
  },
] as const;

const DISCOVERY_WORKFLOWS = [
  {
    id: "fit_item_then_confirm",
    title: "Fit an item, then confirm commerce facts",
    audience: "Agents answering packaging-fit questions where the buyer does not know the SKU.",
    buyer_prompt:
      "Find packaging for a 9 x 4 x 3 inch ecommerce item weighing 2 lb. Show only AI-approved candidates, then confirm price and stock for the selected SKU.",
    success_outcome:
      "Agent ranks fit candidates, asks the buyer to choose an exact SKU and quantity, then runs live price and inventory checks before handoff.",
    sequence: [
      toolCall("fit-9x4x3", "find_packaging_for_item", {
        item_length_in: 9,
        item_width_in: 4,
        item_depth_in: 3,
        item_weight_lb: 2,
        use_case: "ecommerce",
      }),
      {
        jsonrpc: "2.0",
        id: "price-selected-fit",
        method: "tools/call",
        params: {
          name: "get_pricing",
          arguments: {
            variant_ids: ["<selected_variant_id_from_fit_result>"],
            quantity: "<buyer_confirmed_quantity>",
            match_type: "workflow_gallery_fit_confirmed",
          },
        },
      },
      {
        jsonrpc: "2.0",
        id: "inventory-selected-fit",
        method: "tools/call",
        params: {
          name: "check_inventory",
          arguments: {
            variant_ids: ["<selected_variant_id_from_fit_result>"],
            match_type: "workflow_gallery_fit_confirmed",
          },
        },
      },
    ],
    expected_checks: [
      "fit results come from AI_APPROVE catalog records",
      "agent does not create a cart until buyer chooses an exact SKU and quantity",
      "price and inventory are checked for the selected variant",
    ],
  },
  {
    id: "no_exact_match_quote_recovery",
    title: "No-exact-match quote recovery",
    audience: "Agents handling buyer specs where dimensions, material, closure, color, printer type, or case count differs.",
    buyer_prompt:
      "The buyer asked for 10 x 6 x 8 ECT-32 kraft boxes, 25/bundle. If Packrift has no exact AI-approved match, explain the mismatch and give a quote path.",
    success_outcome:
      "Agent refuses to present a nearby SKU as exact and routes the buyer to a tracked quote recovery path.",
    sequence: [
      toolCall("search-10x6x8", "search_products", {
        query: "10 x 6 x 8 ECT-32 kraft corrugated boxes 25 bundle",
        limit: 5,
      }),
      toolCall("no-match-10x6x8", "explain_no_exact_match", {
        requested_spec: "10 x 6 x 8 ECT-32 kraft corrugated boxes, 25/bundle",
        family: "corrugated_boxes",
        missing_or_mismatched_fields: ["depth", "exact_dimensions"],
        reason: "Do not substitute 10 x 6 x 6 or nearby corrugated boxes as an exact 10 x 6 x 8 match.",
      }),
      toolCall("quote-10x6x8", "get_bulk_quote_link", {
        requested_spec: "10 x 6 x 8 ECT-32 kraft corrugated boxes, 25/bundle",
        family: "corrugated_boxes",
        quantity: "buyer to confirm",
        reason: "No exact AI-approved Packrift match.",
      }),
    ],
    expected_checks: [
      "agent states no exact match when required fields differ",
      "nearby dimensions are not promoted as exact substitutes",
      "quote link is used for recovery instead of cart handoff",
    ],
  },
] as const;

const WORKFLOWS = [...EXACT_SKU_WORKFLOWS, ...DISCOVERY_WORKFLOWS] as const;

const AUTOMATION_ENDPOINTS = {
  n8n: `${MCP_ENDPOINT}?packrift_mcp_source=n8n_automation&packrift_mcp_target=generic_streamable_http`,
  zapier: `${MCP_ENDPOINT}?packrift_mcp_source=zapier_automation&packrift_mcp_target=generic_streamable_http`,
  pipedream: `${MCP_ENDPOINT}?packrift_mcp_source=pipedream_automation&packrift_mcp_target=generic_streamable_http`,
} as const;

function firstUsefulRunRequests(source: string, matchType: string) {
  const sourceContext = `${source}_first_cart_run`;
  const journeyId = `mcp_install_${source}_1066_53472879935856`;
  const resultSetId = `mcp_install_first_run_${source}`;
  return [
    { jsonrpc: "2.0", id: "tools", method: "tools/list" },
    toolCall("candidate-1066", "get_cart_handoff_candidates", {
      sku: "1066",
      limit: 1,
      source_context: sourceContext,
      journey_id: journeyId,
      result_set_id: resultSetId,
    }),
    toolCall("price-1066", "get_pricing", {
      variant_ids: ["53472879935856"],
      quantity: 1,
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: matchType,
      source_context: sourceContext,
      journey_id: journeyId,
      result_set_id: resultSetId,
    }),
    toolCall("inventory-1066", "check_inventory", {
      variant_ids: ["53472879935856"],
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: matchType,
      source_context: sourceContext,
      journey_id: journeyId,
      result_set_id: resultSetId,
    }),
    toolCall("cart-1066", "create_cart_url", {
      sku: "1066",
      quantity: 1,
      selected_sku: "1066",
      selected_handle: "10x6x6-ect-32-kraft-long-corrugated-boxes-25-bundle",
      match_type: matchType,
      source_context: sourceContext,
      journey_id: journeyId,
      result_set_id: resultSetId,
      utm_term: "1066",
    }),
  ];
}

function n8nHttpNode(id: string, name: string, position: [number, number], endpoint: string, body: unknown) {
  return {
    parameters: {
      method: "POST",
      url: endpoint,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "content-type", value: "application/json" },
          { name: "accept", value: "application/json, text/event-stream" },
          { name: "Mcp-Session-Id", value: "={{'n8n-packrift-' + $execution.id}}" },
          { name: "user-agent", value: "n8n Packrift MCP Workflow (+https://mcp.packrift.com/mcp)" },
        ],
      },
      sendBody: true,
      contentType: "raw",
      rawContentType: "application/json",
      body: JSON.stringify(body),
    },
    id,
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position,
  };
}

function n8nWorkflow() {
  const endpoint = AUTOMATION_ENDPOINTS.n8n;
  const requests = firstUsefulRunRequests("n8n_automation", "n8n_first_useful_run");
  const nodes = [
    {
      parameters: {},
      id: "manual-trigger",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [0, 0],
    },
    n8nHttpNode("tools-list", "List Packrift MCP tools", [240, 0], endpoint, requests[0]),
    n8nHttpNode("cart-candidates", "Get cart handoff candidates", [480, 0], endpoint, requests[1]),
    n8nHttpNode("pricing", "Get live price", [720, 0], endpoint, requests[2]),
    n8nHttpNode("inventory", "Check live inventory", [960, 0], endpoint, requests[3]),
    n8nHttpNode("create-cart", "Create measured MCP cart URL", [1200, 0], endpoint, requests[4]),
    {
      parameters: {
        jsCode: [
          "const raw = typeof $json === 'string' ? $json : JSON.stringify($json);",
          "const match = raw.match(/https:\\/\\/mcp\\.packrift\\.com\\/r\\/cart\\/[^\"\\s<>\\\\]+/);",
          "if (!match) throw new Error('No measured Packrift MCP /r/cart URL found in create_cart_url response.');",
          "return [{ json: { cart_url: match[0], source_context: 'n8n_automation_first_cart_run' } }];",
        ].join("\n"),
      },
      id: "extract-cart-url",
      name: "Extract measured cart URL",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1440, 0],
    },
    {
      parameters: {
        method: "GET",
        url: "={{$json.cart_url}}",
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: "user-agent", value: "n8n Packrift MCP Workflow (+https://mcp.packrift.com/mcp)" }],
        },
      },
      id: "touch-cart-landing",
      name: "Record measured cart landing",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1680, 0],
    },
  ];
  const chain = [
    "Manual Trigger",
    "List Packrift MCP tools",
    "Get cart handoff candidates",
    "Get live price",
    "Check live inventory",
    "Create measured MCP cart URL",
    "Extract measured cart URL",
    "Record measured cart landing",
  ];
  const connections = Object.fromEntries(
    chain.slice(0, -1).map((name, index) => [name, { main: [[{ node: chain[index + 1], type: "main", index: 0 }]] }])
  );
  return {
    name: "Packrift MCP first useful run",
    nodes,
    connections,
    active: false,
    settings: {
      executionOrder: "v1",
    },
    tags: ["packrift", "mcp", "ai-commerce"],
    pinData: {},
    versionId: "packrift-mcp-first-useful-run-r01",
  };
}

function zapierWebhookSteps() {
  const endpoint = AUTOMATION_ENDPOINTS.zapier;
  return firstUsefulRunRequests("zapier_automation", "zapier_first_useful_run").map((request, index) => ({
    step: index + 1,
    app: "Webhooks by Zapier",
    event: "Custom Request",
    method: "POST",
    url: endpoint,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "Mcp-Session-Id": "zapier-packrift-{{zap_meta_human_now}}",
      "user-agent": "Zapier Packrift MCP Workflow (+https://mcp.packrift.com/mcp)",
    },
    data: request,
  }));
}

function pipedreamNodeSnippet() {
  const endpoint = AUTOMATION_ENDPOINTS.pipedream;
  const requests = firstUsefulRunRequests("pipedream_automation", "pipedream_first_useful_run");
  return [
    "export default defineComponent({",
    "  async run({ steps, $ }) {",
    "    const endpoint = " + JSON.stringify(endpoint) + ";",
    "    const sessionId = `pipedream-packrift-${Date.now()}`;",
    "    const requests = " + JSON.stringify(requests, null, 4).replace(/\n/g, "\n    ") + ";",
    "    let lastText = '';",
    "    for (const body of requests) {",
    "      const res = await fetch(endpoint, {",
    "        method: 'POST',",
    "        headers: {",
    "          'content-type': 'application/json',",
    "          'accept': 'application/json, text/event-stream',",
    "          'Mcp-Session-Id': sessionId,",
    "          'user-agent': 'Pipedream Packrift MCP Workflow (+https://mcp.packrift.com/mcp)'",
    "        },",
    "        body: JSON.stringify(body)",
    "      });",
    "      lastText = await res.text();",
    "      if (!res.ok) throw new Error(`Packrift MCP request failed ${res.status}: ${lastText}`);",
    "    }",
    "    const match = lastText.match(/https:\\/\\/mcp\\.packrift\\.com\\/r\\/cart\\/[^\"\\s<>\\\\]+/);",
    "    if (!match) throw new Error('No measured Packrift MCP /r/cart URL found.');",
    "    await fetch(match[0], { headers: { 'user-agent': 'Pipedream Packrift MCP Workflow (+https://mcp.packrift.com/mcp)' } });",
    "    return { cart_url: match[0], no_order_created: true };",
    "  }",
    "});",
  ].join("\n");
}

export function mcpAutomationWorkflowsPayload(runtime: WorkflowGalleryRuntime) {
  const n8n = n8nWorkflow();
  return {
    release: "PACKRIFT-MCP-AUTOMATION-WORKFLOWS-R01",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Give automation hosts copy-ready Packrift MCP workflows that execute real tools/list and tools/call requests through the hosted endpoint without creating a duplicate CLI, marketplace, or buyer surface.",
    no_duplicate_work_rule:
      "Use https://mcp.packrift.com/mcp plus source-aware query parameters. Do not create a separate Packrift CLI, scraper, checkout page, or buyer surface.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    workflows: {
      n8n: {
        source: "n8n_automation",
        import_url: "https://mcp.packrift.com/ai/mcp-n8n-workflow.json",
        endpoint: AUTOMATION_ENDPOINTS.n8n,
        workflow: n8n,
      },
      zapier: {
        source: "zapier_automation",
        endpoint: AUTOMATION_ENDPOINTS.zapier,
        steps: zapierWebhookSteps(),
      },
      pipedream: {
        source: "pipedream_automation",
        endpoint: AUTOMATION_ENDPOINTS.pipedream,
        code: pipedreamNodeSnippet(),
      },
    },
    success_gate:
      "A real external automation host must record non-suppressed Packrift MCP tool calls and a measured https://mcp.packrift.com/r/cart URL; importing this pack alone is not adoption proof.",
    proof_urls: {
      activation_wave_tasks_jsonl: "https://mcp.packrift.com/ai/mcp-activation-wave-tasks.jsonl",
      source_activation_queue: "https://mcp.packrift.com/ai/mcp-source-activation-queue.json",
      funnel_snapshot: "https://mcp.packrift.com/ai/mcp-funnel-snapshot.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      workflow_gallery: "https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    },
  };
}

export function mcpN8nWorkflowPayload() {
  return n8nWorkflow();
}

export function mcpAutomationWorkflowsMarkdown(runtime: WorkflowGalleryRuntime): string {
  const payload = mcpAutomationWorkflowsPayload(runtime);
  return [
    "# Packrift MCP Automation Workflows",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    payload.purpose,
    "",
    "## No Duplicate Work Rule",
    "",
    payload.no_duplicate_work_rule,
    "",
    "## n8n",
    "",
    `Source: ${payload.workflows.n8n.source}`,
    `Endpoint: ${payload.workflows.n8n.endpoint}`,
    `n8n import JSON: ${payload.workflows.n8n.import_url}`,
    "",
    fencedJson(payload.workflows.n8n.workflow),
    "",
    "## Zapier",
    "",
    `Source: ${payload.workflows.zapier.source}`,
    `Endpoint: ${payload.workflows.zapier.endpoint}`,
    "",
    fencedJson(payload.workflows.zapier.steps),
    "",
    "## Pipedream",
    "",
    `Source: ${payload.workflows.pipedream.source}`,
    `Endpoint: ${payload.workflows.pipedream.endpoint}`,
    "",
    "```ts",
    payload.workflows.pipedream.code,
    "```",
    "",
    "## Success Gate",
    "",
    payload.success_gate,
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
  ].join("\n");
}

export function mcpAutomationWorkflowsHtml(runtime: WorkflowGalleryRuntime): string {
  const payload = mcpAutomationWorkflowsPayload(runtime);
  return htmlShell(
    "Packrift MCP Automation Workflows",
    payload.purpose,
    `<header>
      <h1>Packrift MCP Automation Workflows</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.runtime.tools_count} tools</span>
        <span>${payload.runtime.resources_count} resources</span>
        <span>no duplicate CLI</span>
      </div>
      <div class="links">
        <a class="button primary" href="${escapeHtml(payload.workflows.n8n.import_url)}">n8n import JSON</a>
        <a class="button" href="https://mcp.packrift.com/ai/mcp-automation-workflows.json">JSON pack</a>
        <a class="button" href="https://mcp.packrift.com/ai/mcp-workflow-gallery.html">Workflow gallery</a>
        <a class="button" href="${escapeHtml(payload.proof_urls.source_activation_queue)}">Source queue</a>
      </div>
    </header>
    <section>
      <h2>No Duplicate Work Rule</h2>
      <div class="rules"><p>${escapeHtml(payload.no_duplicate_work_rule)}</p></div>
    </section>
    <section>
      <h2>n8n Import</h2>
      <div class="workflow">
        <p>Import this JSON into n8n, then run the manual trigger from a real external n8n environment.</p>
        <pre>${escapeHtml(JSON.stringify(payload.workflows.n8n.workflow, null, 2))}</pre>
      </div>
    </section>
    <section>
      <h2>Zapier Webhooks Steps</h2>
      <div class="workflow"><pre>${escapeHtml(JSON.stringify(payload.workflows.zapier.steps, null, 2))}</pre></div>
    </section>
    <section>
      <h2>Pipedream Code</h2>
      <div class="workflow"><pre>${escapeHtml(payload.workflows.pipedream.code)}</pre></div>
    </section>
    <section>
      <h2>Success Gate</h2>
      <div class="rules"><p>${escapeHtml(payload.success_gate)}</p></div>
    </section>`
  );
}

export function mcpWorkflowGalleryPayload(runtime: WorkflowGalleryRuntime) {
  return {
    release: "PACKRIFT-MCP-WORKFLOW-GALLERY-R02",
    generated_at: new Date().toISOString(),
    canonical_endpoint: MCP_ENDPOINT,
    purpose:
      "Give external agents, developers, marketplaces, and AI-commerce workflow builders copy-ready buyer prompts and JSON-RPC sequences that drive real Packrift MCP usage without creating a duplicate CLI or storefront.",
    runtime: {
      server_version: runtime.serverVersion,
      tools_count: runtime.toolsCount,
      resources_count: runtime.resourcesCount,
      prompts_count: runtime.promptsCount,
    },
    install_config: {
      mcpServers: {
        packrift: {
          type: "http",
          url: MCP_ENDPOINT,
        },
      },
    },
    workflow_count: WORKFLOWS.length,
    workflows: WORKFLOWS,
    agent_host_uses: [
      "turn each workflow into an eval case",
      "use exact_sku_reorder_1066 as the first demo after install",
      "use no_exact_match_quote_recovery to test safety behavior",
      "use fit_item_then_confirm when the buyer does not know the Packrift SKU",
      "record create_cart_url output as MCP-attributed conversion handoff",
    ],
    proof_urls: {
      automation_workflows: "https://mcp.packrift.com/ai/mcp-automation-workflows.json",
      n8n_workflow_import: "https://mcp.packrift.com/ai/mcp-n8n-workflow.json",
      first_run_proof: "https://mcp.packrift.com/ai/mcp-first-run-proof.json",
      adoption_kit: "https://mcp.packrift.com/ai/mcp-adoption-kit.json",
      install_matrix: "https://mcp.packrift.com/ai/mcp-install-matrix.json",
      cart_activation: "https://mcp.packrift.com/ai/mcp-cart-activation.json",
      buyer_use_cases: "https://mcp.packrift.com/ai/mcp-buyer-use-cases.json",
      usage_snapshot: "https://mcp.packrift.com/ai/mcp-usage-snapshot.json",
      cart_handoff_candidates: "https://mcp.packrift.com/ai/mcp-cart-handoff-candidates.json",
      all_agent_capture: "https://mcp.packrift.com/ai/all-agent-capture.json",
    },
    operating_rules: [
      "Use https://mcp.packrift.com/mcp as the runtime endpoint.",
      "Do not build a separate Packrift CLI or duplicate buyer surface for these workflows.",
      "Always confirm exact SKU, live price, live inventory, and buyer-selected quantity before cart handoff.",
      "Use the MCP /r/cart URL returned by create_cart_url as the primary measured handoff.",
      "If any required spec differs, explain no exact match and use quote recovery instead of forcing a substitute.",
    ],
    automation_templates: mcpAutomationWorkflowsPayload(runtime).workflows,
  };
}

function fencedJson(value: unknown): string {
  return ["```json", JSON.stringify(value, null, 2), "```"].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlShell(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    :root{color-scheme:light;--ink:#17211d;--muted:#596a63;--line:#d7ded8;--paper:#f7f8f5;--panel:#fff;--green:#0f6b4f;--blue:#245f9b}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    main{max-width:1160px;margin:0 auto;padding:32px 18px 56px}
    header{display:grid;gap:14px;padding-bottom:22px;border-bottom:1px solid var(--line)}
    h1{margin:0;font-size:clamp(2rem,5vw,4.2rem);line-height:.98;letter-spacing:0}
    h2{margin:28px 0 10px;font-size:1.2rem;letter-spacing:0}
    h3{margin:0 0 6px;font-size:1.02rem;letter-spacing:0}
    p{margin:0;color:var(--muted);max-width:880px}
    a{color:var(--blue);text-decoration-thickness:1px;text-underline-offset:3px}
    .status,.links,.uses{display:flex;flex-wrap:wrap;gap:8px}
    .status span,.uses span{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:6px 10px;font-size:.9rem;color:var(--muted)}
    .workflow,.rules,.config{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:15px}
    .workflows{display:grid;gap:14px;margin-top:14px}
    ul{margin:8px 0 0;padding-left:20px;color:var(--muted)}
    li{margin:5px 0}
    code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    pre{white-space:pre-wrap;overflow:auto;border:1px solid var(--line);border-radius:6px;background:#f9faf8;padding:12px;color:var(--ink);font-size:.88rem}
    .button{display:inline-flex;align-items:center;min-height:38px;border:1px solid var(--ink);border-radius:6px;padding:8px 11px;text-decoration:none;color:var(--ink);background:var(--panel);font-weight:650}
    .button.primary{background:var(--green);border-color:var(--green);color:#fff}
    @media (max-width:680px){.button{width:100%;justify-content:center}}
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

export function mcpWorkflowGalleryMarkdown(runtime: WorkflowGalleryRuntime): string {
  const payload = mcpWorkflowGalleryPayload(runtime);
  const rows = payload.workflows
    .map(
      (workflow) =>
        `| ${workflow.id} | ${escapeMarkdown(workflow.title)} | ${escapeMarkdown(workflow.audience)} | ${workflow.sequence.length} |`
    )
    .join("\n");
  return [
    "# Packrift MCP Workflow Gallery",
    "",
    `Release: ${payload.release}`,
    `Generated: ${payload.generated_at}`,
    `Canonical endpoint: ${payload.canonical_endpoint}`,
    "",
    "## Purpose",
    "",
    payload.purpose,
    "",
    "## Install Config",
    "",
    fencedJson(payload.install_config),
    "",
    "## Workflows",
    "",
    "| ID | Workflow | Audience | Steps |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    ...payload.workflows.flatMap((workflow) => [
      `## ${workflow.title}`,
      "",
      `ID: ${workflow.id}`,
      `Buyer prompt: ${workflow.buyer_prompt}`,
      `Success outcome: ${workflow.success_outcome}`,
      "",
      "JSON-RPC sequence:",
      "",
      fencedJson(workflow.sequence),
      "",
      "Expected checks:",
      workflow.expected_checks.map((check) => `- ${check}`).join("\n"),
      "",
    ]),
    "## Agent Host Uses",
    "",
    payload.agent_host_uses.map((use) => `- ${use}`).join("\n"),
    "",
    "## Operating Rules",
    "",
    payload.operating_rules.map((rule) => `- ${rule}`).join("\n"),
    "",
    "## Automation Templates",
    "",
    `- n8n import JSON: ${payload.proof_urls.n8n_workflow_import}`,
    `- automation workflow pack: ${payload.proof_urls.automation_workflows}`,
    "- Zapier Webhooks-by-Zapier steps and Pipedream code are included in the machine-readable workflow gallery.",
    "",
    "## Proof URLs",
    "",
    Object.entries(payload.proof_urls)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n"),
    "",
    "Machine-readable version: https://mcp.packrift.com/ai/mcp-workflow-gallery.json",
    "",
  ].join("\n");
}

export function mcpWorkflowGalleryHtml(runtime: WorkflowGalleryRuntime): string {
  const payload = mcpWorkflowGalleryPayload(runtime);
  const workflows = payload.workflows
    .map(
      (workflow) => `<article class="workflow">
        <h3>${escapeHtml(workflow.title)}</h3>
        <p><strong>ID:</strong> ${escapeHtml(workflow.id)}</p>
        <p>${escapeHtml(workflow.audience)}</p>
        <p><strong>Buyer prompt:</strong> ${escapeHtml(workflow.buyer_prompt)}</p>
        <p><strong>Success outcome:</strong> ${escapeHtml(workflow.success_outcome)}</p>
        <pre>${escapeHtml(JSON.stringify(workflow.sequence, null, 2))}</pre>
        <ul>${workflow.expected_checks.map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul>
      </article>`
    )
    .join("");
  const links = ([
    ["Start MCP", "https://mcp.packrift.com/start"],
    ["Endpoint", payload.canonical_endpoint],
    ["Buyer use cases", payload.proof_urls.buyer_use_cases.replace(".json", ".html")],
    ["Cart activation", payload.proof_urls.cart_activation.replace(".json", ".html")],
    ["Automation workflows", payload.proof_urls.automation_workflows.replace(".json", ".html")],
    ["Adoption progress", "https://mcp.packrift.com/ai/mcp-agent-adoption-progress.html"],
    ["Eval pack", "https://mcp.packrift.com/ai/mcp-eval-pack.json"],
  ] satisfies Array<[string, string]>)
    .map(([label, url], index) => `<a class="button${index === 0 ? " primary" : ""}" href="${escapeHtml(url)}">${escapeHtml(label)}</a>`)
    .join("");
  return htmlShell(
    "Packrift MCP Workflow Gallery",
    payload.purpose,
    `<header>
      <h1>Packrift MCP Workflow Gallery</h1>
      <p>${escapeHtml(payload.purpose)}</p>
      <div class="status">
        <span>${escapeHtml(payload.release)}</span>
        <span>${payload.workflow_count} workflows</span>
        <span>${payload.runtime.tools_count} tools</span>
        <span>${payload.runtime.resources_count} resources</span>
      </div>
      <div class="links">${links}</div>
    </header>
    <section>
      <h2>Install Config</h2>
      <div class="config"><pre>${escapeHtml(JSON.stringify(payload.install_config, null, 2))}</pre></div>
    </section>
    <section>
      <h2>Workflows</h2>
      <div class="workflows">${workflows}</div>
    </section>
    <section>
      <h2>Agent Host Uses</h2>
      <div class="uses">${payload.agent_host_uses.map((use) => `<span>${escapeHtml(use)}</span>`).join("")}</div>
    </section>
    <section>
      <h2>Automation Templates</h2>
      <div class="rules">
        <p>Import the n8n workflow directly, or use the JSON workflow pack for Zapier and Pipedream-style hosts.</p>
        <div class="links">
          <a class="button primary" href="${escapeHtml(payload.proof_urls.n8n_workflow_import)}">n8n import JSON</a>
          <a class="button" href="${escapeHtml(payload.proof_urls.automation_workflows)}">Automation workflow pack</a>
        </div>
      </div>
    </section>
    <section>
      <h2>Operating Rules</h2>
      <div class="rules"><ul>${payload.operating_rules.map((rule) => `<li>${escapeHtml(rule)}</li>`).join("")}</ul></div>
    </section>`
  );
}
