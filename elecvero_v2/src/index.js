const TIERS = [
  { min: 100000, rate: 0.15 },
  { min: 50000, rate: 0.125 },
  { min: 25000, rate: 0.10 },
  { min: 10000, rate: 0.075 },
  { min: 0, rate: 0.05 }
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "Content-Type"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS }
  });

const discountRate = (subtotal) =>
  TIERS.find((tier) => subtotal >= tier.min)?.rate ?? 0.05;

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    sku: String(item.sku || "").trim(),
    packs: Math.max(1, Math.floor(Number(item.packs || 1)))
  })).filter((item) => item.sku);
}

async function getProducts(env, url) {
  if (env.DB) {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const category = (url.searchParams.get("category") || "").trim();
    let rows;
    if (category) {
      rows = await env.DB.prepare(
        `SELECT sku, category, name, description, unit, mrp, pack_qty, trade_min_price, image, catalogue_page
         FROM products WHERE category = ? ORDER BY name`
      ).bind(category).all();
    } else {
      rows = await env.DB.prepare(
        `SELECT sku, category, name, description, unit, mrp, pack_qty, trade_min_price, image, catalogue_page
         FROM products ORDER BY id`
      ).all();
    }
    let products = rows.results || [];
    if (q) {
      products = products.filter((p) =>
        `${p.name} ${p.description || ""} ${p.sku} ${p.category}`.toLowerCase().includes(q)
      );
    }
    return products;
  }

  const response = await env.ASSETS.fetch(
    new Request("https://assets.local/assets/products.json")
  );
  if (!response.ok) throw new Error("Product catalogue unavailable");
  const products = await response.json();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const category = (url.searchParams.get("category") || "").trim();
  return products.filter((p) => {
    const haystack = `${p.name} ${p.description || ""} ${p.sku} ${p.category}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!category || p.category === category);
  });
}

async function buildQuote(env, items) {
  const all = await getProducts(env, new URL("https://api.local/api/products"));
  const map = new Map(all.map((p) => [p.sku, p]));
  const lines = [];

  for (const item of normalizeItems(items)) {
    const p = map.get(item.sku);
    if (!p || p.mrp == null) continue;
    const packQty = Number.parseInt(p.pack_qty, 10);
    const unitsPerPack = Number.isFinite(packQty) && packQty > 0 ? packQty : 1;
    const qtyUnits = item.packs * unitsPerPack;
    const lineTotal = Number(p.mrp) * qtyUnits;
    lines.push({
      sku: p.sku,
      name: p.name,
      packs: item.packs,
      units_per_pack: unitsPerPack,
      qty_units: qtyUnits,
      unit_price: Number(p.mrp),
      line_total: lineTotal
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.line_total, 0);
  const rate = discountRate(subtotal);
  const discount = subtotal * rate;
  return {
    items: lines,
    subtotal,
    discount_rate: rate,
    discount_amount: discount,
    total: subtotal - discount
  };
}

async function api(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    if (url.pathname === "/api/health" && request.method === "GET") {
      let productCount = null;
      if (env.DB) {
        const r = await env.DB.prepare("SELECT COUNT(*) AS count FROM products").first();
        productCount = Number(r?.count || 0);
      }
      return json({
        ok: true,
        service: "ELECVERO B2B API",
        database: Boolean(env.DB),
        product_count: productCount,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/products" && request.method === "GET") {
      const products = await getProducts(env, url);
      return json({ count: products.length, products });
    }

    if (url.pathname === "/api/categories" && request.method === "GET") {
      if (!env.DB) return json({ categories: [] });
      const r = await env.DB.prepare(
        "SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY category"
      ).all();
      return json({ categories: r.results || [] });
    }

    if (url.pathname === "/api/serviceability" && request.method === "GET") {
      const pin = (url.searchParams.get("pin") || "").trim();
      if (!/^\d{6}$/.test(pin)) return json({ ok: false, status: "invalid", error: "Enter a valid 6-digit PIN code." }, 400);
      // Actual delivery coverage is intentionally not guessed. Configure the courier/serviceable PIN list before returning a hard yes/no.
      const configured = String(env.SERVICEABLE_PINCODES || "").split(",").map(x => x.trim()).filter(Boolean);
      if (configured.length) return json({ ok: true, pin, status: configured.includes(pin) ? "serviceable" : "not_serviceable" });
      return json({ ok: true, pin, status: "pending", message: "Serviceability coverage is not configured yet." });
    }

    if (url.pathname === "/api/quote" && request.method === "POST") {
      const body = await request.json();
      return json(await buildQuote(env, body.items));
    }

    if (url.pathname === "/api/account" && request.method === "POST") {
      if (!env.DB) return json({ ok: false, error: "D1 database is not configured yet." }, 503);
      const body = await request.json();
      const business = String(body.business_name || "").trim();
      const contact = String(body.contact_name || "").trim();
      const phone = String(body.phone || "").trim();
      if (!business || !phone) {
        return json({ ok: false, error: "Business name and mobile number are required." }, 400);
      }
      const r = await env.DB.prepare(
        `INSERT INTO customers (business_name, contact_name, phone, email, city, gstin, buying_need)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        business, contact, phone,
        String(body.email || "").trim(),
        String(body.city || "").trim(),
        String(body.gstin || "").trim(),
        String(body.buying_need || "").trim() + (body.pincode ? `\nDelivery PIN: ${String(body.pincode).trim()}` : "")
      ).run();
      return json({ ok: true, customer_id: r.meta.last_row_id });
    }

    if (url.pathname === "/api/orders" && request.method === "POST") {
      if (!env.DB) return json({ ok: false, error: "D1 database is not configured yet." }, 503);
      const body = await request.json();
      const customer = body.customer || {};
      const quote = await buildQuote(env, body.items);
      if (!quote.items.length) return json({ ok: false, error: "No valid priced products in the basket." }, 400);

      const cr = await env.DB.prepare(
        `INSERT INTO customers (business_name, contact_name, phone, email, city, gstin, buying_need)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        String(customer.business_name || "Website Customer"),
        String(customer.contact_name || ""),
        String(customer.phone || ""),
        String(customer.email || ""),
        String(customer.city || ""),
        String(customer.gstin || ""),
        String(customer.buying_need || "") + (customer.pincode ? `\nDelivery PIN: ${String(customer.pincode).trim()}` : "")
      ).run();

      const customerId = cr.meta.last_row_id;
      const orderRef = `EV-${Date.now().toString(36).toUpperCase()}`;
      const order = await env.DB.prepare(
        `INSERT INTO orders (order_ref, customer_id, subtotal, discount_rate, discount_amount, total)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        orderRef, customerId, quote.subtotal, quote.discount_rate,
        quote.discount_amount, quote.total
      ).run();

      const orderId = order.meta.last_row_id;
      for (const line of quote.items) {
        await env.DB.prepare(
          `INSERT INTO order_items
           (order_id, sku, product_name, packs, units_per_pack, qty_units, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          orderId, line.sku, line.name, line.packs, line.units_per_pack,
          line.qty_units, line.unit_price, line.line_total
        ).run();
      }

      return json({
        ok: true,
        order_ref: orderRef,
        ...quote
      });
    }

    return json({ ok: false, error: "API route not found." }, 404);
  } catch (error) {
    return json({ ok: false, error: error?.message || "Server error" }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    return env.ASSETS.fetch(request);
  }
};
