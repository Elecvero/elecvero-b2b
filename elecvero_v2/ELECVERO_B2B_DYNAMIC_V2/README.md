# ELECVERO B2B Dynamic V2

Cloudflare Worker + static assets + D1-ready backend.

Server routes: GET /api/health, GET /api/products, POST /api/quote, POST /api/orders.

Deployment:
1. Create Cloudflare D1 database `elecvero-db`.
2. Put its database ID in `wrangler.toml` instead of `REPLACE_WITH_D1_DATABASE_ID`.
3. Install Node.js LTS.
4. In this folder run `npx wrangler login`.
5. Run `npx wrangler d1 migrations apply elecvero-db --remote`.
6. Run `npx wrangler deploy`.
7. Test `https://<your-worker>.workers.dev/api/health`.
8. After it works, add `elecvero.in` as the Worker custom domain/route.

Not yet connected: Razorpay server-side orders, Zoho Inventory, Zoho Books, dealer authentication and live stock. Those should be added after the base Worker + D1 deployment is working.
