# LOWKEY Menswear — 3D showcase site

A static website for LOWKEY Menswear (Mudichur, Chennai). Garments hang on a slowly turning steel rail in a dark tailor's workshop. Tap a piece, choose colour and size, and **Enquire on WhatsApp** opens WhatsApp with the product details already typed in.

- No build step, no backend, no npm install. Plain HTML, CSS and JavaScript.
- Three.js and GSAP load from the jsDelivr CDN at pinned versions.
- Phones and older devices without WebGL get a styled 2D version. WhatsApp works everywhere.

---

## 1. See it on your computer

The site must be opened through a small local web server. Double-clicking `index.html` won't work, because browsers block JavaScript modules on `file://` pages.

From this folder, run **one** of these:

```bash
python -m http.server 8080
```

```bash
npx serve .
```

Then open **http://localhost:8080** (or the address `serve` prints).

To try it on your phone, connect it to the same Wi-Fi and open `http://<your-computer's-IP>:8080`. Windows may ask you to allow Python through the firewall.

---

## 2. Everyday editing: `js/products.js`

This is the only file you need to touch for prices, products and store details.

### Store details (top of the file)

| Setting | What it does |
|---|---|
| `storeName` | Shown in the footer and every WhatsApp message |
| `brand` | The short name on tags, labels, the logo and the T-shirt print |
| `whatsappNumber` | **Country code + number, digits only.** `917010963146`, not `+91 70109 63146` |
| `address`, `hours`, `opens`, `closes` | Footer and Google business data |
| `instagram` | Your handle without the `@`. Leave `""` to hide the Instagram link |
| `siteUrl` | Your live address once deployed (see section 4). Used for the product link inside WhatsApp messages |

### Change a price

Find the product and change the number, e.g. `price: 549,`. Use a plain number: no `₹` sign and no quotes.

### Add a product

1. Copy one product block (from `{` to `},`) and paste it below the last one.
2. Give it a new `id` (lowercase, dashes, e.g. `"white-linen-shirt"`) and a new `code` (e.g. `"LM-SH-05"`).
3. Fill in `name`, `category`, `price`, `colors`, `fabric`, `fit` and `description`.
4. Set `sizes` to `TOP_SIZES` (S–XXL) or `WAIST_SIZES` (28–38).
5. Pick a `garmentType`. It decides the drawing and the 3D shape:
   `"shirt"`, `"formal-shirt"`, `"overshirt"`, `"camp-shirt"`, `"jeans"`, `"carpenter-jeans"`, `"tee"`, `"graphic-tee"`.

Nothing else needs to change. The rail, Index, filters, Google product data and WhatsApp links all update automatically. A new `category` name also gets its own filter button.

If something is typed wrong (a missing colour, a duplicate id, a price in quotes), the site keeps working, skips the broken product, and explains the problem in the browser console (F12 → Console).

### Colours

```js
colors: [
  { name: "Pale Blue", hex: "#A9C3DC" },
  { name: "Red-Black Check", hex: "#9A2A24", hex2: "#1B1A1A", pattern: "check" },
],
```

`hex` is the main colour. For a check pattern, add `hex2` (the second colour) and `pattern: "check"`.

### Real photos

Until a product has a photo, the site draws it: a technical drawing in the Index and drawer, and a 3D garment on the rail. To use a photo:

1. Save it in `assets/products/`, named with the product code, e.g. `assets/products/LM-SH-01.png`.
2. In that product, set `image: "assets/products/LM-SH-01.png"`. The name must match exactly, capitals included (`.PNG` and `.png` are different files online).
3. Publish (section 4). The Index, product drawer, Shop the Look and 3D rail all use the photo.

**Best look: a cut-out photo (background removed).**

- Shoot the garment flat or on a hanger, front facing, in good light.
- Remove the background with any background-remover tool (many phone gallery and editing apps have one).
- Save as **PNG** (or WebP), keeping the transparency.
- Leave out the hanger if you can: the site adds its own wooden one.
- You don't need to crop: empty space around the garment is trimmed automatically.

On the 3D rail, a cut-out hangs from the wooden hanger like the real garment, with a matching shadow. Its back shows a plain version in the garment's colour.

**A normal photo (JPG) works too.** It appears as-is, and on the 3D rail it hangs as a picture panel.

**Sizes:** about 1000–1400 px on the long side. Keep JPGs under ~200 KB and cut-out PNGs under ~500 KB, so phones load them quickly (squoosh.app compresses both).

One photo per product: choosing another colour in the drawer doesn't swap the photo, but the WhatsApp message still includes the chosen colour.

### Shop the Look

At the bottom of `products.js`, `LOOKS` lists outfits by product `id` and colour name. Edit, add or remove looks there.

---

## 3. Colours and fonts

- **Colours:** the top of `css/style.css` (`:root { --charcoal … --tan … }`). Change a value once and it updates everywhere.
- **Fonts:** loaded from Google Fonts in `index.html` (Anton for headings, Space Grotesk for text, JetBrains Mono for labels). To swap one, change the Google Fonts link and the matching `--f-…` line in `style.css`.
- **Page title and description for Google:** the `<title>` and `<meta name="description">` near the top of `index.html`.

---

## 4. Put it online

### Netlify (easiest)

1. Go to **https://app.netlify.com/drop** and sign in.
2. Drag the whole `MensWear_Final` folder onto the page.
3. Netlify gives you an address like `https://something.netlify.app`.

### GitHub Pages

1. Create a GitHub repository and upload this folder's contents (or push it with git).
2. In the repository, open **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, then branch `main` and folder `/ (root)`.
3. Your site appears at `https://<username>.github.io/<repository>/` after a minute or two.

### Vercel

Import the repository, choose framework preset **Other**, and leave the build command empty.

### After deploying (2 small edits)

1. In `js/products.js`, set `siteUrl` to your live address (e.g. `"https://lowkey-menswear.netlify.app/"`). Product links inside WhatsApp messages then point at the live site.
2. In `index.html`, change `og:image` to the full address of the preview picture, e.g. `https://lowkey-menswear.netlify.app/assets/og-image.png`. WhatsApp and Instagram need a full address to show the preview card.

---

## 5. Useful test addresses

| Add to the address | What it does |
|---|---|
| `#product-oxford-shirt` | Opens that product's drawer on load (use any product `id`) |
| `#look-off-duty` | Scrolls to that outfit |
| `?no3d` | Forces the 2D version, as on phones without WebGL |
| `?3d` | Forces 3D even on devices the site would treat as low-power |
| `?motion=reduce` | Previews the reduced-motion version |

Run the automated checks (Node.js 20+, nothing to install):

```bash
node --experimental-detect-module --test tests/
```

They check the product list, the prices, Indian number formatting, and that every product's WhatsApp link opens with the exact message. Each product's sample link is printed.

---

## 6. How it fits together

```
index.html          page structure, SEO tags, pinned library versions
css/style.css       all styling (colours and fonts at the top)
js/products.js      ← store settings, products, looks (the file you edit)
js/main.js          start-up: builds the page, picks 3D or 2D, handles #product links
js/ui.js            drawer, filters, size help, loader, tape, cursor, grain
js/whatsapp.js      builds the wa.me links and messages
js/flats.js         the garment drawings (also the outline for the 3D garments)
js/garments.js      3D garments and hangers
js/scene.js         3D workshop: rail, lights, floor, camera, dragging
js/validate.js      checks products.js for typing mistakes
assets/             icon, social preview image, product photos
tests/              automated checks
```

**Updating Three.js or GSAP:** the versions are pinned in two places in `index.html`: the `importmap` and the two `modulepreload` links. Change all of them together, then test the site.
