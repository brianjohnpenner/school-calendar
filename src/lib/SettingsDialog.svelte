<script>
  import { regions, monthCount } from '../data.js'
  import { store } from '../store.svelte.js'
  import { flash } from '../notify.svelte.js'
  import { ui } from '../ui.svelte.js'

  const calendar = store.state.calendar

  // Edit a draft copy; commit to the live calendar only on save.
  let draft = $state({
    name: calendar.name,
    schoolName: calendar.schoolName,
    firstDay: calendar.firstDay,
    lastDay: calendar.lastDay,
    semesterCount: calendar.semesterCount ?? 2,
    country: store.state.country,
    subdivision: store.state.subdivision,
  })

  const subdivisions = $derived(regions[draft.country]?.subdivisions ?? {})
  const termMonthCount = $derived(monthCount(draft.firstDay, draft.lastDay))
  const valid = $derived(
    draft.name.trim() && draft.schoolName.trim() &&
    draft.firstDay <= draft.lastDay &&
    termMonthCount >= 8 && termMonthCount <= 12
  )

  function close() {
    ui.settingsOpen = false
  }

  function countryChanged() {
    draft.subdivision = Object.keys(subdivisions)[0]
  }

  function saveSettings() {
    if (!valid) return
    Object.assign(calendar, {
      name: draft.name.trim(),
      schoolName: draft.schoolName.trim(),
      firstDay: draft.firstDay,
      lastDay: draft.lastDay,
      semesterCount: draft.semesterCount ?? 2,
    })
    store.state.country = draft.country
    store.state.subdivision = draft.subdivision
    close()
    flash('Calendar settings saved.')
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && close()} />

<div class="modal-backdrop">
  <form class="modal-card" onsubmit={(event) => { event.preventDefault(); saveSettings() }}>
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-xl font-semibold">Calendar settings</h2>
      <button type="button" class="btn-quiet" onclick={close}>Close</button>
    </div>
    <div class="grid gap-5">
      <label class="field">Calendar name<input bind:value={draft.name}></label>
      <label class="field">School name<input bind:value={draft.schoolName}></label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field">First day<input type="date" bind:value={draft.firstDay}></label>
        <label class="field">Last day<input type="date" bind:value={draft.lastDay}></label>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field">Country<select bind:value={draft.country} onchange={countryChanged}>{#each Object.entries(regions) as [code, country] (code)}<option value={code}>{country.label}</option>{/each}</select></label>
        <label class="field">Province or state<select bind:value={draft.subdivision}>{#each Object.entries(subdivisions) as [code, label] (code)}<option value={code}>{label}</option>{/each}</select></label>
      </div>
      <label class="field">Semesters<select bind:value={draft.semesterCount}>{#each [2, 3, 4] as count (count)}<option value={count}>{count}</option>{/each}</select></label>
      {#if termMonthCount < 8 || termMonthCount > 12}
        <p class="text-sm text-red-700">The term must span 8–12 calendar months.</p>
      {/if}
    </div>
    <div class="mt-7 flex justify-end"><button class="btn-primary" disabled={!valid}>Save settings</button></div>
  </form>
</div>
