export const PACKRIFT_GA4_MEASUREMENT_ID = "G-HPMNFWG4DV";
export const MCP_PAGE_ANALYTICS_RELEASE = "PACKRIFT-MCP-PAGE-ANALYTICS-R02";

interface PackriftMcpGa4HeadScriptOptions {
  pageType: string;
  source?: string | null;
  target?: string | null;
  utmCampaign?: string | null;
  forceQualifiedMcpUtm?: boolean;
}

function normalizeAnalyticsToken(value: string | null | undefined, fallback: string): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
  return normalized || fallback;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function packriftMcpGa4HeadScript(options: PackriftMcpGa4HeadScriptOptions): string {
  const pageType = normalizeAnalyticsToken(options.pageType, "mcp_page");
  const source = normalizeAnalyticsToken(options.source, "generic");
  const target = normalizeAnalyticsToken(options.target, "generic_streamable_http");
  const utmCampaign = normalizeAnalyticsToken(options.utmCampaign, pageType);
  const analyticsPayload = {
    release: MCP_PAGE_ANALYTICS_RELEASE,
    page_type: pageType,
    source,
    target,
    mcp_source_context: source,
    mcp_install_target: target,
  };
  const qualifiedMcpQuery = options.forceQualifiedMcpUtm
    ? new URLSearchParams({
        utm_source: "chatgpt-mcp",
        utm_medium: "mcp_tool",
        utm_campaign: utmCampaign,
        utm_content: source,
        mcp_source_context: source,
        mcp_install_target: target,
      }).toString()
    : "";

  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${PACKRIFT_GA4_MEASUREMENT_ID}"></script>
  <script>
    (function () {
      var analyticsPayload = ${scriptJson(analyticsPayload)};
      var qualifiedMcpQuery = ${scriptJson(qualifiedMcpQuery)};
      if (qualifiedMcpQuery) {
        try {
          var currentUrl = new URL(window.location.href);
          var changed = false;
          new URLSearchParams(qualifiedMcpQuery).forEach(function (value, key) {
            var existing = currentUrl.searchParams.get(key);
            if (key.indexOf("utm_") === 0 && existing && existing !== value && !currentUrl.searchParams.has("packrift_original_" + key)) {
              currentUrl.searchParams.set("packrift_original_" + key, existing);
            }
            if (existing !== value) {
              currentUrl.searchParams.set(key, value);
              changed = true;
            }
          });
          if (changed) window.history.replaceState(window.history.state, "", currentUrl.toString());
        } catch (error) {}
      }
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", "${PACKRIFT_GA4_MEASUREMENT_ID}", {
        send_page_view: true,
        transport_type: "beacon",
        page_location: window.location.href,
        page_path: window.location.pathname + window.location.search,
        page_title: document.title
      });
      window.gtag("event", "packrift_mcp_page_view", {
        transport_type: "beacon",
        page_location: window.location.href,
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
        page_type: analyticsPayload.page_type,
        source: analyticsPayload.source,
        target: analyticsPayload.target,
        mcp_source_context: analyticsPayload.mcp_source_context,
        mcp_install_target: analyticsPayload.mcp_install_target,
        release: analyticsPayload.release
      });
    })();
  </script>`;
}
