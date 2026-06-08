import { store } from './store.svelte.js'

// Shared dialog/open state, plus the event currently being edited. Several
// components open these dialogs (sidebar, preview day clicks, wizard), so the
// flags live in one shared module rather than being threaded through props.
export const ui = $state({
  eventOpen: false,
  settingsOpen: false,
  importOpen: false,
  // Seed object handed to the event editor when it opens. `index === null`
  // means "new event"; otherwise it is the index within calendar.events.
  editingEvent: null,
})

function blankEvent(date) {
  return { index: null, title: '', startDate: date, endDate: date, category: 'event' }
}

export function openEvent(event = null) {
  const calendar = store.state.calendar
  ui.editingEvent = event ?? blankEvent(calendar.firstDay)
  ui.eventOpen = true
}

// Tap or click a day in the preview to add an event on that date. If the day
// already has a single-day event, open it for editing instead.
export function selectDay(date) {
  const calendar = store.state.calendar
  if (!calendar || !date) return
  const index = calendar.events.findIndex(
    (event) => event.startDate === event.endDate && event.startDate === date
  )
  if (index !== -1) {
    openEvent({ ...calendar.events[index], index })
    return
  }
  ui.editingEvent = blankEvent(date)
  ui.eventOpen = true
}
