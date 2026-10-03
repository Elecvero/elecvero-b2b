# ELECVERO B2B QuickSense-style V1

This package rebuilds the supplied January 2026 catalogue into an ELECVERO-owned SKU system. Source/manufacturer codes are retained only in the master CSV for internal traceability; customer-facing cards use new EV-XXX-### SKUs.

## Important product-data rule
The catalogue was treated as the source of truth. Where the source did not publish an MRP or pack quantity, the website shows Price on request / — rather than inventing a value.

## Zoho readiness
`ELECVERO_PRODUCT_MASTER.csv` is the starting point for later Zoho Inventory/Books import and source-code mapping.

## Launch notes
- Online payment is not claimed as live.
- GST details are not claimed as configured.
- Live stock is not claimed until Zoho Inventory is connected.
- WhatsApp ordering uses +91 72086 83604.
- Business email: support@elecvero.in
