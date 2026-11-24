// Run with:  node --experimental-detect-module --test tests/
// (Node 22+ can drop the flag.) No dependencies needed.
import { test } from "node:test";
import assert from "node:assert/strict";

import { CONFIG, PRODUCTS, LOOKS } from "../js/products.js";
import {
  formatPrice,
  formatPhone,
  productMessage,
  lookMessage,
  generalMessage,
  waLink,
  pageUrl,
  isValidNumber,
  NOT_SURE,
} from "../js/whatsapp.js";
import { validateCatalog } from "../js/validate.js";
import { garmentSpec, GARMENT_TYPES } from "../js/flats.js";

const SITE = "https://example.com/";

test("catalogue has no problems and every product is usable", () => {
  const { problems, usable } = validateCatalog(PRODUCTS, CONFIG);
  assert.deepEqual(problems, []);
  assert.equal(usable.length, PRODUCTS.length);
  assert.equal(PRODUCTS.length, 10);
});

test("prices match the agreed price list", () => {
  const byCat = (c) => PRODUCTS.filter((p) => p.category === c).map((p) => p.price);
  assert.deepEqual(byCat("Shirts"), [499, 499, 499, 499]);
  assert.deepEqual(byCat("Jeans"), [699, 699, 699, 699]);
  assert.deepEqual(byCat("Apparel"), [399, 399]);
});

test("sizes: tops S–XXL, jeans waist 28–38", () => {
  for (const p of PRODUCTS) {
    if (p.category === "Jeans") assert.deepEqual(p.sizes, ["28", "30", "32", "34", "36", "38"], p.name);
    else assert.deepEqual(p.sizes, ["S", "M", "L", "XL", "XXL"], p.name);
  }
});

test("every garment type can be drawn", () => {
  for (const type of GARMENT_TYPES) {
    const spec = garmentSpec({ garmentType: type, fit: "Regular" });
    assert.ok(spec.body.startsWith("M"), type);
    assert.ok(spec.bbox.w > 50 && spec.bbox.h > 50, `${type} has a sensible size`);
  }
});

test("prices use Indian formatting", () => {
  assert.equal(formatPrice(499), "₹499");
  assert.equal(formatPrice(1597), "₹1,597");
  assert.equal(formatPrice(150000), "₹1,50,000");
  assert.equal(formatPrice(undefined), "Price on request");
});

test("phone number is valid and displays nicely", () => {
  assert.ok(isValidNumber(CONFIG.whatsappNumber));
  assert.equal(CONFIG.whatsappNumber, "917010963146");
  assert.equal(formatPhone("917010963146"), "+91 70109 63146");
  assert.equal(isValidNumber("+91 70109 63146"), false);
  assert.equal(isValidNumber("91XXXXXXXXXX"), false);
});

test("page URL drops the hash and query", () => {
  assert.equal(pageUrl({ siteUrl: "" }, { origin: "https://a.b", pathname: "/shop/" }), "https://a.b/shop/");
  assert.equal(pageUrl({ siteUrl: "https://lowkey.example/#x" }), "https://lowkey.example/");
  assert.equal(pageUrl({ siteUrl: "" }, { origin: "null", pathname: "/x" }), "");
});

test("product message matches the agreed template", () => {
  const p = PRODUCTS.find((x) => x.id === "oxford-shirt");
  const msg = productMessage(p, { color: "Pale Blue", size: "M" }, CONFIG, SITE);
  assert.equal(
    msg,
    [
      "Hi LOWKEY Menswear 👋",
      "I'd like to enquire about this product:",
      "",
      "👔 *Oxford Button-Down Shirt*",
      "Code: LM-SH-01",
      "Category: Shirts",
      "Price: ₹499",
      "Colour: Pale Blue",
      "Size: M",
      "Fit: Regular",
      "",
      "🔗 https://example.com/#product-oxford-shirt",
      "Is it available in my size?",
    ].join("\n")
  );
  const help = productMessage(p, { color: "White", size: NOT_SURE }, CONFIG, SITE);
  assert.match(help, /Size: Not sure, need help/);
  assert.match(help, /Could you help me pick the right size\?$/);
});

test("every product: wa.me link round-trips exactly (logs a sample link)", () => {
  for (const p of PRODUCTS) {
    const color = p.colors.at(-1).name;
    const size = p.sizes[1];
    const msg = productMessage(p, { color, size }, CONFIG, SITE);
    const link = waLink(msg, CONFIG.whatsappNumber);
    const url = new URL(link);
    assert.equal(url.origin, "https://wa.me");
    assert.equal(url.pathname, "/917010963146");
    assert.equal(url.searchParams.get("text"), msg, p.name);
    for (const part of [p.name, p.code, formatPrice(p.price), color, size, p.fit, `#product-${p.id}`]) {
      assert.ok(msg.includes(part), `${p.name}: message includes ${part}`);
    }
    console.log(`${p.code}  ${link}`);
  }
});

test("look messages list every item with the correct total", () => {
  for (const look of LOOKS) {
    const items = look.items.map((it) => ({ product: PRODUCTS.find((p) => p.id === it.id), color: it.color }));
    assert.ok(items.every((it) => it.product), `${look.name}: all items exist`);
    items.forEach((it) => assert.ok(it.product.colors.some((c) => c.name === it.color), `${look.name}: ${it.color} exists`));
    const msg = lookMessage(look, items, CONFIG, SITE);
    const total = items.reduce((s, it) => s + it.product.price, 0);
    assert.match(msg, new RegExp(`Total: ${formatPrice(total).replace(/[₹,]/g, (c) => `\\${c}`)}`));
    items.forEach((it) => assert.ok(msg.includes(it.product.code)));
    assert.equal(new URL(waLink(msg)).searchParams.get("text"), msg);
  }
});

test("general enquiry message", () => {
  assert.equal(generalMessage(CONFIG), "Hi LOWKEY Menswear, I have a question about your collection.");
});

test("validator catches common editing mistakes", () => {
  const bad = [
    { ...PRODUCTS[0] },
    { ...PRODUCTS[0], code: "LM-XX-99" }, // duplicate id
    { ...PRODUCTS[1], id: "no-colours", code: "LM-XX-98", colors: [] },
    { ...PRODUCTS[2], id: "bad-price", code: "LM-XX-97", price: "₹499" },
  ];
  const { problems, usable } = validateCatalog(bad, { ...CONFIG, whatsappNumber: "+91 70109" });
  assert.ok(problems.some((m) => m.includes("whatsappNumber")));
  assert.ok(problems.some((m) => m.includes("used twice")));
  assert.ok(problems.some((m) => m.includes("at least one colour")));
  assert.ok(problems.some((m) => m.includes("plain number")));
  assert.deepEqual(
    usable.map((p) => p.id),
    ["oxford-shirt", "bad-price"]
  );
});
