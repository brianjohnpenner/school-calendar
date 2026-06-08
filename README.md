# School Calendar Generator

A browser-only school calendar editor built with Vite, AlpineJS, Tailwind CSS, and `date-holidays`.

## Development

```sh
npm install
npm run dev
```

Create a production build with:

```sh
npm run build
```

Calendar data is stored in the current browser through Alpine Persist. Use the CSV download and import tools to move individual calendars between browsers.

## Cloudflare Pages

Deployment uses Cloudflare Pages' Git integration — Cloudflare builds and deploys on every push, no API tokens or CI workflow required.

One-time setup in the Cloudflare dashboard:

1. Go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select the `school-calendar` repository.
3. Set the build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Save and deploy.

Cloudflare deploys pushes to the production branch (`master`) and creates preview deployments for other branches and pull requests. The `wrangler.toml` records the build output directory; the build settings above must match it.

To deploy manually from your machine instead, run `npx wrangler pages deploy dist` after `npm run build`.
