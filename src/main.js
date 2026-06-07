import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import './style.css'
import {
  STORAGE_KEY, categories, regions, defaultState, monthCount, createCalendar,
  calendarMonths, monthGrid, isoDate, eventsForMonth, eventsForDay, schoolYearLabel,
  schoolDayStats, plainClone, uid, todayIso,
} from './data.js'
import { exportEnvelope, parseImport, mergeCalendars, downloadJson, shareJson } from './portability.js'

Alpine.plugin(persist)

function blankDraft() {
  const year = new Date().getFullYear()
  return {
    name: `School Calendar ${year}–${year + 1}`,
    schoolName: '',
    firstDay: `${year}-09-01`,
    lastDay: `${year + 1}-06-30`,
    country: 'CA',
    subdivision: 'ON',
  }
}

function blankEvent() {
  return { id: null, title: '', startDate: todayIso(), endDate: todayIso(), category: 'custom', source: 'custom' }
}

function isoFromDate(date) {
  return date.toISOString().slice(0, 10)
}

function dateInRange(date, firstDay, lastDay) {
  return date >= firstDay && date <= lastDay
}

function defaultBreakSuggestions(firstDay, lastDay) {
  const firstYear = Number(firstDay.slice(0, 4))
  const lastYear = Number(lastDay.slice(0, 4))
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
      title: 'Christmas Vacation',
      startDate: christmasStart < firstDay ? firstDay : christmasStart,
      endDate: christmasEnd > lastDay ? lastDay : christmasEnd,
      enabled: christmasStart <= lastDay && christmasEnd >= firstDay,
      category: 'break',
      source: 'custom',
    },
    {
      suggestionId: uid('break'),
      title: 'Spring Break',
      startDate: springStart < firstDay ? firstDay : springStart,
      endDate: springEnd > lastDay ? lastDay : springEnd,
      enabled: springStart <= lastDay && springEnd >= firstDay,
      category: 'break',
      source: 'custom',
    },
  ]
}

document.addEventListener('alpine:init', () => {
  Alpine.store('calendarData', {
    state: Alpine.$persist(defaultState()).as(STORAGE_KEY),
  })

  Alpine.data('calendarApp', () => ({
    view: 'home',
    wizardStep: 1,
    draft: blankDraft(),
    breakSuggestions: [],
    suggestions: [],
    selectedSuggestions: [],
    eventForm: blankEvent(),
    eventDialogOpen: false,
    settingsOpen: false,
    importOpen: false,
    importError: '',
    importPreviews: [],
    loadingHolidays: false,
    notice: '',
    categories,
    regions,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

    init() {
      const state = this.$store.calendarData.state
      if (!state?.schemaVersion || !Array.isArray(state.calendars)) {
        this.$store.calendarData.state = defaultState()
      }
      if (this.activeCalendar) this.view = 'editor'
    },

    get state() { return this.$store.calendarData.state },
    get activeCalendar() {
      return this.state.calendars.find((calendar) => calendar.id === this.state.activeCalendarId) ?? null
    },
    get months() { return calendarMonths(this.activeCalendar) },
    get schoolDaySummary() { return schoolDayStats(this.activeCalendar) },
    get termMonthCount() { return monthCount(this.draft.firstDay, this.draft.lastDay) },
    get subdivisions() { return this.regions[this.draft.country]?.subdivisions ?? {} },
    get wizardValid() {
      return this.draft.name.trim() && this.draft.schoolName.trim() &&
        this.draft.firstDay <= this.draft.lastDay &&
        this.termMonthCount >= 8 && this.termMonthCount <= 12
    },
    get breaksValid() {
      return this.breakSuggestions.every((item) =>
        !item.enabled ||
        (item.title.trim() && item.startDate <= item.endDate &&
          dateInRange(item.startDate, this.draft.firstDay, this.draft.lastDay) &&
          dateInRange(item.endDate, this.draft.firstDay, this.draft.lastDay))
      )
    },
    get printDensityClass() {
      const count = this.months.length
      const eventCount = this.activeCalendar?.events.length ?? 0
      if (count >= 12 || eventCount > 28) return 'density-tight'
      if (count >= 11 || eventCount > 18) return 'density-compact'
      return 'density-comfortable'
    },

    monthGrid,
    isoDate,
    eventsForMonth(year, month) { return eventsForMonth(this.activeCalendar, year, month) },
    dayClasses(date) {
      const events = eventsForDay(this.activeCalendar, date)
      if (!events.length) return ''
      const event = events[0]
      const marker = event.startDate === event.endDate ? 'event-dot' : 'event-range'
      return `${categories[event.category]?.className ?? ''} ${marker}`
    },
    schoolYearLabel() { return schoolYearLabel(this.activeCalendar) },
    shortSchoolYearLabel() {
      if (!this.activeCalendar) return ''
      const start = this.activeCalendar.term.firstDay.slice(0, 4)
      const end = this.activeCalendar.term.lastDay.slice(2, 4)
      return `${start}–${end}`
    },
    monthAccent(index) {
      return ['#2f6fd6', '#db6b1f', '#b84f4a', '#149860', '#3192ba', '#d84d79', '#579b3d', '#7d5ac7', '#df4968', '#d08a16'][index % 10]
    },
    monthName(year, month) {
      return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, month - 1, 1)))
    },
    formatDate(date) {
      return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${date}T00:00:00Z`))
    },
    formatEventDate(event) {
      const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      const start = formatter.format(new Date(`${event.startDate}T00:00:00Z`))
      if (event.startDate === event.endDate) return start

      const end = formatter.format(new Date(`${event.endDate}T00:00:00Z`))
      return `${start}–${end}`
    },
    categoryLabel(key) { return categories[key]?.label ?? key },

    startWizard() {
      this.draft = blankDraft()
      this.wizardStep = 1
      this.breakSuggestions = []
      this.suggestions = []
      this.selectedSuggestions = []
      this.view = 'wizard'
    },
    editWizardCalendar() {
      const calendar = this.activeCalendar
      this.draft = {
        name: calendar.name,
        schoolName: calendar.schoolName,
        firstDay: calendar.term.firstDay,
        lastDay: calendar.term.lastDay,
        country: calendar.locale.country,
        subdivision: calendar.locale.subdivision,
      }
      this.settingsOpen = true
    },
    countryChanged() {
      this.draft.subdivision = Object.keys(this.subdivisions)[0]
    },
    prepareBreakSuggestions() {
      if (!this.wizardValid) return
      this.breakSuggestions = defaultBreakSuggestions(this.draft.firstDay, this.draft.lastDay)
      this.wizardStep = 3
    },
    async loadSuggestions() {
      this.loadingHolidays = true
      try {
        const { holidaySuggestions } = await import('./holidays.js')
        this.suggestions = holidaySuggestions(
          this.draft.country, this.draft.subdivision, this.draft.firstDay, this.draft.lastDay
        )
        this.selectedSuggestions = this.suggestions.map((item) => item.suggestionId)
        this.wizardStep = 4
      } catch {
        this.flash('Holiday suggestions could not be loaded.')
      } finally {
        this.loadingHolidays = false
      }
    },
    createFromWizard() {
      const selectedBreaks = this.breakSuggestions
        .filter((item) => item.enabled)
        .map(({ enabled, ...item }) => item)
      const selectedHolidays = this.suggestions
        .filter((item) => this.selectedSuggestions.includes(item.suggestionId))
      const selected = [...selectedBreaks, ...selectedHolidays]
      const calendar = createCalendar(this.draft, selected)
      this.state.calendars.push(calendar)
      this.state.activeCalendarId = calendar.id
      this.state.preferences.lastCountry = calendar.locale.country
      this.state.preferences.lastSubdivision = calendar.locale.subdivision
      this.view = 'editor'
      this.flash('Calendar created.')
    },
    saveSettings() {
      if (!this.wizardValid) return
      const calendar = this.activeCalendar
      Object.assign(calendar, {
        name: this.draft.name.trim(),
        schoolName: this.draft.schoolName.trim(),
        term: { firstDay: this.draft.firstDay, lastDay: this.draft.lastDay },
        locale: { ...calendar.locale, country: this.draft.country, subdivision: this.draft.subdivision },
        updatedAt: new Date().toISOString(),
      })
      this.settingsOpen = false
      this.flash('Calendar settings saved.')
    },
    selectCalendar(id) {
      this.state.activeCalendarId = id
      this.view = 'editor'
    },
    duplicateCalendar() {
      const copy = plainClone(this.activeCalendar)
      copy.id = uid('cal')
      copy.name = `${copy.name} Copy`
      copy.events = copy.events.map((event) => ({ ...event, id: uid('evt') }))
      copy.createdAt = copy.updatedAt = new Date().toISOString()
      this.state.calendars.push(copy)
      this.state.activeCalendarId = copy.id
      this.flash('Calendar duplicated.')
    },
    deleteCalendar() {
      if (!confirm(`Delete “${this.activeCalendar.name}”? This cannot be undone.`)) return
      const id = this.activeCalendar.id
      this.state.calendars = this.state.calendars.filter((calendar) => calendar.id !== id)
      this.state.activeCalendarId = this.state.calendars[0]?.id ?? null
      this.view = this.activeCalendar ? 'editor' : 'home'
    },
    openEvent(event = null) {
      this.eventForm = event ? plainClone(event) : {
        ...blankEvent(),
        startDate: this.activeCalendar.term.firstDay,
        endDate: this.activeCalendar.term.firstDay,
      }
      this.eventDialogOpen = true
    },
    saveEvent() {
      if (!this.eventForm.title.trim() || this.eventForm.startDate > this.eventForm.endDate) return
      const calendar = this.activeCalendar
      if (this.eventForm.id) {
        const index = calendar.events.findIndex((event) => event.id === this.eventForm.id)
        calendar.events[index] = { ...this.eventForm, title: this.eventForm.title.trim() }
      } else {
        calendar.events.push({ ...this.eventForm, id: uid('evt'), title: this.eventForm.title.trim() })
      }
      calendar.updatedAt = new Date().toISOString()
      this.eventDialogOpen = false
      this.flash('Event saved.')
    },
    deleteEvent(id) {
      this.activeCalendar.events = this.activeCalendar.events.filter((event) => event.id !== id)
      this.eventDialogOpen = false
      this.flash('Event deleted.')
    },
    exportCurrent() {
      const envelope = exportEnvelope([this.activeCalendar], 'calendar')
      downloadJson(envelope, `${this.slug(this.activeCalendar.name)}.calendar.json`)
    },
    exportAll() {
      downloadJson(exportEnvelope(this.state.calendars, 'backup'), `school-calendars-backup-${todayIso()}.json`)
    },
    async shareCurrent() {
      const envelope = exportEnvelope([this.activeCalendar], 'calendar')
      const filename = `${this.slug(this.activeCalendar.name)}.calendar.json`
      try {
        if (!await shareJson(envelope, filename)) {
          downloadJson(envelope, filename)
          this.flash('Sharing is unavailable here, so the JSON file was downloaded.')
        }
      } catch (error) {
        if (error.name !== 'AbortError') this.flash('The calendar could not be shared.')
      }
    },
    async readImport(file) {
      if (!file) return
      this.importError = ''
      try {
        this.importPreviews = parseImport(await file.text())
      } catch (error) {
        this.importPreviews = []
        this.importError = error.message
      }
    },
    handleDrop(event) {
      this.readImport(event.dataTransfer.files[0])
    },
    confirmImport() {
      const valid = this.importPreviews
        .filter((preview) => preview.selected && preview.errors.length === 0)
        .map((preview) => preview.calendar)
      if (!valid.length) return
      const imported = mergeCalendars(this.state.calendars, valid)
      this.state.calendars.push(...imported)
      this.state.activeCalendarId = imported[0].id
      this.importOpen = false
      this.importPreviews = []
      this.view = 'editor'
      this.flash(`${imported.length} calendar${imported.length === 1 ? '' : 's'} imported.`)
    },
    printCalendar() { window.print() },
    slug(value) {
      return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    },
    flash(message) {
      this.notice = message
      setTimeout(() => { if (this.notice === message) this.notice = '' }, 3500)
    },
  }))
})

window.Alpine = Alpine
Alpine.start()
