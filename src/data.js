export const STORAGE_KEY = 'school-calendar-generator:v1'
export const FORMAT = 'school-calendar-generator'
export const FORMAT_VERSION = 1

export const categories = {
  school: { label: 'School day', className: 'event-school' },
  holiday: { label: 'Holiday', className: 'event-holiday' },
  break: { label: 'Break', className: 'event-break' },
  meeting: { label: 'Meeting', className: 'event-meeting' },
  testing: { label: 'Testing', className: 'event-testing' },
  custom: { label: 'Custom', className: 'event-custom' },
}

export const regions = {
  CA: {
    label: 'Canada',
    subdivisions: {
      AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
      NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
      NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
      SK: 'Saskatchewan', YT: 'Yukon',
    },
  },
  US: {
    label: 'United States',
    subdivisions: {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
      CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
      HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
      KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
      MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
      MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
      NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
      ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
      RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
      TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
      WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
    },
  },
}

export function uid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID()}`
}

export function plainClone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function defaultState() {
  return {
    schemaVersion: 1,
    activeCalendarId: null,
    calendars: [],
    preferences: { lastCountry: 'CA', lastSubdivision: 'ON' },
  }
}

export function monthCount(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  return (ey - sy) * 12 + em - sm + 1
}

export function createCalendar(draft, selectedHolidays = []) {
  const now = new Date().toISOString()
  return {
    id: uid('cal'),
    name: draft.name.trim(),
    schoolName: draft.schoolName.trim(),
    term: { firstDay: draft.firstDay, lastDay: draft.lastDay },
    locale: {
      country: draft.country,
      subdivision: draft.subdivision,
      language: 'en',
      weekStartsOn: 0,
    },
    appearance: { theme: 'modern', pageSize: 'letter', orientation: 'portrait' },
    events: selectedHolidays.map((event) => ({ ...event, id: uid('evt') })),
    createdAt: now,
    updatedAt: now,
  }
}

export function calendarMonths(calendar) {
  if (!calendar) return []
  const [year, month] = calendar.term.firstDay.split('-').map(Number)
  return Array.from({ length: monthCount(calendar.term.firstDay, calendar.term.lastDay) }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1))
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
  })
}

export function monthGrid(year, month) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
}

export function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function eventsForMonth(calendar, year, month) {
  if (!calendar) return []
  const first = isoDate(year, month, 1)
  const last = isoDate(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate())
  return derivedEvents(calendar)
    .filter((event) => event.startDate <= last && event.endDate >= first)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title))
}

export function eventsForDay(calendar, date) {
  return derivedEvents(calendar).filter((event) => event.startDate <= date && event.endDate >= date)
}

export function derivedEvents(calendar) {
  if (!calendar) return []
  return [
    ...calendar.events,
    {
      id: 'system-first-day',
      title: 'First Day of School',
      startDate: calendar.term.firstDay,
      endDate: calendar.term.firstDay,
      category: 'school',
      source: 'system',
    },
    {
      id: 'system-last-day',
      title: 'Last Day of School',
      startDate: calendar.term.lastDay,
      endDate: calendar.term.lastDay,
      category: 'school',
      source: 'system',
    },
  ]
}

export function schoolYearLabel(calendar) {
  if (!calendar) return ''
  const start = calendar.term.firstDay.slice(0, 4)
  const end = calendar.term.lastDay.slice(0, 4)
  return start === end ? start : `${start} – ${end}`
}
