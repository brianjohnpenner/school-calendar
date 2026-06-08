import {
  categories, monthGrid, isoDate, eventsForMonth, eventsForDay,
} from './data.js'

// Each month gets a Tailwind color family. Events within a month use shades of
// that family: lighter (100) for multi-day background bands, mid (600) for
// solid day-off fills, darker (700) for rings and the month heading.
const MONTH_PALETTES = [
  { accent: '#1d4ed8', fill: '#2563eb', band: '#dbeafe', bandText: '#1e40af' }, // blue
  { accent: '#c2410c', fill: '#ea580c', band: '#ffedd5', bandText: '#9a3412' }, // orange
  { accent: '#be123c', fill: '#e11d48', band: '#ffe4e6', bandText: '#9f1239' }, // rose
  { accent: '#047857', fill: '#059669', band: '#d1fae5', bandText: '#065f46' }, // emerald
  { accent: '#6d28d9', fill: '#7c3aed', band: '#ede9fe', bandText: '#5b21b6' }, // violet
  { accent: '#b45309', fill: '#d97706', band: '#fef3c7', bandText: '#92400e' }, // amber
  { accent: '#0e7490', fill: '#0891b2', band: '#cffafe', bandText: '#155e75' }, // cyan
  { accent: '#a21caf', fill: '#c026d3', band: '#fae8ff', bandText: '#86198f' }, // fuchsia
  { accent: '#4d7c0f', fill: '#65a30d', band: '#ecfccb', bandText: '#3f6212' }, // lime
  { accent: '#b91c1c', fill: '#dc2626', band: '#fee2e2', bandText: '#991b1b' }, // red
  { accent: '#0f766e', fill: '#0d9488', band: '#ccfbf1', bandText: '#115e59' }, // teal
  { accent: '#4338ca', fill: '#4f46e5', band: '#e0e7ff', bandText: '#3730a3' }, // indigo
]
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' })
const shortDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const fullDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function eventMarkerClass(event) {
  if (event.category === 'halfday') return 'event-half'
  // Days off are filled solid; everything else (school days) is an open ring.
  return event.category === 'holiday' ? 'event-solid' : 'event-ring'
}

function rangeClasses(date, event) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return [
    'event-range',
    `event-range-${event.category}`,
    date === event.startDate || day === 1 || weekday === 0 ? 'event-range-start' : '',
    date === event.endDate || day === lastDayOfMonth || weekday === 6 ? 'event-range-end' : '',
  ]
}

function dayClassNames(calendar, date) {
  const events = eventsForDay(calendar, date)
  const singleDayEvent = events.find((event) => event.startDate === event.endDate)
  const rangeEvent = events.find((event) => event.startDate !== event.endDate)

  return [
    ...(rangeEvent ? rangeClasses(date, rangeEvent) : []),
    ...(singleDayEvent
      ? [categories[singleDayEvent.category]?.className, 'event-dot', eventMarkerClass(singleDayEvent)]
      : []),
  ].filter(Boolean).join(' ')
}

function formatEventDate(event) {
  const start = shortDateFormatter.format(new Date(`${event.startDate}T00:00:00Z`))
  if (event.startDate === event.endDate) return start
  const end = shortDateFormatter.format(new Date(`${event.endDate}T00:00:00Z`))
  return `${start}–${end}`
}

export function buildMonthView(calendar, month, index) {
  const grid = monthGrid(month.year, month.month)
  const paddedGrid = [...grid, ...Array((7 - grid.length % 7) % 7).fill(null)]
  const palette = MONTH_PALETTES[index % MONTH_PALETTES.length]

  return {
    ...month,
    key: `${month.year}-${month.month}`,
    name: monthFormatter.format(new Date(Date.UTC(month.year, month.month - 1, 1))),
    styles: {
      '--month-accent': palette.accent,
      '--month-fill': palette.fill,
      '--month-band': palette.band,
      '--month-band-text': palette.bandText,
    },
    weeks: Array.from({ length: paddedGrid.length / 7 }, (_, week) =>
      paddedGrid.slice(week * 7, week * 7 + 7).map((number) => {
        if (!number) return null
        const date = isoDate(month.year, month.month, number)
        return { date, number, classes: dayClassNames(calendar, date) }
      })
    ),
    events: eventsForMonth(calendar, month.year, month.month).map((event, eventIndex) => ({
      ...event,
      key: `${event.category}-${event.startDate}-${event.endDate}-${event.title}-${eventIndex}`,
      className: categories[event.category]?.className ?? categories.event.className,
      dateLabel: formatEventDate(event),
    })),
  }
}

export function formatFullDate(date) {
  return fullDateFormatter.format(new Date(`${date}T00:00:00Z`))
}
