/**
 * Checks products.js for common editing mistakes.
 * Problems are reported as console warnings; products that would break the
 * page (no id, colours or sizes) are left out instead of crashing the site.
 */
import { GARMENT_TYPES } from "./flats.js";
import { isValidNumber } from "./whatsapp.js";

const REQUIRED = ["id", "code", "name", "category", "fabric", "fit", "description", "garmentType"];

export function validateCatalog(products, config) {
  const problems = [];
  const usable = [];
  const ids = new Set();
  const codes = new Set();

  if (!isValidNumber(config.whatsappNumber)) {
    problems.push(
      `CONFIG.whatsappNumber "${config.whatsappNumber}" must be digits only with the country code, e.g. 919876543210.`
    );
  }

  products.forEach((p, i) => {
    const where = `Product ${i + 1} (${(p && (p.name || p.id)) || "unnamed"})`;
    let fatal = false;
    if (!p || typeof p !== "object") {
      problems.push(`${where}: not an object.`);
      return;
    }
    for (const k of REQUIRED) {
      if (!p[k]) {
        problems.push(`${where}: missing "${k}".`);
        if (k === "id") fatal = true;
      }
    }
    if (p.id && ids.has(p.id)) {
      problems.push(`${where}: id "${p.id}" is used twice. Each product needs its own id.`);
      fatal = true;
    }
    if (p.code && codes.has(p.code)) problems.push(`${where}: code "${p.code}" is used twice.`);
    if (p.id && !/^[a-z0-9-]+$/.test(p.id)) problems.push(`${where}: id should use only a-z, 0-9 and "-".`);
    if (!(typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0)) {
      problems.push(`${where}: price should be a plain number, e.g. 499 (no ₹ sign, no quotes).`);
    }
    if (!Array.isArray(p.colors) || !p.colors.length) {
      problems.push(`${where}: needs at least one colour.`);
      fatal = true;
    } else {
      p.colors.forEach((c) => {
        if (!c || !c.name || !/^#[0-9a-f]{6}$/i.test(c.hex || "")) {
          problems.push(`${where}: colour ${JSON.stringify(c)} needs a name and a 6-digit hex like "#1F2B48".`);
          fatal = true;
        }
      });
    }
    if (!Array.isArray(p.sizes) || !p.sizes.length) {
      problems.push(`${where}: needs a list of sizes.`);
      fatal = true;
    }
    if (p.garmentType && !GARMENT_TYPES.includes(p.garmentType)) {
      problems.push(`${where}: garmentType "${p.garmentType}" is not one of ${GARMENT_TYPES.join(", ")}. Using "shirt".`);
    }
    if (p.id) ids.add(p.id);
    if (p.code) codes.add(p.code);
    if (!fatal) usable.push(p);
  });

  return { problems, usable };
}
