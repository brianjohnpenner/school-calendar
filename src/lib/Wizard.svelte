<script>
  import { regions, monthCount, createCalendar, splitIntoSemesters } from '../data.js'
  import { formatFullDate } from '../calendar-view.js'
  import { store } from '../store.svelte.js'
  import { flash } from '../notify.svelte.js'
  import { ui } from '../ui.svelte.js'
  import { wizard, draftCalendar, defaultBreakSuggestions } from '../wizard.svelte.js'

  let loadingHolidays = $state(false)

  const subdivisions = $derived(regions[wizard.draft.country]?.subdivisions ?? {})
  const termMonthCount = $derived(monthCount(wizard.draft.firstDay, wizard.draft.lastDay))
  const wizardValid = $derived(
    wizard.draft.name.trim() && wizard.draft.schoolName.trim() &&
    wizard.draft.firstDay <= wizard.draft.lastDay &&
    termMonthCount >= 8 && termMonthCount <= 12
  )
  const breaksValid = $derived(
    wizard.breakSuggestions.every((item) =>
      !item.enabled ||
      (item.title.trim() && item.startDate <= item.endDate &&
        item.startDate >= wizard.draft.firstDay && item.startDate <= wizard.draft.lastDay &&
        item.endDate >= wizard.draft.firstDay && item.endDate <= wizard.draft.lastDay)
    )
  )
  const semesterSplits = $derived(
    splitIntoSemesters(draftCalendar(), wizard.draft.semesterCount ?? 2)
  )

  const formatDate = formatFullDate

  function countryChanged() {
    wizard.draft.subdivision = Object.keys(subdivisions)[0]
  }

  function prepareBreakSuggestions() {
    if (!wizardValid) return
    wizard.breakSuggestions = defaultBreakSuggestions(wizard.draft.firstDay, wizard.draft.lastDay)
    wizard.step = 3
  }

  async function loadSuggestions() {
    loadingHolidays = true
    try {
      const { holidaySuggestions } = await import('../holidays.js')
      wizard.suggestions = holidaySuggestions(
        wizard.draft.country, wizard.draft.subdivision, wizard.draft.firstDay, wizard.draft.lastDay
      )
      wizard.selectedSuggestions = wizard.suggestions.map((item) => item.suggestionId)
      wizard.step = 4
    } catch {
      flash('Holiday suggestions could not be loaded.')
    } finally {
      loadingHolidays = false
    }
  }

  function createFromWizard() {
    const selectedBreaks = wizard.breakSuggestions
      .filter((item) => item.enabled)
      .map(({ enabled, ...item }) => item)
    const selectedHolidays = wizard.suggestions
      .filter((item) => wizard.selectedSuggestions.includes(item.suggestionId))
    const selected = [...selectedBreaks, ...selectedHolidays]
    store.state.calendar = createCalendar(wizard.draft, selected)
    store.state.country = wizard.draft.country
    store.state.subdivision = wizard.draft.subdivision
    flash('Calendar created.')
  }
</script>

<section class="panel p-5">
  <div class="mb-5">
    <p class="text-sm font-semibold text-cyan-800">Create your calendar</p>
    <h2 class="mt-1 text-lg font-semibold">Step {wizard.step} of 5</h2>
    <div class="mt-3 flex items-center gap-1.5">
      {#each [1, 2, 3, 4, 5] as step (step)}
        <span class="h-1.5 flex-1 rounded-full {wizard.step >= step ? 'bg-cyan-800' : 'bg-slate-200'}"></span>
      {/each}
    </div>
  </div>

  {#if wizard.step === 1}
    <div class="grid gap-4">
      <h3 class="text-base font-semibold">Name your calendar</h3>
      <label class="field">Calendar name<input bind:value={wizard.draft.name} placeholder="2026–2027 School Calendar"></label>
      <label class="field">School name<input bind:value={wizard.draft.schoolName} placeholder="Your school's name"></label>
      <div class="flex justify-end">
        <button class="btn-primary" disabled={!wizard.draft.name.trim() || !wizard.draft.schoolName.trim()} onclick={() => (wizard.step = 2)}>Continue</button>
      </div>
    </div>
  {:else if wizard.step === 2}
    <div class="grid gap-4">
      <h3 class="text-base font-semibold">Set the school year</h3>
      <label class="field">First day of school<input type="date" bind:value={wizard.draft.firstDay}></label>
      <label class="field">Last day of school<input type="date" bind:value={wizard.draft.lastDay}></label>
      <label class="field">Country<select bind:value={wizard.draft.country} onchange={countryChanged}>{#each Object.entries(regions) as [code, country] (code)}<option value={code}>{country.label}</option>{/each}</select></label>
      <label class="field">Province or state<select bind:value={wizard.draft.subdivision}>{#each Object.entries(subdivisions) as [code, label] (code)}<option value={code}>{label}</option>{/each}</select></label>
      <p class="rounded-xl px-3 py-2 text-xs {termMonthCount >= 8 && termMonthCount <= 12 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}">
        {termMonthCount || 0} calendar months selected. Choose a term spanning 8–12 months.
      </p>
      <div class="flex justify-between">
        <button class="btn-secondary" onclick={() => (wizard.step = 1)}>Back</button>
        <button class="btn-primary" disabled={!wizardValid} onclick={prepareBreakSuggestions}>Continue</button>
      </div>
    </div>
  {:else if wizard.step === 3}
    <div class="grid gap-4">
      <h3 class="text-base font-semibold">Choose breaks &amp; meeting days</h3>
      <p class="text-xs text-slate-600">Select the breaks and meeting days your school observes and adjust their dates. Uncheck any you don't need.</p>
      <div class="space-y-3">
        {#each wizard.breakSuggestions as schoolBreak (schoolBreak.suggestionId)}
          <section class="rounded-xl border border-slate-200 p-3">
            <label class="flex cursor-pointer items-center gap-2">
              <input class="size-4 accent-cyan-800" type="checkbox" bind:checked={schoolBreak.enabled}>
              <strong class="text-sm">{schoolBreak.title}</strong>
            </label>
            <div class="mt-3 grid gap-3 {schoolBreak.enabled ? '' : 'opacity-45'}">
              <label class="field">Start date<input type="date" bind:value={schoolBreak.startDate} disabled={!schoolBreak.enabled}></label>
              <label class="field">End date<input type="date" bind:value={schoolBreak.endDate} disabled={!schoolBreak.enabled}></label>
            </div>
            {#if schoolBreak.enabled && (schoolBreak.startDate > schoolBreak.endDate || schoolBreak.startDate < wizard.draft.firstDay || schoolBreak.endDate > wizard.draft.lastDay)}
              <p class="mt-2 text-xs text-red-700">Break dates must be in the school year, with the start on or before the end.</p>
            {/if}
          </section>
        {/each}
      </div>
      <div class="flex justify-between">
        <button class="btn-secondary" onclick={() => (wizard.step = 2)}>Back</button>
        <button class="btn-primary" disabled={!breaksValid || loadingHolidays} onclick={loadSuggestions}>{loadingHolidays ? 'Loading…' : 'Continue'}</button>
      </div>
    </div>
  {:else if wizard.step === 4}
    <div class="grid gap-4">
      <h3 class="text-base font-semibold">Suggested holidays</h3>
      <p class="text-xs text-slate-600">Suggestions cover every displayed month. They are editable after creation.</p>
      <div class="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {#each wizard.suggestions as holiday (holiday.suggestionId)}
          <label class="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50">
            <input class="mt-0.5 size-4 accent-cyan-800" type="checkbox" value={holiday.suggestionId} bind:group={wizard.selectedSuggestions}>
            <span class="min-w-0">
              <strong class="block text-sm">{holiday.title}</strong>
              <span class="text-xs text-slate-500">{formatDate(holiday.startDate)}{holiday.holiday.observed ? ' · Observed' : ''}</span>
            </span>
          </label>
        {/each}
        {#if !wizard.suggestions.length}
          <p class="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">No public holiday suggestions were found for this term.</p>
        {/if}
      </div>
      <div class="flex justify-between">
        <button class="btn-secondary" onclick={() => (wizard.step = 3)}>Back</button>
        <button class="btn-primary" onclick={() => (wizard.step = 5)}>Continue</button>
      </div>
    </div>
  {:else if wizard.step === 5}
    <div class="grid gap-4">
      <h3 class="text-base font-semibold">How many semesters?</h3>
      <p class="text-xs text-slate-600">We'll divide the school year into that many semesters of roughly equal school days. The split updates automatically as you edit holidays and breaks.</p>
      <div class="grid grid-cols-3 gap-2">
        {#each [2, 3, 4] as count (count)}
          <button type="button" class="rounded-xl border px-3 py-2 text-sm font-semibold {wizard.draft.semesterCount === count ? 'border-cyan-800 bg-cyan-800 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}" onclick={() => (wizard.draft.semesterCount = count)}>{count}</button>
        {/each}
      </div>
      <div class="space-y-2">
        {#each semesterSplits as semester, index (index)}
          <div class="rounded-xl border border-slate-200 p-3">
            <strong class="block text-sm">{semester.label}</strong>
            <span class="text-xs text-slate-500">{formatDate(semester.startDate)} – {formatDate(semester.endDate)}</span>
            <span class="mt-0.5 block text-xs text-slate-400">{semester.schoolDays} school days</span>
          </div>
        {/each}
        {#if !semesterSplits.length}
          <p class="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">No school days are available to divide.</p>
        {/if}
      </div>
      <div class="flex justify-between">
        <button class="btn-secondary" onclick={() => (wizard.step = 4)}>Back</button>
        <button class="btn-primary" onclick={createFromWizard}>Create calendar</button>
      </div>
    </div>
  {/if}

  <div class="mt-5 border-t border-slate-200 pt-4">
    <button class="btn-quiet w-full" onclick={() => (ui.importOpen = true)}>Import a calendar CSV</button>
  </div>
</section>
