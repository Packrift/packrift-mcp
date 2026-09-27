# Muse connector

Connector endpoint with Muse source attribution:

```text
https://mcp.packrift.com/mcp?mcp_source=muse
```

The official [Muse Connector Platform](https://muse.ai/platform) submission form offers an existing MCP connection or raw API and a no-authentication option. Packrift's public catalog MCP endpoint does not require buyer credentials. The Packrift submission is pending review; it is not an approved directory listing.

Muse source context sets `utm_source=muse` on the cart landing, Shopify cart permalink, and cart attributes. Existing callers retain their attribution. Product approval gates, commercial holds and buyer confirmation still apply. The connector does not place orders; Shopify checkout determines final price, discounts, shipping and tax.

Offline attribution checks:

```sh
npm run build
node --test scripts/test-muse-attribution.mjs
```
