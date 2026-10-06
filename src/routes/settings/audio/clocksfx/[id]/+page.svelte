<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import HSlider from '$lib/audio/client/components/HSlider.svelte';
    import { bellBalanceGains, clockSfxFileUrl, type ClockSfxPreset, type ClockSfxSlot } from '$lib/audio/common/clockSfxPreset';
    import { dbToLinear, linearToDb } from '$lib/common/util';

    let { data }: { data: { preset: ClockSfxPreset, acceptedExtensions: string[] } } = $props();

    // svelte-ignore state_referenced_locally
    let preset = $state(structuredClone(data.preset));

    /** Picked but not yet uploaded files, uploaded on save. */
    let pendingFiles: Record<ClockSfxSlot, File | null> = $state({ final: null, reminder: null });
    /** Object URLs for previewing pending files before they're uploaded. */
    let pendingUrls: Record<ClockSfxSlot, string | null> = $state({ final: null, reminder: null });
    /** Uploaded sounds to remove on save. */
    let pendingRemovals: Record<ClockSfxSlot, boolean> = $state({ final: false, reminder: false });
    let saving = $state(false);

    const slots: { slot: ClockSfxSlot, label: string }[] = [
        { slot: 'final', label: 'Final Bell Sound' },
        { slot: 'reminder', label: 'Reminder Bell Sound' }
    ];

    const balance = $derived(bellBalanceGains(preset.balance));
    const slotGain = $derived({ final: preset.gain * balance.final, reminder: preset.gain * balance.reminder });

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

            for(const { slot } of slots) removeSound(slot);
            pendingRemovals = { final: false, reminder: false };
            await invalidateAll();
            preset = structuredClone(data.preset);
            alert('Saved!');
        } catch(e) {
            console.error(e);
            alert(e);
        } finally {
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
        <table>
            <tbody>
                <tr>
                    <td>Preset Name</td>
                    <td><input type="text" bind:value={preset.name} placeholder="Name"/></td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="panel">
        <h2>Sound Effects</h2>
        <table>
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
        <p class="hint">Balance, gain and pan apply on top of each game's own mixer channel.</p>
    </div>

    <div class="actions">
        <button class="delete" onclick={onDelete} disabled={saving}>Delete</button>
        <button class="save" onclick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
    </div>
</div>
</div>

<style>
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

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--theme-on-bg-secondary);
        text-align: left;
        padding: 0 0.5rem 0.5rem;
    }

    td {
        padding: 0.6rem 0.5rem;
        text-align: left;
        border-top: 1px solid var(--theme-bg-tertiary);
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

    .actions button {
        padding: 0.7rem 1rem;
    }

    .actions .save {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .actions .delete:hover:not(:disabled), button.remove:hover {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
        filter: none;
    }
</style>
