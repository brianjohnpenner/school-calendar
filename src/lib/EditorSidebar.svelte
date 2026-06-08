<script>
  import { categories, schoolDayStats, splitIntoSemesters } from '../data.js'
  import { formatFullDate } from '../calendar-view.js'
  import { exportCalendarCsv, downloadCsv, shareCsv } from '../portability.js'
  import { store } from '../store.svelte.js'
  import { flash } from '../notify.svelte.js'
  import { ui, openEvent } from '../ui.svelte.js'
  import { resetWizard } from '../wizard.svelte.js'

  let { activeCalendar, previewCalendar } = $props()

  const schoolDaySummary = $derived(schoolDayStats(previewCalendar))
  const semesterSplits = $derived(splitIntoSemesters(previewCalendar, previewCalendar.semesterCount ?? 2))
  const sortedEvents = $derived(
    activeCalendar.events
      .map((event, index) => ({ ...event, index }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  )
  const eventCount = $derived(activeCalendar.events.length + 2)

  const formatDate = formatFullDate

  function slug(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function exportCurrent() {
    const csv = exportCalendarCsv(activeCalendar)
    downloadCsv(csv, `${slug(activeCalendar.name)}.calendar.csv`)
  }

  async function shareCurrent() {
    const csv = exportCalendarCsv(activeCalendar)
    const filename = `${slug(activeCalendar.name)}.calendar.csv`
    try {
      if (!await shareCsv(csv, filename)) {
        downloadCsv(csv, filename)
        flash('Sharing is unavailable here, so the CSV file was downloaded.')
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        downloadCsv(csv, filename)
        flash('Sharing failed, so the CSV file was downloaded instead.')
      }
    }
  }

  function deleteCalendar() {
    if (!confirm(`Delete “${activeCalendar.name}”? This cannot be undone.`)) return
    store.state.calendar = null
    resetWizard()
  }
</script>

<div class="grid gap-4">
  <section class="panel overflow-hidden">
    <div class="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
      <div>
        <h2 class="font-semibold">School days</h2>
        <p class="mt-1 text-xs text-slate-500">Weekdays excluding holidays</p>
      </div>
      <strong class="text-3xl leading-none text-cyan-900">{schoolDaySummary.total}</strong>
    </div>
    <div class="grid grid-cols-5 gap-px bg-slate-200">
      {#each schoolDaySummary.months as month (`${month.year}-${month.month}`)}
        <div class="bg-white px-2 py-2 text-center">
          <span class="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{month.label}</span>
          <strong class="mt-0.5 block text-sm text-slate-900">{month.days}</strong>
        </div>
      {/each}
    </div>
  </section>

  <section class="panel overflow-hidden">
    <div class="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
      <div>
        <h2 class="font-semibold">Semesters</h2>
        <p class="mt-1 text-xs text-slate-500">Even split by school days · edit in Settings</p>
      </div>
      <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{semesterSplits.length}</span>
    </div>
    <div class="divide-y divide-slate-100">
      {#each semesterSplits as semester, index (index)}
        <div class="p-4">
          <strong class="block text-sm text-slate-900">{semester.label}</strong>
          <span class="text-xs text-slate-500">{formatDate(semester.startDate)} – {formatDate(semester.endDate)}</span>
          <span class="mt-0.5 block text-xs text-slate-400">{semester.schoolDays} school days</span>
        </div>
      {/each}
      {#if !semesterSplits.length}
        <p class="p-4 text-center text-xs text-slate-500">No school days to divide.</p>
      {/if}
    </div>
  </section>

  <section class="panel overflow-hidden">
    <div class="border-b border-slate-200 p-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">Events</h2>
        <div class="flex items-center gap-2">
          <span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{eventCount}</span>
          <button class="btn-primary size-8 rounded-full p-0 text-lg leading-none" type="button" aria-label="Add event" onclick={() => openEvent()}>+</button>
        </div>
      </div>
    </div>
    <div class="max-h-[430px] divide-y divide-slate-100 overflow-y-auto">
      <button class="block w-full p-4 text-left hover:bg-slate-50" onclick={() => (ui.settingsOpen = true)}>
        <strong class="block text-sm text-blue-800">First Day of School</strong>
        <span class="text-xs text-slate-500">{formatDate(activeCalendar.firstDay)}</span>
      </button>
      {#each sortedEvents as event (event.index)}
        <button class="block w-full p-4 text-left hover:bg-slate-50" onclick={() => openEvent(event)}>
          <strong class="event-list-label block truncate text-sm {(categories[event.category] ?? categories.event).className}">{event.title}</strong>
          <span class="text-xs text-slate-500">{event.startDate === event.endDate ? formatDate(event.startDate) : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`}</span>
        </button>
      {/each}
      <button class="block w-full p-4 text-left hover:bg-slate-50" onclick={() => (ui.settingsOpen = true)}>
        <strong class="block text-sm text-blue-800">Last Day of School</strong>
        <span class="text-xs text-slate-500">{formatDate(activeCalendar.lastDay)}</span>
      </button>
    </div>
    <div class="grid grid-cols-2 gap-2 border-t border-slate-200 p-3">
      <button class="btn-quiet" onclick={() => (ui.settingsOpen = true)}>Settings</button>
      <button class="btn-quiet" onclick={() => (ui.importOpen = true)}>Import</button>
      <button class="btn-quiet" onclick={shareCurrent}>Share</button>
      <button class="btn-quiet" onclick={exportCurrent}>Download</button>
      <button class="btn-quiet col-span-2 text-red-700 hover:bg-red-50" onclick={deleteCalendar}>Delete calendar</button>
    </div>
  </section>
</div>
