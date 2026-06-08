import { categories, migrateCategory, monthCount } from './data.js'

const CSV_HEADER = ['type', 'name', 'start_date', 'end_date', 'category']

function validDate(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function validateEvent(event) {
  const errors = []
  if (!event || typeof event !== 'object') return ['Event is not an object.']
  if (!event.title || typeof event.title !== 'string') errors.push('Event title is missing.')
  if (!validDate(event.startDate) || !validDate(event.endDate)) errors.push('Event dates are invalid.')
  if (event.startDate > event.endDate) errors.push('Event ends before it starts.')
  if (!categories[event.category]) errors.push(`Unknown event category: ${event.category}.`)
  return errors
}

function validateCalendar(calendar) {
  const errors = []
  if (!calendar || typeof calendar !== 'object') return ['Calendar is not an object.']
  if (!calendar.name || typeof calendar.name !== 'string') errors.push('Calendar name is missing.')
  if (!calendar.schoolName || typeof calendar.schoolName !== 'string') errors.push('School name is missing.')
  if (!validDate(calendar.firstDay) || !validDate(calendar.lastDay)) errors.push('Term dates are invalid.')
  if (calendar.firstDay > calendar.lastDay) errors.push('Term ends before it starts.')
  const months = monthCount(calendar.firstDay, calendar.lastDay)
  if (months < 8 || months > 12) errors.push('Term must span 8–12 calendar months.')
  if (!Array.isArray(calendar.events)) errors.push('Events must be an array.')
  else calendar.events.forEach((event, index) =>
    validateEvent(event).forEach((error) => errors.push(`Event ${index + 1}: ${error}`))
  )
  return errors
}

function encodeCsvCell(value = '') {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function parseCsvRows(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"') {
      if (cell) throw new Error('The CSV file contains an invalid quote.')
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''))
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }

  if (quoted) throw new Error('The CSV file contains an unclosed quote.')
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows.filter((values) => values.some((value) => value.trim()))
}

export function exportCalendarCsv(calendar) {
  const rows = [
    CSV_HEADER,
    ['school_name', calendar.schoolName, '', '', ''],
    ['calendar_name', calendar.name, '', '', ''],
    ['first_day', 'First Day of School', calendar.firstDay, calendar.firstDay, 'school'],
    ...calendar.events.map((event) => [
      'event', event.title, event.startDate, event.endDate, event.category,
    ]),
    ['last_day', 'Last Day of School', calendar.lastDay, calendar.lastDay, 'school'],
  ]
  return `${rows.map((row) => row.map(encodeCsvCell).join(',')).join('\r\n')}\r\n`
}

export function parseImport(text) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (!rows.length || rows[0].map((value) => value.trim().toLowerCase()).join(',') !== CSV_HEADER.join(',')) {
    throw new Error(`The CSV header must be: ${CSV_HEADER.join(',')}.`)
  }

  const records = rows.slice(1).map((values, index) => {
    if (values.length !== CSV_HEADER.length) {
      throw new Error(`CSV row ${index + 2} must contain ${CSV_HEADER.length} columns.`)
    }
    const [type, name, startDate, endDate, category] = values.map((value) => value.trim())
    return { type: type.toLowerCase(), name, startDate, endDate, category: category.toLowerCase() }
  })
  const recordsOfType = (type) => records.filter((record) => record.type === type)
  const singleRecord = (type) => {
    const matches = recordsOfType(type)
    if (matches.length !== 1) throw new Error(`The CSV file must contain exactly one ${type} row.`)
    return matches[0]
  }
  const schoolName = singleRecord('school_name').name
  const calendarName = singleRecord('calendar_name').name
  const firstDay = singleRecord('first_day').startDate
  const lastDay = singleRecord('last_day').startDate
  const unknown = records.find((record) =>
    !['school_name', 'calendar_name', 'first_day', 'event', 'last_day'].includes(record.type)
  )
  if (unknown) throw new Error(`Unknown CSV row type: ${unknown.type || '(blank)'}.`)

  const calendar = {
    name: calendarName,
    schoolName,
    firstDay,
    lastDay,
    events: recordsOfType('event').map((record) => ({
      title: record.name,
      startDate: record.startDate,
      endDate: record.endDate,
      category: migrateCategory(record.category),
    })),
  }
  return [{ calendar, selected: true, errors: validateCalendar(calendar) }]
}

export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareCsv(csv, filename) {
  const file = new File([csv], filename, { type: 'text/csv' })
  if (!navigator.canShare?.({ files: [file] })) return false
  await navigator.share({ title: 'School calendar', files: [file] })
  return true
}
