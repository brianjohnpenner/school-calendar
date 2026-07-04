import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import './style.css'
import {
  STORAGE_KEY, categories, eventCategories, migrateCategory, regions, defaultState,
  monthCount, createCalendar, calendarMonths, schoolDayStats, splitIntoSemesters,
  plainClone, uid, todayIso,
} from './data.js'
import { buildMonthView, formatFullDate } from './calendar-view.js'
import { exportCalendarCsv, parseImport, downloadCsv, shareCsv } from './portability.js'

Alpine.plugin(persist)

function blankDraft() {
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

function blankEvent() {
  return { index: null, title: '', startDate: todayIso(), endDate: todayIso(), category: 'event' }
}

const WELCOME_NOTICE_KEY = 'school-calendar-generator:welcome-v2'
const STORAGE_TIP_KEY = 'school-calendar-generator:storage-tip-v1'

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

function isoFromDate(date) {
  return date.toISOString().slice(0, 10)
}

function dateInRange(date, firstDay, lastDay) {
  return date >= firstDay && date <= lastDay
}

function defaultBreakSuggestions(firstDay, lastDay) {
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

document.addEventListener('alpine:init', () => {
  Alpine.store('calendarData', {
    state: Alpine.$persist(defaultState()).as(STORAGE_KEY),
  })

  Alpine.data('calendarApp', () => ({
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
    welcomeOpen: false,
    storageTipOpen: false,
    dataHelpOpen: false,
    notice: '',
    previewScale: 1,
    previewFitScale: 1,
    previewMode: 'fit',
    previewResizeObserver: null,
    previewPinch: null,
    previewTouchHandlers: null,
    categories,
    eventCategories,
    regions,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

    init() {
      const store = this.$store.calendarData
      const state = store.state
      if (!state || typeof state !== 'object') {
        store.state = defaultState()
      } else if (Array.isArray(state.calendars)) {
        // Migrate the legacy multi-calendar shape to a single calendar.
        const active = typeof state.activeCalendar === 'number' ? state.activeCalendar : 0
        store.state = {
          country: state.country ?? 'CA',
          subdivision: state.subdivision ?? 'ON',
          calendar: state.calendars[active] ?? state.calendars[0] ?? null,
        }
      }
      // Fold any retired event categories onto the current set.
      if (this.activeCalendar?.events) {
        this.activeCalendar.events.forEach((event) => {
          event.category = migrateCategory(event.category)
        })
      }
      if (!this.activeCalendar) this.resetWizard()
      try {
        this.welcomeOpen = !this.activeCalendar && !localStorage.getItem(WELCOME_NOTICE_KEY)
        this.storageTipOpen = !this.welcomeOpen && !localStorage.getItem(STORAGE_TIP_KEY)
      } catch {
        this.welcomeOpen = !this.activeCalendar
        this.storageTipOpen = !this.welcomeOpen
      }
    },

    get state() { return this.$store.calendarData.state },
    get activeCalendar() {
      return this.state.calendar ?? null
    },
    // The saved calendar, or a live preview built from the in-progress wizard draft.
    get previewCalendar() {
      return this.activeCalendar ?? this.draftCalendar()
    },
    draftCalendar() {
      const range = previewRange(this.draft.firstDay, this.draft.lastDay)
      const selected = [
        ...this.breakSuggestions.filter((item) => item.enabled),
        ...this.suggestions.filter((item) => this.selectedSuggestions.includes(item.suggestionId)),
      ]
      return {
        name: this.draft.name.trim() || 'Untitled calendar',
        schoolName: this.draft.schoolName.trim() || 'Your School Name',
        firstDay: range.firstDay,
        lastDay: range.lastDay,
        semesterCount: this.draft.semesterCount ?? 2,
        events: selected.map(({ title, startDate, endDate, category }) =>
          ({ title, startDate, endDate, category })),
      }
    },
    get months() {
      return calendarMonths(this.previewCalendar)
        .map((month, index) => buildMonthView(this.previewCalendar, month, index))
    },
    get schoolDaySummary() { return schoolDayStats(this.previewCalendar) },
    get semesterSplits() {
      const calendar = this.previewCalendar
      return splitIntoSemesters(calendar, calendar.semesterCount ?? this.draft.semesterCount ?? 2)
    },
    get sortedEvents() {
      return this.activeCalendar
        ? this.activeCalendar.events
          .map((event, index) => ({ ...event, index }))
          .sort((a, b) => a.startDate.localeCompare(b.startDate))
        : []
    },
    get eventCount() { return (this.activeCalendar?.events.length ?? 0) + 2 },
    get monthRowCount() { return Math.ceil(calendarMonths(this.previewCalendar).length / 2) },
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
      const count = calendarMonths(this.previewCalendar).length
      const eventCount = this.previewCalendar.events.length
      if (count >= 12 || eventCount > 28) return 'density-tight'
      if (count >= 11 || eventCount > 18) return 'density-compact'
      return 'density-comfortable'
    },

    get shortSchoolYearLabel() {
      const calendar = this.previewCalendar
      return `${calendar.firstDay.slice(0, 4)}–${calendar.lastDay.slice(2, 4)}`
    },
    formatDate(date) {
      return formatFullDate(date)
    },
    initializePreview(element) {
      this.previewResizeObserver?.disconnect()
      this.previewResizeObserver = new ResizeObserver(() => this.updatePreviewFit())
      this.previewResizeObserver.observe(element)
      this.previewTouchHandlers?.forEach(([name, handler]) =>
        element.removeEventListener(name, handler)
      )
      this.previewTouchHandlers = [
        ['touchstart', (event) => this.startPreviewPinch(event)],
        ['touchmove', (event) => this.movePreviewPinch(event)],
        ['touchend', (event) => this.endPreviewPinch(event)],
        ['touchcancel', (event) => this.endPreviewPinch(event)],
      ]
      this.previewTouchHandlers.forEach(([name, handler]) =>
        element.addEventListener(name, handler, { passive: false })
      )
      this.$nextTick(() => this.fitPreview())
    },
    previewTouchDistance(touches) {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      )
    },
    previewTouchMidpoint(touches) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      }
    },
    startPreviewPinch(event) {
      if (event.touches.length !== 2) return
      const viewport = this.$refs.previewViewport
      const stage = viewport?.querySelector('.calendar-sheet-stage')
      if (!viewport || !stage) return

      event.preventDefault()
      const midpoint = this.previewTouchMidpoint(event.touches)
      const stageRect = stage.getBoundingClientRect()
      this.previewMode = 'custom'
      this.previewPinch = {
        distance: this.previewTouchDistance(event.touches),
        scale: this.previewScale,
        pageX: (midpoint.x - stageRect.left) / this.previewScale,
        pageY: (midpoint.y - stageRect.top) / this.previewScale,
      }
    },
    movePreviewPinch(event) {
      if (!this.previewPinch || event.touches.length !== 2) return
      event.preventDefault()
      const viewport = this.$refs.previewViewport
      const distance = this.previewTouchDistance(event.touches)
      if (!viewport || !distance || !this.previewPinch.distance) return

      const midpoint = this.previewTouchMidpoint(event.touches)
      const viewportRect = viewport.getBoundingClientRect()
      const pinch = this.previewPinch
      const nextScale = Math.min(
        1.5,
        Math.max(.25, pinch.scale * distance / pinch.distance)
      )
      this.previewScale = nextScale
      this.$nextTick(() => {
        const stage = viewport.querySelector('.calendar-sheet-stage')
        if (!stage) return
        viewport.scrollLeft = Math.max(
          0,
          stage.offsetLeft + pinch.pageX * nextScale - (midpoint.x - viewportRect.left)
        )
        viewport.scrollTop = Math.max(
          0,
          stage.offsetTop + pinch.pageY * nextScale - (midpoint.y - viewportRect.top)
        )
      })
    },
    endPreviewPinch(event) {
      if (event.touches.length < 2) this.previewPinch = null
    },
    updatePreviewFit() {
      const viewport = this.$refs.previewViewport
      if (!viewport?.clientWidth) return
      this.previewFitScale = Math.min(1, viewport.clientWidth / (8.5 * 96))
      if (this.previewMode === 'fit') {
        this.previewScale = this.previewFitScale
        viewport.scrollTo({ top: 0, left: 0 })
      }
    },
    fitPreview() {
      this.previewMode = 'fit'
      this.updatePreviewFit()
    },
    zoomPreview(amount) {
      this.previewMode = 'custom'
      const viewport = this.$refs.previewViewport
      const oldWidth = 8.5 * 96 * this.previewScale
      const centerRatio = viewport && oldWidth > 0
        ? (viewport.scrollLeft + viewport.clientWidth / 2) / oldWidth
        : .5
      this.previewScale = Math.min(1.5, Math.max(.25, this.previewScale + amount))
      this.$nextTick(() => {
        if (!viewport) return
        const newWidth = 8.5 * 96 * this.previewScale
        viewport.scrollLeft = Math.max(0, centerRatio * newWidth - viewport.clientWidth / 2)
      })
    },

    resetWizard() {
      this.draft = {
        ...blankDraft(),
        country: this.state.country,
        subdivision: this.state.subdivision,
      }
      this.wizardStep = 1
      this.breakSuggestions = []
      this.suggestions = []
      this.selectedSuggestions = []
    },
    editWizardCalendar() {
      const calendar = this.activeCalendar
      this.draft = {
        name: calendar.name,
        schoolName: calendar.schoolName,
        firstDay: calendar.firstDay,
        lastDay: calendar.lastDay,
        semesterCount: calendar.semesterCount ?? 2,
        country: this.state.country,
        subdivision: this.state.subdivision,
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
      this.state.calendar = createCalendar(this.draft, selected)
      this.state.country = this.draft.country
      this.state.subdivision = this.draft.subdivision
      this.flash('Calendar created.')
    },
    saveSettings() {
      if (!this.wizardValid) return
      const calendar = this.activeCalendar
      Object.assign(calendar, {
        name: this.draft.name.trim(),
        schoolName: this.draft.schoolName.trim(),
        firstDay: this.draft.firstDay,
        lastDay: this.draft.lastDay,
        semesterCount: this.draft.semesterCount ?? 2,
      })
      this.state.country = this.draft.country
      this.state.subdivision = this.draft.subdivision
      this.settingsOpen = false
      this.flash('Calendar settings saved.')
    },
    deleteCalendar() {
      if (!confirm(`Start over and delete “${this.activeCalendar.name}”? This cannot be undone.`)) return
      this.state.calendar = null
      this.resetWizard()
      this.storageTipOpen = false
      this.dataHelpOpen = false
      this.welcomeOpen = true
      try {
        localStorage.removeItem(WELCOME_NOTICE_KEY)
        localStorage.removeItem(STORAGE_TIP_KEY)
      } catch { /* storage unavailable */ }
    },
    openEvent(event = null) {
      this.eventForm = event ? plainClone(event) : {
        ...blankEvent(),
        startDate: this.activeCalendar.firstDay,
        endDate: this.activeCalendar.firstDay,
      }
      this.eventDialogOpen = true
    },
    // Tap or click a day in the preview to add an event on that date. If the day
    // already has a single-day event, open it for editing instead.
    selectDay(date) {
      const calendar = this.activeCalendar
      if (!calendar || !date) return
      const index = calendar.events.findIndex((event) =>
        event.startDate === event.endDate && event.startDate === date)
      if (index !== -1) {
        this.openEvent({ ...calendar.events[index], index })
        return
      }
      this.eventForm = { ...blankEvent(), startDate: date, endDate: date }
      this.eventDialogOpen = true
    },
    saveEvent() {
      if (!this.eventForm.title.trim() || this.eventForm.startDate > this.eventForm.endDate) return
      const calendar = this.activeCalendar
      const { index, ...event } = this.eventForm
      if (index !== null) {
        calendar.events[index] = { ...event, title: event.title.trim() }
      } else {
        calendar.events.push({ ...event, title: event.title.trim() })
      }
      this.eventDialogOpen = false
      this.flash('Event saved.')
    },
    deleteEvent(index) {
      this.activeCalendar.events.splice(index, 1)
      this.eventDialogOpen = false
      this.flash('Event deleted.')
    },
    exportCurrent() {
      const csv = exportCalendarCsv(this.activeCalendar)
      downloadCsv(csv, `${this.slug(this.activeCalendar.name)}.calendar.csv`)
    },
    async shareCurrent() {
      const csv = exportCalendarCsv(this.activeCalendar)
      const filename = `${this.slug(this.activeCalendar.name)}.calendar.csv`
      try {
        if (!await shareCsv(csv, filename)) {
          downloadCsv(csv, filename)
          this.flash('Sharing is unavailable here, so the CSV file was downloaded.')
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          downloadCsv(csv, filename)
          this.flash('Sharing failed, so the CSV file was downloaded instead.')
        }
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
      const calendar = this.importPreviews
        .find((preview) => preview.selected && preview.errors.length === 0)?.calendar
      if (!calendar) return
      if (this.activeCalendar &&
        !confirm('Importing will replace your current calendar. Continue?')) return
      this.state.calendar = calendar
      this.importOpen = false
      this.importPreviews = []
      this.flash('Calendar imported.')
    },
    dismissWelcome(showStorageTip = true) {
      this.welcomeOpen = false
      try { localStorage.setItem(WELCOME_NOTICE_KEY, '1') } catch { /* storage unavailable */ }
      if (showStorageTip) this.showStorageTip()
    },
    showStorageTip() {
      this.dataHelpOpen = false
      this.storageTipOpen = true
    },
    dismissStorageTip() {
      this.storageTipOpen = false
      try { localStorage.setItem(STORAGE_TIP_KEY, '1') } catch { /* storage unavailable */ }
    },
    openDataHelp() {
      this.dismissStorageTip()
      this.dataHelpOpen = true
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
