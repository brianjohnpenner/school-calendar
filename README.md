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

## Cloudflare

Deployment uses Cloudflare Workers static assets with the Git integration — Cloudflare builds and deploys on every push, no API tokens or CI workflow required.

Build settings in the Cloudflare dashboard:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

`wrangler.toml` points `[assets].directory` at `dist`, so `wrangler deploy` uploads the built site as a static-asset Worker (no server-side script). Cloudflare deploys pushes to the production branch (`master`) and creates preview deployments for other branches.

To deploy manually from your machine, run `npm run build` then `npx wrangler deploy`.
