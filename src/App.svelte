<script>
  import { onMount } from 'svelte'
  import { store } from './store.svelte.js'
  import { notice } from './notify.svelte.js'
  import { ui } from './ui.svelte.js'
  import { resetWizard, draftCalendar } from './wizard.svelte.js'
  import Wizard from './lib/Wizard.svelte'
  import EditorSidebar from './lib/EditorSidebar.svelte'
  import CalendarPreview from './lib/CalendarPreview.svelte'
  import EventDialog from './lib/EventDialog.svelte'
  import SettingsDialog from './lib/SettingsDialog.svelte'
  import ImportDialog from './lib/ImportDialog.svelte'
  import StorageNotice from './lib/StorageNotice.svelte'

  const STORAGE_NOTICE_KEY = 'school-calendar-generator:storage-notice'
  let storageNoticeOpen = $state(false)

  const activeCalendar = $derived(store.state.calendar ?? null)
  // The saved calendar, or a live preview built from the in-progress wizard draft.
  const previewCalendar = $derived(activeCalendar ?? draftCalendar())

  onMount(() => {
    if (!activeCalendar) resetWizard()
    try {
      if (!localStorage.getItem(STORAGE_NOTICE_KEY)) storageNoticeOpen = true
    } catch { /* storage unavailable */ }
  })

  function dismissStorageNotice() {
    storageNoticeOpen = false
    try {
      localStorage.setItem(STORAGE_NOTICE_KEY, '1')
    } catch { /* storage unavailable */ }
  }
</script>

<div class="min-h-screen">
  <header class="border-b border-slate-200 bg-white/90 backdrop-blur">
    <div class="mx-auto flex max-w-[1600px] items-center px-4 py-3 sm:px-6">
      <div class="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-900 text-lg font-bold text-white">SC</span>
        <span class="min-w-0">
          <strong class="block text-sm text-slate-900">School Calendar Generator</strong>
          <span class="block truncate text-xs text-slate-500">Private, local, and printable</span>
        </span>
      </div>
    </div>
  </header>

  {#if notice.message}
    <div class="fixed right-4 top-20 z-[70] rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">{notice.message}</div>
  {/if}

  <main class="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
    {#if activeCalendar}
      <div class="mb-5">
        <span class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Calendar</span>
        <p class="mt-1 text-lg font-semibold text-slate-900">{activeCalendar.name}</p>
      </div>
    {/if}

    <div class="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside>
        {#if activeCalendar}
          <EditorSidebar {activeCalendar} {previewCalendar} />
        {:else}
          <Wizard />
        {/if}
      </aside>

      <CalendarPreview {activeCalendar} {previewCalendar} />
    </div>
  </main>

  <StorageNotice open={storageNoticeOpen} ondismiss={dismissStorageNotice} />
  {#if ui.eventOpen}<EventDialog />{/if}
  {#if ui.settingsOpen}<SettingsDialog />{/if}
  {#if ui.importOpen}<ImportDialog {activeCalendar} />{/if}
</div>
