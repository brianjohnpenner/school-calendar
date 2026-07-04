// Thin wrapper around Google Analytics (gtag). GA only loads in production
// builds (`npm run build`), so `npm run dev`, wrangler dev, and preview builds
// never report to the live property. Every call is guarded so that a blocked or
// absent analytics script can never break the app.

// Your GA4 Measurement ID — the single place to change it.
const MEASUREMENT_ID = 'G-RJX001C5HV'

// Inject the gtag.js snippet and initialise the data stream. Called once, only
// in production. Kept out of index.html so dev traffic is never counted.
function loadGoogleAnalytics() {
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)
}

if (import.meta.env.PROD) {
  loadGoogleAnalytics()
}

// Fire a GA4 event. Safe to call even if gtag never loaded (dev, ad blockers).
export function track(name, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params)
    }
  } catch {
    /* analytics must never surface an error to the user */
  }
}
