# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
LABEL io.modelcontextprotocol.server.name="io.github.Packrift/packrift-mcp"
ENV NODE_ENV=production
ENV PORT=8787
ENV SHOPIFY_STORE_DOMAIN=packrift.myshopify.com
ENV SHOPIFY_API_VERSION=2025-04
ENV STOREFRONT_DOMAIN=packrift.com
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/node.js"]
