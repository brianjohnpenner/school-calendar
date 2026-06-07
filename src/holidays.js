import Holidays from 'date-holidays'
import { uid } from './data.js'

export function holidaySuggestions(country, subdivision, firstDay, lastDay) {
  if (!country || !firstDay || !lastDay) return []

  const holidays = new Holidays(country, subdivision, { languages: ['en'] })
  const firstYear = Number(firstDay.slice(0, 4))
  const lastYear = Number(lastDay.slice(0, 4))
  const results = []

  for (let year = firstYear; year <= lastYear; year += 1) {
    for (const holiday of holidays.getHolidays(year)) {
      const date = holiday.date.slice(0, 10)
      if (date < firstDay || date > lastDay) continue
      if (!['public', 'bank', 'school'].includes(holiday.type)) continue

      results.push({
        suggestionId: uid('suggestion'),
        title: holiday.name,
        startDate: date,
        endDate: date,
        category: holiday.type === 'school' ? 'break' : 'holiday',
        source: 'holiday',
        holiday: {
          provider: 'date-holidays',
          type: holiday.type,
          observed: Boolean(holiday.substitute),
          originalDate: holiday.substitute ? holiday.date.slice(0, 10) : null,
        },
      })
    }
  }

  return results.filter((event, index, all) =>
    all.findIndex((item) => item.title === event.title && item.startDate === event.startDate) === index
  )
}
