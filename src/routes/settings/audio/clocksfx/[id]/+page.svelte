<script lang="ts">
    import { goto } from '$app/navigation';
    import HSlider from '$lib/audio/client/components/HSlider.svelte';
    import { bellBalanceGains, CLOCK_SFX_SLOT_LABELS, CLOCK_SFX_SLOTS, clockSfxFileUrl, type ClockSfxPreset, type ClockSfxSlot } from '$lib/audio/common/clockSfxPreset';
    import { dbToLinear, linearToDb } from '$lib/common/util';

    let { data }: { data: { preset: ClockSfxPreset, acceptedExtensions: string[] } } = $props();

    // svelte-ignore state_referenced_locally
    let preset = $state(structuredClone(data.preset));

    /** Picked but not yet uploaded files, uploaded on save. */
    let pendingFiles: Record<ClockSfxSlot, File | null> = $state({ start: null, final: null, reminder: null });
    /** Object URLs for previewing pending files before they're uploaded. */
    let pendingUrls: Record<ClockSfxSlot, string | null> = $state({ start: null, final: null, reminder: null });
    /** Uploaded sounds to remove on save. */
    let pendingRemovals: Record<ClockSfxSlot, boolean> = $state({ start: false, final: false, reminder: false });
    let saving = $state(false);
    /** Shows the "Saved!" message; its OK goes back to the audio settings. */
    let saved = $state(false);

    const slots: { slot: ClockSfxSlot, label: string }[] = CLOCK_SFX_SLOTS.map(slot => ({ slot, label: `${CLOCK_SFX_SLOT_LABELS[slot]} Sound` }));

    const balance = $derived(bellBalanceGains(preset.balance));
    const slotGain = $derived(Object.fromEntries(CLOCK_SFX_SLOTS.map(slot => [slot, preset.gain * balance[slot]])) as Record<ClockSfxSlot, number>);

    function previewUrl(slot: ClockSfxSlot): string | null {
        if(pendingUrls[slot]) return pendingUrls[slot];
        if(pendingRemovals[slot]) return null;
        const file = preset[slot];
        return file ? clockSfxFileUrl(preset.id, slot, file) : null;
    }

    function pickFile(slot: ClockSfxSlot, e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        if(pendingUrls[slot]) URL.revokeObjectURL(pendingUrls[slot]!);
        pendingFiles[slot] = file;
        pendingUrls[slot] = file ? URL.createObjectURL(file) : null;
        if(file) pendingRemovals[slot] = false;
    }

    function removeSound(slot: ClockSfxSlot) {
        if(pendingUrls[slot]) URL.revokeObjectURL(pendingUrls[slot]!);
        pendingFiles[slot] = null;
        pendingUrls[slot] = null;
        pendingRemovals[slot] = preset[slot] !== null;
    }

    async function check(res: Response, what: string) {
        if(res.ok) return res;
        const message = await res.json().then(j => j.message).catch(() => res.statusText);
        throw new Error(`Failed to ${what} (${res.status}): ${message}`);
    }

    async function onSave() {
        saving = true;
        try {
            await fetch(`/api/clockSfx/${preset.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name: preset.name, gain: preset.gain, balance: preset.balance, pan: preset.pan }),
                headers: { 'Content-Type': 'application/json' }
            }).then(res => check(res, 'save preset'));

            for(const { slot, label } of slots) {
                const file = pendingFiles[slot];
                if(file) {
                    const formData = new FormData();
                    formData.append('file', file);
                    await fetch(`/api/clockSfx/${preset.id}/${slot}`, { method: 'POST', body: formData })
                        .then(res => check(res, `upload ${label.toLowerCase()}`));
                } else if(pendingRemovals[slot]) {
                    await fetch(`/api/clockSfx/${preset.id}/${slot}`, { method: 'DELETE' })
                        .then(res => check(res, `remove ${label.toLowerCase()}`));
                }
            }

            for(const { slot } of slots) removeSound(slot); // Frees the preview URLs
            saved = true;
        } catch(e) {
            console.error(e);
            alert(e);
            saving = false;
        }
    }

    async function onDelete() {
        if(!confirm(`Delete "${preset.name}"? Games using it will switch to the first remaining preset. This cannot be undone.`)) return;
        const res = await fetch(`/api/clockSfx/${preset.id}`, { method: 'DELETE' });
        if(!res.ok) {
            alert(`Failed to delete preset (${res.status})`);
            return;
        }
        goto('/settings/audio');
    }
</script>

<div class="scroll">
<div class="main">
    <a class="back" href="/settings/audio">&larr; Audio</a>

    <div class="panel">
        <h2>General</h2>
        <div class="data-table-scroll">
        <table class="data-table">
            <tbody>
                <tr>
                    <td>Preset Name</td>
                    <td><input type="text" bind:value={preset.name} placeholder="Name"/></td>
                </tr>
            </tbody>
        </table>
        </div>
    </div>

    <div class="panel">
        <h2>Sound Effects</h2>
        <div class="data-table-scroll">
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: fit-content;">Event</th>
                    <th>Sound File</th>
                </tr>
            </thead>
            <tbody>
                {#each slots as { slot, label } (slot)}
                    {@const url = previewUrl(slot)}
                    <tr>
                        <td style="width: fit-content;">
                            <div>{label}</div>
                            <div>({linearToDb(slotGain[slot]).toFixed(1)}dB)</div>
                        </td>
                        <td style="min-width: 200px;">
                            <div class="audio-file-input-container">
                                <div class="file-row">
                                    <input type="file" accept={data.acceptedExtensions.join(',')} onchange={(e) => pickFile(slot, e)}/>
                                    {#if url}
                                        <button class="remove" onclick={() => removeSound(slot)}>Remove</button>
                                    {/if}
                                </div>
                                {#if url}
                                    <audio src={url} controls volume={slotGain[slot]}></audio>
                                {:else}
                                    <div class="no-sound">No sound</div>
                                {/if}
                            </div>
                        </td>
                    </tr>
                {/each}
                <tr>
                    <td>Balance ({preset.balance})</td>
                    <td><HSlider bind:value={preset.balance} min={-1} max={1} step={0.1}/></td>
                </tr>
                <tr>
                    <td>Gain ({linearToDb(preset.gain).toFixed(0)}dB)</td>
                    <td><HSlider value={linearToDb(preset.gain)} min={-18} max={0} step={1} onchange={(val)=>preset.gain = dbToLinear(val)}/></td>
                </tr>
                <tr>
                    <td>Pan ({preset.pan})</td>
                    <td><HSlider bind:value={preset.pan} min={-1} max={1} step={0.1}/></td>
                </tr>
            </tbody>
        </table>
        </div>
        <p class="hint">Start of Day plays when a game goes from night to day; End of Day when its timer runs out, or the bell is rung by hand. Balance trades the reminder bell (left) against the start and end of day sounds (right). Balance, gain and pan apply on top of each game's own mixer channel.</p>
    </div>

    <div class="actions">
        <button class="delete" onclick={onDelete} disabled={saving}>Delete</button>
        <button class="save" onclick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
</div>
</div>

{#if saved}
<div class="saved-backdrop">
    <div class="saved-message" role="alertdialog" aria-label="Saved">
        <div>Saved!</div>
        <!-- svelte-ignore a11y_autofocus -->
        <button class="save" onclick={() => goto('/settings/audio', { invalidateAll: true })} autofocus>OK</button>
    </div>
</div>
{/if}

<style>
    .saved-backdrop {
        position: fixed;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0.4);
        z-index: 9999;
    }

    .saved-message {
        min-width: min(20rem, calc(100vw - 32px));
        box-sizing: border-box;
        padding: 1.5rem 2rem;
        border-radius: 12px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg);
        box-shadow: 0 4px 16px var(--theme-shadow);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        text-align: center;
        font-size: 1.2rem;
        font-weight: 600;
    }

    .saved-message button {
        min-width: 6rem;
        font-size: 1rem;
    }

    .scroll {
        height: 100%;
        overflow-y: auto;
    }

    .main {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: auto;
        padding: 1.5rem;
        box-sizing: border-box;
        width: 100%;
        max-width: 56rem;
        color: var(--theme-on-bg);
    }

    .back {
        color: var(--theme-on-bg-secondary);
        text-decoration: none;
    }

    .back:hover {
        color: var(--theme-highlight);
    }

    .panel {
        background-color: var(--theme-bg-secondary);
        padding: 1.25rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 16px var(--theme-shadow);
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--theme-on-bg-secondary);
    }

    td > div:nth-child(2), .no-sound, .hint {
        font-size: 0.8rem;
        color: var(--theme-on-bg-secondary);
    }

    .hint {
        margin: 0.75rem 0 0;
        font-style: italic;
    }

    input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.5rem 0.6rem;
        border: 1px solid transparent;
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    input:focus {
        outline: none;
        border-color: var(--theme-highlight);
    }

    .audio-file-input-container {
        width: 100%;
    }

    .file-row {
        display: flex;
        gap: 0.5rem;
    }

    .file-row input {
        flex: 1;
        min-width: 0;
    }

    .audio-file-input-container > audio {
        width: 100%;
        margin-top: 0.5rem;
        height: 2.25rem;
    }

    .no-sound {
        margin-top: 0.5rem;
    }

    button {
        padding: 0.5rem 0.9rem;
        border: none;
        border-radius: 8px;
        font: inherit;
        cursor: pointer;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        transition: filter 0.15s;
    }

    button:hover:not(:disabled) {
        filter: brightness(1.15);
    }

    button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .actions button, .saved-message button {
        padding: 0.7rem 1rem;
    }

    .actions .save, .saved-message .save {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .actions .delete:hover:not(:disabled), button.remove:hover {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
        filter: none;
    }
</style>
