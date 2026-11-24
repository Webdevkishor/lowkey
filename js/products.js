/**
 * LOWKEY — store settings and product data.
 *
 * This is the only file you need to edit day to day.
 * See README.md for step-by-step help.
 */

/* ------------------------------------------------------------------ */
/* 1. STORE SETTINGS                                                   */
/* ------------------------------------------------------------------ */
export const CONFIG = {
  storeName: "LOWKEY Menswear",
  brand: "LOWKEY", // short name printed on tags, labels and the logo

  // Country code + number, digits only. No "+", spaces or dashes.
  whatsappNumber: "917010963146",

  currency: "₹",
  currencyCode: "INR", // used for Google product data
  locale: "en-IN", // number format: ₹1,499 / ₹1,50,000

  tagline: "Built to be worn in.",

  address: "Mudichur, Chennai",
  locality: "Mudichur",
  region: "Tamil Nadu",
  country: "IN",
  hours: "Open daily · 9 AM – 9 PM",
  opens: "09:00", // 24-hour time, used for Google business data
  closes: "21:00",

  // Your Instagram handle without the @, e.g. "lowkey.menswear".
  // Leave empty ("") to hide the Instagram link.
  instagram: "",

  // Optional: your live website address, e.g. "https://lowkey-menswear.netlify.app/".
  // Used for the product link inside WhatsApp messages.
  // Leave empty to use whatever address the page was opened from.
  siteUrl: "",
};

/* ------------------------------------------------------------------ */
/* 2. SIZE SETS                                                        */
/* ------------------------------------------------------------------ */
export const TOP_SIZES = ["S", "M", "L", "XL", "XXL"];
export const WAIST_SIZES = ["28", "30", "32", "34", "36", "38"]; // waist, inches

/* ------------------------------------------------------------------ */
/* 3. PRODUCTS                                                         */
/*                                                                     */
/* To add a product: copy one block, change the values, keep the id    */
/* and code unique. The order here is the order on the site.           */
/*                                                                     */
/* garmentType decides the drawing and the 3D shape. Pick one of:      */
/*   "shirt", "formal-shirt", "overshirt", "camp-shirt",               */
/*   "jeans", "carpenter-jeans", "tee", "graphic-tee"                  */
/*                                                                     */
/* image: leave "" until you have a photo. Then put the photo in       */
/*   assets/products/ and write its path, e.g.                         */
/*   image: "assets/products/LM-SH-01.jpg"                             */
/*                                                                     */
/* colors: hex is the main colour. For a check pattern add             */
/*   hex2 (the second colour) and pattern: "check".                    */
/* ------------------------------------------------------------------ */
export const PRODUCTS = [
  /* ---------- SHIRTS ---------- */
  {
    id: "oxford-shirt",
    code: "LM-SH-01",
    name: "Oxford Button-Down Shirt",
    category: "Shirts",
    price: 499,
    colors: [
      { name: "Pale Blue", hex: "#A9C3DC" },
      { name: "White", hex: "#F1EFE9" },
    ],
    sizes: TOP_SIZES,
    fabric: "Cotton Oxford",
    fit: "Regular",
    description:
      "The shirt that does everything. Soft cotton Oxford and a button-down collar, in a regular fit that works tucked in or worn loose.",
    image: "",
    garmentType: "shirt",
  },
  {
    id: "linen-camp-shirt",
    code: "LM-SH-02",
    name: "Linen Camp-Collar Shirt",
    category: "Shirts",
    price: 499,
    colors: [
      { name: "Sand", hex: "#CDB797" },
      { name: "Olive", hex: "#6B6A45" },
    ],
    sizes: TOP_SIZES,
    fabric: "Linen blend",
    fit: "Relaxed",
    description:
      "Made for warm days. A linen blend with an open camp collar and an easy, relaxed drape. Wear it open over a tee or buttoned up.",
    image: "",
    garmentType: "camp-shirt",
  },
  {
    id: "flannel-overshirt",
    code: "LM-SH-03",
    name: "Flannel Check Overshirt",
    category: "Shirts",
    price: 499,
    colors: [
      { name: "Red-Black Check", hex: "#9A2A24", hex2: "#1B1A1A", pattern: "check" },
      { name: "Grey Check", hex: "#8E8C88", hex2: "#3A3A3A", pattern: "check" },
    ],
    sizes: TOP_SIZES,
    fabric: "Brushed cotton",
    fit: "Relaxed",
    description:
      "Half shirt, half jacket. Brushed cotton in a bold check, cut relaxed so it layers easily over a tee.",
    image: "",
    garmentType: "overshirt",
  },
  {
    id: "poplin-shirt",
    code: "LM-SH-04",
    name: "Slim Formal Poplin Shirt",
    category: "Shirts",
    price: 499,
    colors: [
      { name: "White", hex: "#F3F2EE" },
      { name: "Black", hex: "#1D1D1F" },
    ],
    sizes: TOP_SIZES,
    fabric: "Cotton poplin",
    fit: "Slim",
    description:
      "Sharp, clean, office-ready. Smooth cotton poplin and a crisp collar, in a slim cut for a close, tailored line.",
    image: "",
    garmentType: "formal-shirt",
  },

  /* ---------- JEANS ---------- */
  {
    id: "indigo-straight-jeans",
    code: "LM-JN-01",
    name: "Dark Indigo Straight Jeans",
    category: "Jeans",
    price: 699,
    colors: [{ name: "Dark Indigo", hex: "#1F2B48" }],
    sizes: WAIST_SIZES,
    fabric: "Denim",
    fit: "Straight",
    description:
      "The everyday blue. Deep indigo denim, straight from hip to hem. Built to be worn in.",
    image: "",
    garmentType: "jeans",
  },
  {
    id: "slim-stretch-jeans",
    code: "LM-JN-02",
    name: "Slim Tapered Stretch Jeans",
    category: "Jeans",
    price: 699,
    colors: [{ name: "Jet Black", hex: "#1E1E21" }],
    sizes: WAIST_SIZES,
    fabric: "Stretch denim",
    fit: "Slim",
    description:
      "Jet black, slim through the thigh and tapered to the ankle. Stretch denim that moves with you.",
    image: "",
    garmentType: "jeans",
  },
  {
    id: "vintage-relaxed-jeans",
    code: "LM-JN-03",
    name: "Relaxed Vintage Wash Jeans",
    category: "Jeans",
    price: 699,
    colors: [{ name: "Light Wash", hex: "#8EA6C1" }],
    sizes: WAIST_SIZES,
    fabric: "Cotton denim",
    fit: "Relaxed",
    description:
      "Light, faded and easy-going. Cotton denim in a vintage wash with a relaxed cut for laid-back days.",
    image: "",
    garmentType: "jeans",
  },
  {
    id: "carpenter-jeans",
    code: "LM-JN-04",
    name: "Carpenter Utility Jeans",
    category: "Jeans",
    price: 699,
    colors: [{ name: "Mid Wash", hex: "#4C6890" }],
    sizes: WAIST_SIZES,
    fabric: "Denim",
    fit: "Loose",
    description:
      "Workwear roots. Mid-wash denim with carpenter details and a loose fit through the leg.",
    image: "",
    garmentType: "carpenter-jeans",
  },

  /* ---------- APPAREL ---------- */
  {
    id: "boxy-tee",
    code: "LM-AP-01",
    name: "Heavyweight Boxy T-Shirt",
    category: "Apparel",
    price: 399,
    colors: [
      { name: "Off-White", hex: "#ECE7DF" },
      { name: "Black", hex: "#1C1C1E" },
    ],
    sizes: TOP_SIZES,
    fabric: "Cotton",
    fit: "Relaxed",
    description:
      "The tee that holds its shape. Heavyweight cotton in a boxy, relaxed cut. Wear it alone or under an overshirt.",
    image: "",
    garmentType: "tee",
  },
  {
    id: "graphic-tee",
    code: "LM-AP-02",
    name: "Graphic Print T-Shirt",
    category: "Apparel",
    price: 399,
    colors: [
      { name: "Black", hex: "#1C1C1E" },
      { name: "Olive", hex: "#5A603F" },
    ],
    sizes: TOP_SIZES,
    fabric: "Cotton",
    fit: "Regular",
    description:
      "Soft cotton with a bold front print. A regular fit that's easy to wear every day.",
    image: "",
    garmentType: "graphic-tee",
  },
];

/* ------------------------------------------------------------------ */
/* 4. SHOP THE LOOK                                                    */
/* Each item points to a product id above, plus the colour to show.    */
/* ------------------------------------------------------------------ */
export const LOOKS = [
  {
    id: "off-duty",
    name: "Off-Duty Layers",
    note: "Heavy tee, check overshirt, dark denim. Weekend, sorted.",
    items: [
      { id: "boxy-tee", color: "Off-White" },
      { id: "flannel-overshirt", color: "Red-Black Check" },
      { id: "indigo-straight-jeans", color: "Dark Indigo" },
    ],
  },
  {
    id: "after-six",
    name: "Sharp After Six",
    note: "Crisp white poplin over jet-black denim. Clean lines, no effort.",
    items: [
      { id: "poplin-shirt", color: "White" },
      { id: "slim-stretch-jeans", color: "Jet Black" },
    ],
  },
];
