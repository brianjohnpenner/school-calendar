import { STORAGE_KEY, defaultState, migrateCategory } from './data.js'

// Normalize whatever is in storage onto the current single-calendar shape.
function normalize(state) {
  if (!state || typeof state !== 'object') return defaultState()

  // Migrate the legacy multi-calendar shape to a single calendar.
  if (Array.isArray(state.calendars)) {
    const active = typeof state.activeCalendar === 'number' ? state.activeCalendar : 0
    state = {
      country: state.country ?? 'CA',
      subdivision: state.subdivision ?? 'ON',
      calendar: state.calendars[active] ?? state.calendars[0] ?? null,
    }
  }

  // Fold any retired event categories onto the current set.
  if (state.calendar?.events) {
    state.calendar.events.forEach((event) => {
      event.category = migrateCategory(event.category)
    })
  }
  return state
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch { /* storage unavailable or corrupt */ }
  return defaultState()
}

// Shared, reactive, persisted state. Components import `store` and mutate
// `store.state` directly; the effect below writes every change back to storage.
export const store = $state({ state: load() })

$effect.root(() => {
  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store.state))
    } catch { /* storage unavailable */ }
  })
})
