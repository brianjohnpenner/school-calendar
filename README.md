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

Calendar data is stored in the current browser through Alpine Persist. Use the JSON download and import tools to move calendars between browsers or keep backups.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds pull requests and deploys pushes to `main` or `master`.

In the repository on GitHub:

1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to the default branch.

Vite derives the GitHub project-page base path from `GITHUB_REPOSITORY` during the Actions build.
