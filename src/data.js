export const STORAGE_KEY = 'school-calendar-generator:v2'

export const categories = {
  school: { label: 'School day', className: 'event-school' },
  holiday: {
    label: 'Holiday',
    className: 'event-holiday',
    description: 'A day off — not counted as a school day. Use it any time, even outside the school year or during a break.',
  },
  halfday: {
    label: 'Half day holiday',
    className: 'event-halfday',
    description: 'A half day off. Counts as half a school day.',
  },
  event: {
    label: 'Event',
    className: 'event-custom',
    description: 'Something happens that day but it is not a day off. Still counts as a school day.',
  },
}

// User-selectable categories for the event editor. `school` is reserved for the
// system First/Last Day markers and is not offered as a choice.
export const eventCategories = {
  holiday: categories.holiday,
  halfday: categories.halfday,
  event: categories.event,
}

// Map retired categories onto the current set (used when loading saved or
// imported calendars). Breaks become holidays; everything else that merely
// marked a normal day becomes a generic event.
const CATEGORY_MIGRATION = {
  break: 'holiday',
  administration: 'event',
  meeting: 'event',
  testing: 'event',
  custom: 'event',
}

export function migrateCategory(category) {
  return CATEGORY_MIGRATION[category] ?? category
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
    country: 'CA',
    subdivision: 'ON',
    calendar: null,
  }
}

export function monthCount(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  return (ey - sy) * 12 + em - sm + 1
}

export function createCalendar(draft, selectedHolidays = []) {
  return {
    name: draft.name.trim(),
    schoolName: draft.schoolName.trim(),
    firstDay: draft.firstDay,
    lastDay: draft.lastDay,
    semesterCount: draft.semesterCount ?? 2,
    events: selectedHolidays.map(({ title, startDate, endDate, category }) => ({
      title,
      startDate,
      endDate,
      category,
    })),
  }
}

export function calendarMonths(calendar) {
  if (!calendar) return []
  const [year, month] = calendar.firstDay.split('-').map(Number)
  return Array.from({ length: monthCount(calendar.firstDay, calendar.lastDay) }, (_, index) => {
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
      startDate: calendar.firstDay,
      endDate: calendar.firstDay,
      category: 'school',
    },
    {
      id: 'system-last-day',
      title: 'Last Day of School',
      startDate: calendar.lastDay,
      endDate: calendar.lastDay,
      category: 'school',
    },
  ]
}

export function schoolYearLabel(calendar) {
  if (!calendar) return ''
  const start = calendar.firstDay.slice(0, 4)
  const end = calendar.lastDay.slice(0, 4)
  return start === end ? start : `${start} – ${end}`
}

// Returns each in-session school day as `{ iso, weight }`. A half day counts as
// 0.5 of a school day; a full day counts as 1. Holidays are excluded entirely.
export function schoolDayDates(calendar) {
  if (!calendar) return []
  const noSchoolEvents = calendar.events.filter((event) => event.category === 'holiday')
  const halfDayEvents = calendar.events.filter((event) => event.category === 'halfday')
  const dates = []
  for (
    let date = new Date(`${calendar.firstDay}T00:00:00Z`);
    isoFromUtcDate(date) <= calendar.lastDay;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const iso = isoFromUtcDate(date)
    const weekday = date.getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    if (noSchoolEvents.some((event) => event.startDate <= iso && event.endDate >= iso)) continue
    const isHalfDay = halfDayEvents.some((event) => event.startDate <= iso && event.endDate >= iso)
    dates.push({ iso, weight: isHalfDay ? 0.5 : 1 })
  }
  return dates
}

export function splitIntoSemesters(calendar, count) {
  const days = schoolDayDates(calendar)
  if (!days.length) return []
  return Array.from({ length: count }, (_, i) => {
    const startIdx = Math.round((days.length * i) / count)
    const endIdx = Math.round((days.length * (i + 1)) / count) - 1
    const schoolDays = days
      .slice(startIdx, endIdx + 1)
      .reduce((sum, day) => sum + day.weight, 0)
    return {
      label: `Semester ${i + 1}`,
      startDate: days[startIdx].iso,
      endDate: days[endIdx].iso,
      schoolDays,
    }
  })
}

export function schoolDayStats(calendar) {
  if (!calendar) return { months: [], total: 0 }

  const months = calendarMonths(calendar).map(({ year, month }) => ({
    year,
    month,
    label: new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1))),
    days: 0,
  }))
  const monthLookup = new Map(months.map((item) => [`${item.year}-${item.month}`, item]))

  const schoolDays = schoolDayDates(calendar)
  let total = 0
  for (const { iso, weight } of schoolDays) {
    const [year, month] = iso.split('-').map(Number)
    monthLookup.get(`${year}-${month}`).days += weight
    total += weight
  }

  return { months, total }
}

function isoFromUtcDate(date) {
  return date.toISOString().slice(0, 10)
}
