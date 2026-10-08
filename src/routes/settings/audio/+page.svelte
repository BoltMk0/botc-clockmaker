<script lang="ts">
    import { isSpotifyPhasePreset, parseSpotifyContextUri, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import DayIcon from "$lib/assets/dayIcon.svelte";
    import NightIcon from "$lib/assets/nightIcon.svelte";
    import BinIcon from "$lib/assets/binIcon.svelte";
    import { onMount, tick } from "svelte";
    import { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import { DEFAULT_DIM_AMOUNT_DB, MAX_DIM_AMOUNT_DB, MIN_DIM_AMOUNT_DB } from "$lib/audio/common/model/audioDimModel";
    import type { ClockSfxPreset } from "$lib/audio/common/clockSfxPreset";
    import { goto, invalidateAll } from "$app/navigation";
    import { getAcceptedExtensionsForResourceType, type Resource } from "$lib/resources/common/types";
    import { prettifyResourceName, resourceNameSlug } from "$lib/resources/common/util";
    import AudioPreviewPlayer from "$lib/audio/client/components/AudioPreviewPlayer.svelte";
    import PlayIcon from "$lib/audio/client/components/PlayIcon.svelte";
    import PauseIcon from "$lib/audio/client/components/PauseIcon.svelte";
    import PencilIcon from "$lib/components/PencilIcon.svelte";

    /** An audio asset, with its file size in bytes (null if it couldn't be read). */
    type AssetResource = Resource & { size: number | null };

    let { data }: { data: { clockSfxPresets: ClockSfxPreset[], ambienceResources: AssetResource[], stingResources: AssetResource[] } } = $props();

    // ---- Audio asset libraries (ambience, stings) ----

    type AudioAssetListOptions = {
        type: 'ambience' | 'sting',
        getResources: () => AssetResource[],
        loop: boolean,
        addLabel: string,
        emptyText: string,
        deleteWarning: string
    };

    /** One library's list: a single preview player, plus uploading, renaming and deleting. */
    class AudioAssetList {
        /** The asset loaded in the preview player. */
        previewId: string | null = $state(null);
        player: AudioPreviewPlayer | undefined = $state();
        /** The asset whose name is being edited, and the name typed so far. */
        editingId: string | null = $state(null);
        nameDraft = $state('');

        uploading = $state(false);
        readonly options: AudioAssetListOptions;

        constructor(options: AudioAssetListOptions) {
            this.options = options;
        }

        get resources() { return this.options.getResources(); }

        /** Uploads the picked files as new assets, one after another. */
        async upload(files: FileList | null) {
            if (!files || files.length === 0) return;
            this.uploading = true;
            try {
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('type', this.options.type);
                    formData.append('file', file);
                    const r = await fetch('/api/audioAssets', { method: 'POST', body: formData });
                    if (!r.ok) {
                        const message = await r.json().then(j => j.message).catch(() => r.statusText);
                        alert(`Failed to upload "${file.name}" (${r.status}): ${message}`);
                    }
                }
            } finally {
                this.uploading = false;
                await invalidateAll();
            }
        }

        async preview(res: Resource) {
            this.previewId = res.id;
            // Wait for the new url to be applied before playing
            await tick();
            this.player?.play();
        }

        /** Whether this asset is the one currently playing in the preview player. */
        isPlaying(res: Resource) {
            return this.previewId === res.id && (this.player?.isPlaying() ?? false);
        }

        /**
         * Row play/pause button: pauses or resumes the selected asset, or starts another (looping assets just before
         * their loop point, others from the start).
         */
        togglePlay(res: Resource) {
            if (this.previewId !== res.id) {
                this.preview(res);
                return;
            }
            this.player?.setPaused(this.isPlaying(res));
        }

        startEdit(res: Resource) {
            this.editingId = res.id;
            this.nameDraft = prettifyResourceName(res.name);
        }

        /** Closes the name input, renaming the asset if the name was changed. */
        async finishEdit(res: Resource) {
            if (this.editingId !== res.id) return; // Already finished (Enter then blur)
            this.editingId = null;
            const name = this.nameDraft;
            const slug = resourceNameSlug(name);
            if (slug === '' || slug === res.name) return;
            const r = await fetch(`/api/audioAssets/${encodeURIComponent(res.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ name }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!r.ok) {
                const message = await r.json().then(j => j.message).catch(() => r.statusText);
                alert(`Failed to rename (${r.status}): ${message}`);
                return;
            }
            const { id } = await r.json();
            if (this.previewId === res.id) this.previewId = id;
            await invalidateAll();
        }

        async delete(res: Resource) {
            if (!confirm(`Delete "${prettifyResourceName(res.name)}"? ${this.options.deleteWarning} This cannot be undone.`)) return;
            const r = await fetch(`/api/audioAssets/${encodeURIComponent(res.id)}`, { method: 'DELETE' });
            if (!r.ok) {
                alert(`Failed to delete (${r.status})`);
                return;
            }
            if (this.previewId === res.id) this.previewId = null;
            await invalidateAll();
        }
    }

    const acceptedAudioExtensions = getAcceptedExtensionsForResourceType('ambience').join(',');

    /** The file's container format, from its extension (e.g. "WAV"). */
    function containerType(res: Resource) {
        const dot = res.id.lastIndexOf('.');
        return dot === -1 ? '—' : res.id.slice(dot + 1).toUpperCase();
    }

    function formatFileSize(bytes: number | null) {
        if (bytes === null) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function focusAndSelect(input: HTMLInputElement) {
        input.focus();
        input.select();
    }

    const ambienceAssets = new AudioAssetList({
        type: 'ambience',
        getResources: () => data.ambienceResources,
        loop: true,
        addLabel: '+ Ambience Asset',
        emptyText: 'No ambience assets uploaded.',
        deleteWarning: 'Any ambience track playing it will be emptied.'
    });
    const stingAssets = new AudioAssetList({
        type: 'sting',
        getResources: () => data.stingResources,
        loop: false,
        addLabel: '+ Sting Asset',
        emptyText: 'No audio stings uploaded.',
        deleteWarning: 'A sting slot holding it will be re-armed with another one.'
    });

    function createClockSfxPreset() {
        fetch('/api/clockSfx', {
            method: 'POST',
            body: JSON.stringify({ name: 'New Clock SFX Preset' }),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to create preset (${res.status})`);
            return res.json();
        }).then((preset: ClockSfxPreset) => {
            goto(`/settings/audio/clocksfx/${preset.id}`);
        }).catch(e => alert(e));
    }

    let audioDim: AudioDim | null = $state(null); // Created on mount: it opens a connection to the server
    /** The dim slider's position while it's being dragged, before it's sent. */
    let draggingDimDb: number | null = $state(null);

    // The links are whatever the user typed/pasted; they become normalised URIs on save.
    // A `phase` row is a day/night preset, using dayLink/nightLink; otherwise just `link`.
    type Row = { id: string, name: string, phase: boolean, link: string, dayLink: string, nightLink: string };

    function toRow(p: SpotifyPreset): Row {
        return isSpotifyPhasePreset(p)
            ? { id: p.id, name: p.name, phase: true, link: '', dayLink: p.dayUri, nightLink: p.nightUri }
            : { id: p.id, name: p.name, phase: false, link: p.uri, dayLink: '', nightLink: '' };
    }

    function isInvalidLink(link: string) {
        return link.trim() !== '' && !parseSpotifyContextUri(link);
    }

    let rows: Row[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(rows) !== savedSnapshot);

    function newId() {
        return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    onMount(() => {
        audioDim = new AudioDim();
        fetch('/api/spotifyPresets').then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to fetch');
        }).then((data: SpotifyPreset[]) => {
            rows = data.map(toRow);
            savedSnapshot = JSON.stringify(rows);
        }).catch(() => {
            alert('Failed to fetch Spotify presets!');
        });
        return () => audioDim?.close();
    });

    function save() {
        const presets: SpotifyPreset[] = [];
        for (const row of rows) {
            if (row.phase) {
                const dayUri = parseSpotifyContextUri(row.dayLink);
                const nightUri = parseSpotifyContextUri(row.nightLink);
                if (!dayUri || !nightUri) {
                    alert(`"${row.name || '(unnamed)'}" needs a Spotify album or playlist link for both day and night.`);
                    return;
                }
                presets.push({ id: row.id, name: row.name.trim() || 'Day / Night', dayUri, nightUri });
            } else {
                const uri = parseSpotifyContextUri(row.link);
                if (!uri) {
                    alert(`"${row.name || '(unnamed)'}" isn't a Spotify album or playlist link.`);
                    return;
                }
                presets.push({ id: row.id, name: row.name.trim() || uri, uri });
            }
        }
        // Show the normalised form back to the user
        const normalised = presets.map(toRow);
        fetch('/api/spotifyPresets', {
            method: 'POST',
            body: JSON.stringify(presets),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => {
            if (res.ok) {
                rows = normalised;
                savedSnapshot = JSON.stringify(normalised);
                alert('Saved!');
            } else {
                res.json().then(t => {
                    alert(`Failed to save (${res.status})\n${t.message}`);
                }).catch(() => {
                    alert("Failed to save");
                });
            }
        });
    }
</script>

<div class="center-content main">
<div class="panels">
<div class="panel">
<div class="panel-header">
    <h2>Audio Options</h2>
</div>
<p class="description">Changes here apply straight away, on every device.</p>
<label class="option">
    <span class="option-name">Dim strength</span>
    <!-- Shows the dragged value live, but only sends it on release: each change is saved to disk -->
    <input class="dim-slider" type="range" min={MIN_DIM_AMOUNT_DB} max={MAX_DIM_AMOUNT_DB} step={1}
        value={draggingDimDb ?? audioDim?.amountDb ?? DEFAULT_DIM_AMOUNT_DB}
        disabled={!audioDim}
        oninput={(e) => draggingDimDb = e.currentTarget.valueAsNumber}
        onchange={(e) => { if (audioDim) audioDim.amountDb = e.currentTarget.valueAsNumber; draggingDimDb = null; }}/>
    <span class="option-value">-{draggingDimDb ?? audioDim?.amountDb ?? DEFAULT_DIM_AMOUNT_DB} dB</span>
</label>
</div>

<div class="panel">
<div class="panel-header">
    <h2>Clock SFX</h2>
</div>
<p class="description">The final and reminder bell sounds a game's clock rings. Each game picks one of these in its settings; new games use the first.</p>
<div class="data-table-scroll">
<table class="data-table">
    <tbody>
        <tr>
            <th>Name</th>
            <th>Final bell</th>
            <th>Reminder bell</th>
            <th></th>
        </tr>
        {#each data.clockSfxPresets as preset (preset.id)}
            <tr>
                <td>{preset.name}</td>
                <td class="has-sound">{preset.final ? '✓' : '—'}</td>
                <td class="has-sound">{preset.reminder ? '✓' : '—'}</td>
                <td><a class="edit-link" href="/settings/audio/clocksfx/{preset.id}">Edit</a></td>
            </tr>
        {/each}
        <tr>
            <td colspan="4">
                <button style="width: 100%;" class="add" onclick={createClockSfxPreset}>+ Clock SFX Preset</button>
            </td>
        </tr>
    </tbody>
</table>
</div>
</div>

{#snippet audioAssetList(list: AudioAssetList)}
<div class="asset-player">
    <div class="asset-now-playing">
        {#if list.previewId}
            {@const res = list.resources.find(r => r.id === list.previewId)}
            {res ? prettifyResourceName(res.name) : ''}
        {:else}
            Nothing selected
        {/if}
    </div>
    <AudioPreviewPlayer bind:this={list.player} url={list.previewId ? `/api/resources/${list.previewId}` : null} loop={list.options.loop}/>
</div>
<div class="data-table-scroll">
<table class="data-table">
    <tbody>
        <tr>
            <th></th>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th></th>
        </tr>
        {#each list.resources as res (res.id)}
            {@const rowPlaying = list.isPlaying(res)}
            <tr class="asset-row" class:selected={list.previewId === res.id} onclick={() => list.togglePlay(res)}>
                <td class="play-cell">
                    <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
                    <button class="play-button" onclick={(e) => { e.stopPropagation(); list.togglePlay(res); }}
                        aria-label="{rowPlaying ? 'Pause' : 'Play'} {prettifyResourceName(res.name)}" title={rowPlaying ? 'Pause' : 'Play'}>
                        {#if rowPlaying}<PlayIcon size={18}/>{:else}<PauseIcon size={18}/>{/if}
                    </button>
                </td>
                <td class="name-cell">
                    {#if list.editingId === res.id}
                        <input class="name-input" type="text" aria-label="Asset name" bind:value={list.nameDraft}
                            use:focusAndSelect
                            onclick={(e) => e.stopPropagation()}
                            onblur={() => list.finishEdit(res)}
                            onkeydown={(e) => {
                                if (e.key === 'Enter') list.finishEdit(res);
                                else if (e.key === 'Escape') list.editingId = null;
                            }}/>
                    {:else}
                        <div class="asset-name">
                            <span>{prettifyResourceName(res.name)}</span>
                            <button class="edit-button" onclick={(e) => { e.stopPropagation(); list.startEdit(res); }}
                                aria-label="Rename {prettifyResourceName(res.name)}" title="Rename"><PencilIcon size={16}/></button>
                        </div>
                    {/if}
                </td>
                <td class="asset-meta">{containerType(res)}</td>
                <td class="asset-meta">{formatFileSize(res.size)}</td>
                <td class="row-actions">
                    <button class="icon-button" onclick={(e) => { e.stopPropagation(); list.delete(res); }} aria-label="Delete {prettifyResourceName(res.name)}" title="Delete"><BinIcon size={18}/></button>
                </td>
            </tr>
        {:else}
            <tr><td colspan="5" class="empty">{list.options.emptyText}</td></tr>
        {/each}
        <tr>
            <td colspan="5">
                <label class="add add-upload" class:disabled={list.uploading}>
                    {list.uploading ? 'Uploading...' : list.options.addLabel}
                    <input type="file" accept={acceptedAudioExtensions} multiple disabled={list.uploading}
                        onchange={(e) => { list.upload(e.currentTarget.files); e.currentTarget.value = ''; }}/>
                </label>
            </td>
        </tr>
    </tbody>
</table>
</div>
{/snippet}

<div class="panel">
<div class="panel-header">
    <h2>Ambience Assets</h2>
</div>
<p class="description">The sounds the mixer's ambience tracks can play. Click one to play or pause its loop.</p>
{@render audioAssetList(ambienceAssets)}
</div>

<div class="panel">
<div class="panel-header">
    <h2>Audio Stings</h2>
</div>
<p class="description">The short sounds the sting button picks from at random. Click one to play or pause it.</p>
{@render audioAssetList(stingAssets)}
</div>

<div class="panel">
<div class="panel-header">
    <h2>Spotify Presets</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Albums and playlists shown on the Spotify strip in the mixer. Clicking one starts it playing straight away. In Spotify, use Share &rarr; Copy link and paste it here.<br/>A day/night preset has a list for each phase: it plays the one for the current phase, and crossfades to a random track from the other whenever the games go from day to night or back.</p>
<div class="data-table-scroll">
<table class="data-table">
    <tbody>
        <tr>
            <th>Name</th>
            <th></th>
            <th>Album / playlist link</th>
            <th></th>
        </tr>
        {#each rows as row, i (row.id)}
            <tr>
                <td><input class="name-input" bind:value={row.name} type="text" placeholder="Name"/></td>
                <td class="phase-icons">
                    {#if row.phase}
                        <div class="phase-stack">
                            <span class="phase-icon" title="Day"><DayIcon/></span>
                            <span class="phase-icon" title="Night"><NightIcon/></span>
                        </div>
                    {/if}
                </td>
                <td>
                    {#if row.phase}
                        <div class="phase-stack">
                            <input class="link-input" class:invalid={isInvalidLink(row.dayLink)} bind:value={row.dayLink} type="text" placeholder="Day: https://open.spotify.com/playlist/..."/>
                            <input class="link-input" class:invalid={isInvalidLink(row.nightLink)} bind:value={row.nightLink} type="text" placeholder="Night: https://open.spotify.com/playlist/..."/>
                        </div>
                    {:else}
                        <input class="link-input" class:invalid={isInvalidLink(row.link)} bind:value={row.link} type="text" placeholder="https://open.spotify.com/playlist/..."/>
                    {/if}
                </td>
                <td class="row-actions"><button class="icon-button" onclick={()=>rows.splice(i, 1)} aria-label="Delete preset" title="Delete"><BinIcon size={18}/></button></td>
            </tr>
        {/each}
        <tr>
            <td colspan="4">
                <div style="display: flex; gap: 0.5em;">
                <button style="flex: 1;" class="add" onclick={()=>rows.push({ id: newId(), name: '', phase: false, link: '', dayLink: '', nightLink: '' })}>Add Preset</button>
                <button style="flex: 1;" class="add" onclick={()=>rows.push({ id: newId(), name: '', phase: true, link: '', dayLink: '', nightLink: '' })}>Add Day/Night Preset</button>
                </div>
            </td>
        </tr>
    </tbody>
</table>
</div>
</div>
</div>
</div>

<style>
    input.name-input {
        width: 100%;
        min-width: 10em;
        box-sizing: border-box;
    }

    input.link-input {
        width: 100%;
        min-width: 20em;
        box-sizing: border-box;
    }

    /* The icons and the inputs are stacked in neighbouring cells; the same item height keeps each icon level with its input. */
    .phase-stack {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }

    .phase-stack > * {
        height: 2em;
        box-sizing: border-box;
    }

    td.phase-icons {
        width: 1px; /* Shrink to the icons */
        padding-left: 0;
        padding-right: 0;
    }

    .phase-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .asset-player {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-bottom: 1rem;
    }

    .asset-now-playing {
        font-weight: bold;
    }

    .asset-name {
        display: flex;
        align-items: center;
        gap: 0.4em;
    }

    /* Quiet until hovered, so the names read as text rather than a row of buttons. */
    button.edit-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.2em;
        border-color: transparent;
        background: none;
        color: inherit;
        opacity: 0.6;
    }

    button.edit-button:hover, button.edit-button:focus-visible {
        border-color: var(--theme-highlight);
        opacity: 1;
    }

    td.asset-meta {
        width: 1px; /* Shrink to the content */
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
    }

    .asset-row {
        cursor: pointer;
    }

    tr.asset-row.selected td {
        background-color: var(--theme-bg-tertiary);
    }

    /* Looks like the other "+" buttons; it's a label so clicking it opens the (hidden) file picker. */
    label.add-upload {
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: 0.3em 0.5em;
        border: 2px dashed var(--theme-slider-trim);
        border-radius: 4px;
        text-align: center;
        cursor: pointer;
        color: var(--theme-on-bg-secondary);
    }

    label.add-upload:hover {
        border-color: var(--theme-highlight);
    }

    label.add-upload.disabled {
        opacity: 0.5;
        cursor: progress;
    }

    label.add-upload input {
        display: none;
    }

    button.icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3em;
        vertical-align: middle;
    }

    button.icon-button:hover {
        border-color: var(--theme-error);
        color: var(--theme-error);
    }

    .play-cell {
        width: 1px; /* Shrink to the button */
    }

    button.play-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.1em;
        border: none;
        outline: none;
        background: none;
        color: inherit;
        vertical-align: middle;
    }

    button.play-button:focus-visible {
        outline: 2px solid var(--theme-highlight); /* Keep a focus ring for keyboard users */
    }

    .row-actions {
        white-space: nowrap;
        text-align: right;
    }

    .empty {
        font-style: italic;
        opacity: 0.7;
    }

    .has-sound {
        text-align: center;
    }

    a.edit-link {
        display: inline-block;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.8em;
        text-decoration: none;
    }

    a.edit-link:hover {
        border-color: var(--theme-highlight);
    }

    input.invalid {
        border-color: #d55;
    }

    .main {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        align-items: flex-start;
    }

    .panels {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .option {
        display: flex;
        align-items: center;
        gap: 1em;
    }

    .option-name {
        font-weight: bold;
    }

    .dim-slider {
        width: 16em;
        max-width: 100%;
        padding: 0;
        border: none;
        background: transparent;
        accent-color: var(--theme-highlight);
    }

    .option-value {
        min-width: 4em;
        font-variant-numeric: tabular-nums;
    }

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    input, button {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input:focus {
        outline: 2px solid var(--theme-highlight);
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button.add {
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add:hover {
        border-color: var(--theme-highlight);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button.save {
        padding: 0.5em 1.2em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }
</style>
