/**
 * Builds WhatsApp (wa.me) links and the pre-filled enquiry messages.
 * Pure functions: no DOM access, so they can be unit-tested in Node.
 */
import { CONFIG } from "./products.js";

export const NOT_SURE = "Not sure, need help";

/** "₹1,499" — Indian digit grouping via the configured locale. */
export function formatPrice(amount, config = CONFIG) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "Price on request";
  const n = new Intl.NumberFormat(config.locale, { maximumFractionDigits: 0 }).format(amount);
  return `${config.currency}${n}`;
}

/** True when the number is digits only with a plausible length (country code + number). */
export function isValidNumber(number) {
  return typeof number === "string" && /^\d{8,15}$/.test(number);
}

/**
 * The page address used inside messages: CONFIG.siteUrl when set,
 * otherwise the current page without its #hash or ?query.
 */
export function pageUrl(config = CONFIG, loc = globalThis.location) {
  if (config.siteUrl) return config.siteUrl.split("#")[0];
  if (!loc || !loc.origin || loc.origin === "null") return "";
  return loc.origin + loc.pathname;
}

/** wa.me link with the message URL-encoded. */
export function waLink(message, number = CONFIG.whatsappNumber) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Message for one product with the visitor's chosen colour and size. */
export function productMessage(product, { color, size }, config = CONFIG, url = pageUrl(config)) {
  const needsHelp = size === NOT_SURE;
  return [
    `Hi ${config.storeName} 👋`,
    `I'd like to enquire about this product:`,
    ``,
    `👔 *${product.name}*`,
    `Code: ${product.code}`,
    `Category: ${product.category}`,
    `Price: ${formatPrice(product.price, config)}`,
    `Colour: ${color}`,
    `Size: ${size}`,
    `Fit: ${product.fit}`,
    ``,
    `🔗 ${url}#product-${product.id}`,
    needsHelp ? `Could you help me pick the right size?` : `Is it available in my size?`,
  ].join("\n");
}

/**
 * Message for a whole "Shop the Look" outfit.
 * items: [{ product, color }]
 */
export function lookMessage(look, items, config = CONFIG, url = pageUrl(config)) {
  const total = items.reduce((sum, it) => sum + (Number(it.product.price) || 0), 0);
  const lines = items.map(
    (it, i) =>
      `${i + 1}. *${it.product.name}* (${it.product.code}) · ${it.color} · ${formatPrice(it.product.price, config)}`
  );
  return [
    `Hi ${config.storeName} 👋`,
    `I'd like to enquire about this look: *${look.name}*`,
    ``,
    ...lines,
    ``,
    `Total: ${formatPrice(total, config)}`,
    `🔗 ${url}#look-${look.id}`,
    `Could you help me with sizes and availability?`,
  ].join("\n");
}

/** Message for the floating "general enquiry" button. */
export function generalMessage(config = CONFIG) {
  return `Hi ${config.storeName}, I have a question about your collection.`;
}

/** "+91 70109 63146" for display. */
export function formatPhone(number = CONFIG.whatsappNumber) {
  const d = String(number);
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
