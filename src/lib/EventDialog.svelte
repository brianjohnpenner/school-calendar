<script>
  import { eventCategories } from '../data.js'
  import { store } from '../store.svelte.js'
  import { flash } from '../notify.svelte.js'
  import { ui } from '../ui.svelte.js'

  // The dialog is mounted only while open, so the form seeds once from the
  // event handed over in `ui.editingEvent`.
  let form = $state({ ...ui.editingEvent })

  const invalid = $derived(!form.title.trim() || form.startDate > form.endDate)

  function close() {
    ui.eventOpen = false
  }

  function saveEvent() {
    if (invalid) return
    const calendar = store.state.calendar
    const { index, ...event } = form
    event.title = event.title.trim()
    if (index !== null) {
      calendar.events[index] = event
    } else {
      calendar.events.push(event)
    }
    close()
    flash('Event saved.')
  }

  function deleteEvent() {
    store.state.calendar.events.splice(form.index, 1)
    close()
    flash('Event deleted.')
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && close()} />

<div class="modal-backdrop">
  <form class="modal-card" onsubmit={(event) => { event.preventDefault(); saveEvent() }}>
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-xl font-semibold">{form.index !== null ? 'Edit event' : 'Add event'}</h2>
      <button type="button" class="btn-quiet" onclick={close}>Close</button>
    </div>
    <div class="grid gap-5">
      <label class="field">Event name<input bind:value={form.title} required></label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="field">Start date<input type="date" bind:value={form.startDate} required></label>
        <label class="field">End date<input type="date" bind:value={form.endDate} required></label>
      </div>
      <fieldset class="grid gap-2">
        <legend class="mb-1 text-sm font-medium text-slate-700">Category</legend>
        {#each Object.entries(eventCategories) as [key, category] (key)}
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 {form.category === key ? 'border-cyan-800 bg-cyan-50/50' : 'border-slate-200 hover:bg-slate-50'}">
            <input type="radio" name="event-category" class="mt-0.5 size-4 accent-cyan-800" value={key} bind:group={form.category}>
            <span class="min-w-0">
              <strong class="block text-sm font-semibold text-slate-900">{category.label}</strong>
              <span class="block text-xs font-normal text-slate-500">{category.description}</span>
            </span>
          </label>
        {/each}
      </fieldset>
      {#if form.startDate > form.endDate}
        <p class="text-sm text-red-700">End date must be on or after the start date.</p>
      {/if}
    </div>
    <div class="mt-7 flex items-center justify-between">
      {#if form.index !== null}
        <button type="button" class="btn-quiet text-red-700" onclick={deleteEvent}>Delete event</button>
      {:else}
        <span></span>
      {/if}
      <button class="btn-primary" disabled={invalid}>Save event</button>
    </div>
  </form>
</div>
