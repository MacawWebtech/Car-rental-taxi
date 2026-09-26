# Kaarvan — Premium Car Rental & Taxi Booking HTML Template

A multipage HTML5 / Bootstrap 5.3 / vanilla ES6 template for taxi booking, car rental, chauffeur and corporate mobility businesses. Includes 16 website pages, a 9-page admin dashboard, dark mode, RTL and accessible forms.

Open `pages/index.html` in a browser (or serve the folder with any static server, e.g. `npx serve .`). Full documentation: `documentation/index.html`.

## Folder structure

```
car-rental-taxi/
├── assets/
│   ├── css/      style.css (design system) · dark-mode.css · rtl.css
│   ├── js/       main.js (global) · booking.js (widget + booking flow) · dashboard.js (charts + admin UI)
│   │   └── plugins/   place optional third-party scripts here
│   ├── images/   put your licensed WebP images here
│   └── fonts/    optional self-hosted fonts
├── pages/        16 website pages (index, home-2, about, services, service-details, fleet,
│                 vehicle-details, booking, pricing, locations, contact,
│                 login, register, user-dashboard, 404, coming-soon)
├── dashboard/    9 admin pages (index, bookings, vehicles, drivers, customers, payments,
│                 messages, reports, settings)
├── documentation/index.html
├── index.html    redirects to pages/index.html
├── sitemap.xml · robots.txt · README.md · LICENSE
```

## Dependencies (CDN)

Bootstrap 5.3.3 (CSS + bundle JS), Bootstrap Icons 1.11.3, Google Fonts (Manrope, DM Serif Display). No jQuery, no chart library — charts are drawn as SVG by `dashboard.js`.

## Quick customisation

- **Colours / radii / fonts:** edit the tokens at the top of `assets/css/style.css` (`--k-ink`, `--k-amber`, `--k-amber-deep`, `--r-sm/md/lg`, `--font-ui`, `--font-serif`). Dark theme values live in `dark-mode.css`.
- **Brand name:** search and replace `Kaarvan`. The logo is an inline SVG (`.brand-mark`) in every header/footer.
- **Fares:** the rate card used by the live estimate is `RATES` in `assets/js/booking.js`; keep it in sync with `pages/pricing.html`.
- **Theme:** stored in `localStorage` key `mobility-theme`; defaults to the OS `prefers-color-scheme`.
- **Language / RTL:** stored in `mobility-lang`. Choosing Arabic or Hebrew sets `dir="rtl"`; `rtl.css` handles mirroring.

## Images

All images are stored locally in `assets/images/`; nothing is loaded from an external image CDN. Any image that fails to load is replaced by a neutral branded placeholder automatically. To swap a photo, replace the file in `assets/images/` or update its `src` attribute. The social share image is `assets/images/og-cover.jpg` (1200 × 630). The logo files are `assets/images/logo-dark.png` (for light backgrounds) and `logo-light.png` (for dark backgrounds), made from `logo.png`.

## Integration points

All are marked with comments in the HTML/JS.

| Feature | Where | Notes |
|---|---|---|
| Maps / Places autocomplete | booking widget `<datalist>`, `booking.html`, `locations.html`, `contact.html` | Google Maps JS / Places / Directions / Embed API |
| Fare estimate | `estimateFare()` in `booking.js` | Replace demo distance with Distance Matrix + your pricing API |
| Booking submit | booking widget + `#stepNext` final step | POST to your booking API |
| Payments | `booking.html` step 5 | Stripe Elements, PayPal Smart Buttons, UPI gateway |
| Contact form | `contact.html` | Formspree (`action`) or Netlify Forms (`data-netlify`) |
| Newsletter | footer, coming-soon | Mailchimp / ConvertKit endpoint in `action` |
| Auth | `login.html`, `register.html` | Firebase / Auth0 / Supabase / Cognito |
| Dashboard data | `data-series`, `data-donut`, tables | Replace inline demo data with API calls |

## SEO

Every page has a unique title, meta description, canonical URL, Open Graph and Twitter tags, plus JSON-LD (LocalBusiness / AutoRental / TaxiService, BreadcrumbList, Service, FAQPage, Product). Replace `https://www.kaarvan.example` with your domain in all pages, `sitemap.xml` and `robots.txt`. Dashboard and account pages are `noindex`.

## Accessibility

Skip link, landmarks, one H1 per page, ARIA tabs with arrow-key support, labelled form fields, inline errors linked via `aria-describedby` / `aria-invalid`, 44 px touch targets, visible focus styles, `prefers-reduced-motion` support and screen-reader data tables behind every chart.

## Browser support

Latest Chrome, Edge, Firefox, Safari (desktop and iOS), Samsung Internet.

## Scroll experience (motion layer)

`assets/css/motion.css` and `assets/js/motion.js` add the scroll experience to every public page. They use GSAP 3.12 with ScrollTrigger, and Lenis 1.1 for smooth scrolling, all loaded from jsDelivr with `defer`.

- If a CDN fails, the layer switches itself off, and the page renders exactly as it did before.
- With `prefers-reduced-motion` turned on, only the progress bar and back-to-top button stay active.
- On touch devices and screens narrower than 992 px, scrolling stays native. Parallax, pinning, tilt, the cursor effects and magnetic buttons are all off there; reveals still run, but they are time-based rather than tied to scroll position.
- The dashboard pages do not load the motion layer.
