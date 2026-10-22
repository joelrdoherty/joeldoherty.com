# joeldoherty.com

Product studio website for apps built by Joel Doherty. MeetingWorth is the first featured product.

## Local development

```bash
npm run build
npm run preview
```

Open `http://localhost:4173`.

## Deployment

The repository is deployed as a static site on Cloudflare Pages.

- Production branch: `main`
- Build command: `npm run build`
- Output directory: `/` (repository root)

The live MeetingWorth App Store CTA points to `https://apps.apple.com/app/id6811099118`. Keep the same URL in the HTML fallback links and `APP_STORE_URL` in `assets/app.js`.

## Source accuracy

Product claims, pricing and privacy details are derived from the private `joelrdoherty/MeetingMeter` application repository. MeetingWorth is the public product name; the code repository retains the earlier MeetingMeter name.

The public Build 5 support guide is available at `/meetingworth/guide/`. Its five guide sections and five FAQs mirror `MeetingMeter/Views/Settings/HelpSupportContent.swift`. MeetingWorth's public terms are at `/meetingworth/terms/`. `npm run build` checks the approved support strings, required terms coverage, navigation, sitemap coverage, JSON-LD, and local assets.
