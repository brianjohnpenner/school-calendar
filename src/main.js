import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'
import './style.css'
import {
  STORAGE_KEY, categories, regions, defaultState, monthCount, createCalendar,
  calendarMonths, schoolDayStats, plainClone, uid, todayIso,
} from './data.js'
import { buildMonthView, formatFullDate } from './calendar-view.js'
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
    previewScale: 1,
    previewFitScale: 1,
    previewMode: 'fit',
    previewResizeObserver: null,
    previewPinch: null,
    previewTouchHandlers: null,
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
    get months() {
      return calendarMonths(this.activeCalendar)
        .map((month, index) => buildMonthView(this.activeCalendar, month, index))
    },
    get schoolDaySummary() { return schoolDayStats(this.activeCalendar) },
    get sortedEvents() {
      return this.activeCalendar
        ? [...this.activeCalendar.events].sort((a, b) => a.startDate.localeCompare(b.startDate))
        : []
    },
    get eventCount() { return (this.activeCalendar?.events.length ?? 0) + 2 },
    get monthRowCount() { return Math.ceil(calendarMonths(this.activeCalendar).length / 2) },
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
      const count = calendarMonths(this.activeCalendar).length
      const eventCount = this.activeCalendar?.events.length ?? 0
      if (count >= 12 || eventCount > 28) return 'density-tight'
      if (count >= 11 || eventCount > 18) return 'density-compact'
      return 'density-comfortable'
    },

    get shortSchoolYearLabel() {
      if (!this.activeCalendar) return ''
      const start = this.activeCalendar.term.firstDay.slice(0, 4)
      const end = this.activeCalendar.term.lastDay.slice(2, 4)
      return `${start}–${end}`
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
