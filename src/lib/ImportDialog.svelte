<script>
  import { parseImport } from '../portability.js'
  import { store } from '../store.svelte.js'
  import { flash } from '../notify.svelte.js'
  import { ui } from '../ui.svelte.js'

  let { activeCalendar } = $props()

  let importError = $state('')
  let importPreviews = $state([])

  function close() {
    ui.importOpen = false
  }

  async function readImport(file) {
    if (!file) return
    importError = ''
    try {
      importPreviews = parseImport(await file.text())
    } catch (error) {
      importPreviews = []
      importError = error.message
    }
  }

  function confirmImport() {
    const calendar = importPreviews
      .find((preview) => preview.selected && preview.errors.length === 0)?.calendar
    if (!calendar) return
    if (activeCalendar && !confirm('Importing will replace your current calendar. Continue?')) return
    store.state.calendar = calendar
    close()
    flash('Calendar imported.')
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && close()} />

<div class="modal-backdrop">
  <section class="modal-card">
    <div class="mb-5 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Import a calendar</h2>
        <p class="mt-1 text-sm text-slate-500">Importing replaces your current calendar.</p>
      </div>
      <button class="btn-quiet" onclick={close}>Close</button>
    </div>
    <label
      class="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-slate-300 px-5 py-10 text-center hover:border-cyan-700 hover:bg-cyan-50/40"
      ondragover={(event) => event.preventDefault()}
      ondrop={(event) => { event.preventDefault(); readImport(event.dataTransfer.files[0]) }}
    >
      <strong class="text-sm">Drop a calendar CSV file here</strong>
      <span class="mt-1 text-xs text-slate-500">or click to choose a file</span>
      <input type="file" accept=".csv,text/csv" class="sr-only" onchange={(event) => readImport(event.target.files[0])}>
    </label>
    {#if importError}
      <p class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{importError}</p>
    {/if}
    {#if importPreviews.length}
      <div class="mt-5 space-y-3">
        {#each importPreviews as preview (preview.calendar.name)}
          <label class="flex gap-3 rounded-xl border border-slate-200 p-4">
            <input type="checkbox" class="mt-1 size-4 accent-cyan-800" bind:checked={preview.selected} disabled={preview.errors.length > 0}>
            <span class="min-w-0">
              <strong class="block">{preview.calendar.name}</strong>
              <span class="text-sm text-slate-500">{preview.calendar.schoolName} · {preview.calendar.events.length} events</span>
              {#each preview.errors as error (error)}
                <span class="mt-1 block text-xs text-red-700">{error}</span>
              {/each}
            </span>
          </label>
        {/each}
        <div class="flex justify-end"><button class="btn-primary" onclick={confirmImport}>Import calendar</button></div>
      </div>
    {/if}
  </section>
</div>
