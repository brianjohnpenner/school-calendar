import { categories, FORMAT, FORMAT_VERSION, monthCount, plainClone, regions, uid } from './data.js'

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
  if (!validDate(calendar.term?.firstDay) || !validDate(calendar.term?.lastDay)) errors.push('Term dates are invalid.')
  if (calendar.term?.firstDay > calendar.term?.lastDay) errors.push('Term ends before it starts.')
  const months = monthCount(calendar.term?.firstDay, calendar.term?.lastDay)
  if (months < 8 || months > 12) errors.push('Term must span 8–12 calendar months.')
  if (!regions[calendar.locale?.country]) errors.push('Country is not supported.')
  else if (!regions[calendar.locale.country].subdivisions[calendar.locale?.subdivision]) {
    errors.push('Province or state is not supported.')
  }
  if (!Array.isArray(calendar.events)) errors.push('Events must be an array.')
  else calendar.events.forEach((event, index) =>
    validateEvent(event).forEach((error) => errors.push(`Event ${index + 1}: ${error}`))
  )
  return errors
}

export function exportEnvelope(calendars, scope) {
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    calendars: plainClone(calendars),
  }
}

export function parseImport(text) {
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('This file does not contain valid JSON.')
  }

  if (payload.format !== FORMAT) throw new Error('This is not a School Calendar Generator file.')
  if (payload.formatVersion > FORMAT_VERSION) throw new Error('This file was created by a newer version of the app.')
  if (payload.formatVersion !== FORMAT_VERSION) throw new Error('This file version is not supported.')
  if (!Array.isArray(payload.calendars) || payload.calendars.length === 0) {
    throw new Error('The file does not contain any calendars.')
  }

  const previews = payload.calendars.map((calendar) => ({
    calendar,
    selected: true,
    errors: validateCalendar(calendar),
  }))
  return previews
}

export function mergeCalendars(current, selected) {
  const calendarIds = new Set(current.map((calendar) => calendar.id))
  const eventIds = new Set(current.flatMap((calendar) => calendar.events.map((event) => event.id)))

  return selected.map((source) => {
    const calendar = plainClone(source)
    if (!calendar.id || calendarIds.has(calendar.id)) calendar.id = uid('cal')
    calendarIds.add(calendar.id)

    calendar.events = calendar.events.map((event) => {
      if (!event.id || eventIds.has(event.id)) event.id = uid('evt')
      eventIds.add(event.id)
      return event
    })
    calendar.updatedAt = new Date().toISOString()
    return calendar
  })
}

export function downloadJson(envelope, filename) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareJson(envelope, filename) {
  const file = new File([JSON.stringify(envelope, null, 2)], filename, { type: 'application/json' })
  if (!navigator.canShare?.({ files: [file] })) return false
  await navigator.share({ title: 'School calendar', files: [file] })
  return true
}
