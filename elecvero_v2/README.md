# ELECVERO Dynamic B2B Website — Final Build

This is the consolidated, portable ELECVERO storefront and backend.

## What is included
- 481 catalogue SKUs
- 29 categories
- customer-facing ELECVERO SKU system
- 434+ product image copies using ELECVERO SKU-based filenames
- Cloudflare Worker API
- Cloudflare D1 schema + full product seed migration
- search/filter/category UI
- pack-aware B2B basket
- 5–15% basket discount ladder
- business account capture
- order-request capture
- WhatsApp ordering
- terms/privacy/shipping pages
- source catalogue and design reference
- internal product master and image mapping

## Important data rule
The supplied catalogue remains the source of truth. Unsupported MRP or pack values are not invented.

The internal product master retains source codes for traceability, but the public API and customer UI do not return source D-xxxx codes.

## Architecture
Browser → Cloudflare Worker → D1
                      ↘ future Razorpay
                      ↘ future Zoho Inventory
                      ↘ future Zoho Books
                      ↘ future shipping

## Deployment
See `PROJECT_SPEC/DEPLOYMENT.md`.

## Existing source material
- `source/Dhiraj Catalogue New Rate 2026.pdf`
- `source/design-reference.png`
- `data_ELECVERO_PRODUCT_MASTER_INTERNAL.csv`
- `data_ELECVERO_Master_Product_Image_Mapping.xlsx`

## Current status
This package is the clean implementation target. Do not use the previous broken Worker deployment as the source of truth.


## Lead capture and delivery PIN
The storefront now opens a delivery PIN check on first visit, followed by a dealer/business registration prompt. The dealer prompt repeats every 30 seconds until a business account request is successfully submitted.

The `/api/serviceability?pin=XXXXXX` endpoint validates the PIN format and supports an optional `SERVICEABLE_PINCODES` Worker variable for an explicit comma-separated coverage list. Until that list is configured from the actual courier/delivery coverage, the UI reports that delivery coverage will be confirmed rather than falsely claiming a PIN is serviceable.

Support email is linked with `mailto:support@elecvero.in`.
