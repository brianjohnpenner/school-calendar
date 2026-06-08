<script>
  let { open, ondismiss } = $props()
</script>

{#if open}
  <div class="modal-backdrop">
    <div class="modal-card max-w-md">
      <div class="mb-4 flex items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-900 text-white">
          <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4Zm-1 13-3-3 1.4-1.4L11 12.2l4.6-4.6L17 9l-6 6Z"/></svg>
        </span>
        <h2 class="text-xl font-semibold">Your calendar stays in this browser</h2>
      </div>
      <p class="text-sm leading-6 text-slate-600">This calendar is saved only in this browser on this device — nothing is uploaded to a server. Clearing your browsing data or switching devices will lose it. Use <strong class="text-slate-800">Download</strong> to keep a CSV backup or move it elsewhere.</p>
      <div class="mt-6 flex justify-end">
        <button class="btn-primary" onclick={ondismiss}>Got it</button>
      </div>
    </div>
  </div>
{/if}
