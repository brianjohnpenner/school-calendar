import {
  categories, monthGrid, isoDate, eventsForMonth, eventsForDay,
} from './data.js'

const MONTH_ACCENTS = ['#2f6fd6', '#db6b1f', '#b84f4a', '#149860', '#3192ba', '#d84d79', '#579b3d', '#7d5ac7', '#df4968', '#d08a16']
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' })
const shortDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const fullDateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function eventMarkerClass(event) {
  if (event.category === 'administration') return 'event-half'
  return ['holiday', 'break'].includes(event.category) ? 'event-ring' : 'event-solid'
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

  return {
    ...month,
    key: `${month.year}-${month.month}`,
    name: monthFormatter.format(new Date(Date.UTC(month.year, month.month - 1, 1))),
    accent: MONTH_ACCENTS[index % MONTH_ACCENTS.length],
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
      className: categories[event.category].className,
      dateLabel: formatEventDate(event),
    })),
  }
}

export function formatFullDate(date) {
  return fullDateFormatter.format(new Date(`${date}T00:00:00Z`))
}
