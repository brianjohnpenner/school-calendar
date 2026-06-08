import { monthCount, uid } from './data.js'
import { store } from './store.svelte.js'

export function blankDraft() {
  const year = new Date().getFullYear()
  return {
    name: `School Calendar ${year}–${year + 1}`,
    schoolName: '',
    firstDay: `${year}-09-01`,
    lastDay: `${year + 1}-06-30`,
    semesterCount: 2,
    country: 'CA',
    subdivision: 'ON',
  }
}

// Reactive wizard state shared between the Wizard panel and the live preview.
export const wizard = $state({
  step: 1,
  draft: blankDraft(),
  breakSuggestions: [],
  suggestions: [],
  selectedSuggestions: [],
})

export function resetWizard() {
  wizard.draft = {
    ...blankDraft(),
    country: store.state.country,
    subdivision: store.state.subdivision,
  }
  wizard.step = 1
  wizard.breakSuggestions = []
  wizard.suggestions = []
  wizard.selectedSuggestions = []
}

function validIso(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
}

// Keep the live wizard preview sane while the user is still editing dates.
function previewRange(firstDay, lastDay) {
  const start = validIso(firstDay) ? firstDay : blankDraft().firstDay
  if (validIso(lastDay) && lastDay >= start && monthCount(start, lastDay) <= 14) {
    return { firstDay: start, lastDay }
  }
  const [year, month, day] = start.split('-').map(Number)
  const end = new Date(Date.UTC(year, month - 1 + 9, day))
  return { firstDay: start, lastDay: end.toISOString().slice(0, 10) }
}

// A live preview calendar built from the in-progress wizard draft.
export function draftCalendar() {
  const { draft, breakSuggestions, suggestions, selectedSuggestions } = wizard
  const range = previewRange(draft.firstDay, draft.lastDay)
  const selected = [
    ...breakSuggestions.filter((item) => item.enabled),
    ...suggestions.filter((item) => selectedSuggestions.includes(item.suggestionId)),
  ]
  return {
    name: draft.name.trim() || 'Untitled calendar',
    schoolName: draft.schoolName.trim() || 'Your School Name',
    firstDay: range.firstDay,
    lastDay: range.lastDay,
    semesterCount: draft.semesterCount ?? 2,
    events: selected.map(({ title, startDate, endDate, category }) =>
      ({ title, startDate, endDate, category })),
  }
}

function isoFromDate(date) {
  return date.toISOString().slice(0, 10)
}

export function defaultBreakSuggestions(firstDay, lastDay) {
  const firstYear = Number(firstDay.slice(0, 4))
  const lastYear = Number(lastDay.slice(0, 4))
  // Last Thursday of October, plus the Friday that follows it.
  const octoberEnd = new Date(Date.UTC(firstYear, 9, 31))
  const meetingThursday = new Date(octoberEnd)
  meetingThursday.setUTCDate(31 - ((octoberEnd.getUTCDay() - 4 + 7) % 7))
  const meetingFriday = new Date(meetingThursday)
  meetingFriday.setUTCDate(meetingThursday.getUTCDate() + 1)
  const meetingStart = isoFromDate(meetingThursday)
  const meetingEnd = isoFromDate(meetingFriday)
  const christmasStart = `${firstYear}-12-22`
  const christmasEnd = `${firstYear + 1}-01-02`
  const marchFirst = new Date(Date.UTC(lastYear, 2, 1))
  const firstMondayOffset = (8 - marchFirst.getUTCDay()) % 7
  const springStartDate = new Date(Date.UTC(lastYear, 2, 1 + firstMondayOffset + 14))
  const springEndDate = new Date(springStartDate)
  springEndDate.setUTCDate(springEndDate.getUTCDate() + 4)
  const springStart = isoFromDate(springStartDate)
  const springEnd = isoFromDate(springEndDate)

  return [
    {
      suggestionId: uid('break'),
      title: 'School Meeting',
      startDate: meetingStart < firstDay ? firstDay : meetingStart,
      endDate: meetingEnd > lastDay ? lastDay : meetingEnd,
      enabled: meetingStart <= lastDay && meetingEnd >= firstDay,
      category: 'holiday',
    },
    {
      suggestionId: uid('break'),
      title: 'Christmas Vacation',
      startDate: christmasStart < firstDay ? firstDay : christmasStart,
      endDate: christmasEnd > lastDay ? lastDay : christmasEnd,
      enabled: christmasStart <= lastDay && christmasEnd >= firstDay,
      category: 'holiday',
    },
    {
      suggestionId: uid('break'),
      title: 'Spring Break',
      startDate: springStart < firstDay ? firstDay : springStart,
      endDate: springEnd > lastDay ? lastDay : springEnd,
      enabled: springStart <= lastDay && springEnd >= firstDay,
      category: 'holiday',
    },
  ]
}
