<script>
  import { onMount, tick } from 'svelte'
  import { calendarMonths } from '../data.js'
  import { buildMonthView, formatFullDate } from '../calendar-view.js'
  import { selectDay } from '../ui.svelte.js'

  let { activeCalendar, previewCalendar } = $props()

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  let previewScale = $state(1)
  let previewFitScale = $state(1)
  let previewMode = $state('fit') // 'fit' | 'custom'
  let previewPinch = null
  let viewport // bound to the scroll viewport element

  const months = $derived(
    calendarMonths(previewCalendar).map((month, index) => buildMonthView(previewCalendar, month, index))
  )
  const monthRowCount = $derived(Math.ceil(calendarMonths(previewCalendar).length / 2))
  const printDensityClass = $derived.by(() => {
    const count = calendarMonths(previewCalendar).length
    const events = previewCalendar.events.length
    if (count >= 12 || events > 28) return 'density-tight'
    if (count >= 11 || events > 18) return 'density-compact'
    return 'density-comfortable'
  })
  const shortSchoolYearLabel = $derived(
    `${previewCalendar.firstDay.slice(0, 4)}–${previewCalendar.lastDay.slice(2, 4)}`
  )
  const isZoomed = $derived(previewScale > previewFitScale + 0.001)

  const formatDate = formatFullDate

  function toStyle(entries) {
    return Object.entries(entries).map(([key, value]) => `${key}:${value}`).join(';')
  }

  function touchDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
  }
  function touchMidpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    }
  }
  function startPreviewPinch(event) {
    if (event.touches.length !== 2) return
    const stage = viewport?.querySelector('.calendar-sheet-stage')
    if (!viewport || !stage) return
    event.preventDefault()
    const midpoint = touchMidpoint(event.touches)
    const stageRect = stage.getBoundingClientRect()
    previewMode = 'custom'
    previewPinch = {
      distance: touchDistance(event.touches),
      scale: previewScale,
      pageX: (midpoint.x - stageRect.left) / previewScale,
      pageY: (midpoint.y - stageRect.top) / previewScale,
    }
  }
  async function movePreviewPinch(event) {
    if (!previewPinch || event.touches.length !== 2) return
    event.preventDefault()
    const distance = touchDistance(event.touches)
    if (!viewport || !distance || !previewPinch.distance) return
    const midpoint = touchMidpoint(event.touches)
    const viewportRect = viewport.getBoundingClientRect()
    const pinch = previewPinch
    const nextScale = Math.min(1.5, Math.max(0.25, pinch.scale * distance / pinch.distance))
    previewScale = nextScale
    await tick()
    const stage = viewport.querySelector('.calendar-sheet-stage')
    if (!stage) return
    viewport.scrollLeft = Math.max(0, stage.offsetLeft + pinch.pageX * nextScale - (midpoint.x - viewportRect.left))
    viewport.scrollTop = Math.max(0, stage.offsetTop + pinch.pageY * nextScale - (midpoint.y - viewportRect.top))
  }
  function endPreviewPinch(event) {
    if (event.touches.length < 2) previewPinch = null
  }

  function updatePreviewFit() {
    if (!viewport?.clientWidth) return
    previewFitScale = Math.min(1, viewport.clientWidth / (8.5 * 96))
    if (previewMode === 'fit') {
      previewScale = previewFitScale
      viewport.scrollTo({ top: 0, left: 0 })
    }
  }
  function fitPreview() {
    previewMode = 'fit'
    updatePreviewFit()
  }
  async function zoomPreview(amount) {
    previewMode = 'custom'
    const oldWidth = 8.5 * 96 * previewScale
    const centerRatio = viewport && oldWidth > 0
      ? (viewport.scrollLeft + viewport.clientWidth / 2) / oldWidth
      : 0.5
    previewScale = Math.min(1.5, Math.max(0.25, previewScale + amount))
    await tick()
    if (!viewport) return
    const newWidth = 8.5 * 96 * previewScale
    viewport.scrollLeft = Math.max(0, centerRatio * newWidth - viewport.clientWidth / 2)
  }

  function printCalendar() {
    window.print()
  }

  onMount(() => {
    const observer = new ResizeObserver(() => updatePreviewFit())
    observer.observe(viewport)
    const handlers = [
      ['touchstart', startPreviewPinch],
      ['touchmove', movePreviewPinch],
      ['touchend', endPreviewPinch],
      ['touchcancel', endPreviewPinch],
    ]
    handlers.forEach(([name, handler]) => viewport.addEventListener(name, handler, { passive: false }))
    tick().then(fitPreview)
    return () => {
      observer.disconnect()
      handlers.forEach(([name, handler]) => viewport.removeEventListener(name, handler))
    }
  })
</script>

<!-- Calendar preview (live during setup, saved calendar afterwards) -->
<section class="min-w-0 rounded-2xl bg-slate-300/60 p-3 sm:p-6">
  <div class="mb-3 flex items-center justify-end gap-1 rounded-xl bg-white/80 p-1.5 shadow-sm">
    <button class="btn-quiet size-10 p-0" type="button" aria-label="Print calendar" title="Print calendar" onclick={printCalendar}>
      <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M7 3h10v5H7V3Zm-2 7h14a3 3 0 0 1 3 3v5h-4v3H6v-3H2v-5a3 3 0 0 1 3-3Zm3 9h8v-5H8v5Zm11-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>
      </svg>
    </button>
    <button class="btn-quiet size-10 p-0 text-lg" type="button" aria-label="Zoom out" disabled={previewScale <= 0.25} onclick={() => zoomPreview(-0.1)}>−</button>
    <button class="btn-quiet min-w-20" type="button" onclick={fitPreview}>Fit <span class="ml-1 text-xs text-slate-500">{Math.round(previewScale * 100)}%</span></button>
    <button class="btn-quiet size-10 p-0 text-lg" type="button" aria-label="Zoom in" disabled={previewScale >= 1.5} onclick={() => zoomPreview(0.1)}>+</button>
  </div>
  <div class="calendar-preview-wrap" class:is-zoomed={isZoomed} bind:this={viewport}>
    <div class="calendar-sheet-stage" style={`width:${8.5 * previewScale}in;min-height:${11 * previewScale}in`}>
      <article
        id="print-sheet"
        class="calendar-sheet {printDensityClass}"
        style={`--month-rows:${monthRowCount};transform:scale(${previewScale})`}
      >
        <header class="calendar-header">
          <div class="calendar-identity">
            <div>
              <h1>{previewCalendar.schoolName}</h1>
            </div>
          </div>
          <div class="calendar-year">
            <strong>{shortSchoolYearLabel}</strong>
            <span>School Calendar</span>
          </div>
        </header>
        <div class="months-grid">
          {#each months as month (month.key)}
            <section class="month-block" style={toStyle(month.styles)}>
              <h2 class="month-heading">
                <span>{month.name}</span>
                <small>{month.year}</small>
              </h2>
              <table class="month-table">
                <thead>
                  <tr>
                    {#each weekdays as day, dayIndex (dayIndex)}
                      <th class:weekend={dayIndex === 0 || dayIndex === 6}>{day.slice(0, 1)}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each month.weeks as week, weekIndex (`${month.key}-${weekIndex}`)}
                    <tr>
                      {#each week as day, dayIndex (day?.date ?? `${month.key}-${weekIndex}-${dayIndex}`)}
                        <td class:weekend={dayIndex === 0 || dayIndex === 6} class:day-clickable={day && activeCalendar}>
                          {#if day}
                            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                            <span
                              class="day-number {day.classes}"
                              role={activeCalendar ? 'button' : null}
                              tabindex={activeCalendar ? 0 : null}
                              aria-label={activeCalendar ? `Add event on ${formatDate(day.date)}` : null}
                              onclick={() => activeCalendar && selectDay(day.date)}
                              onkeydown={(event) => {
                                if (activeCalendar && (event.key === 'Enter' || event.key === ' ')) {
                                  event.preventDefault()
                                  selectDay(day.date)
                                }
                              }}
                            >{day.number}</span>
                          {/if}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
              <div class="month-events">
                {#each month.events as event (`${event.key}-${month.key}`)}
                  <div class="month-event">
                    <span class="month-event-date">{event.dateLabel}</span>
                    <span class="month-event-title">{event.title}</span>
                  </div>
                {/each}
              </div>
            </section>
          {/each}
        </div>
        <p class="calendar-sheet-footer">Generated with <a href="https://schoolcalendar.planetnine.tech">schoolcalendar.planetnine.tech</a></p>
      </article>
    </div>
  </div>
</section>
