<script lang="ts">
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import BinIcon from "$lib/assets/binIcon.svelte";
    import { onMount, tick } from "svelte";
    import { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import { DEFAULT_DIM_AMOUNT_DB, MAX_DIM_AMOUNT_DB, MIN_DIM_AMOUNT_DB } from "$lib/audio/common/model/audioDimModel";
    import { MusicLevelling } from "$lib/audio/client/MusicLevelling.svelte";
    import { DEFAULT_MUSIC_LEVELLING, MAX_LEVELLING_TARGET_LUFS, MIN_LEVELLING_TARGET_LUFS } from "$lib/audio/common/model/musicModel";
    import { CLOCK_SFX_SLOT_LABELS, CLOCK_SFX_SLOT_TIMES_OF_DAY, CLOCK_SFX_SLOTS, type ClockSfxPreset } from "$lib/audio/common/clockSfxPreset";
    import { goto, invalidateAll } from "$app/navigation";
    import { getAcceptedExtensionsForResourceType, type Resource } from "$lib/resources/common/types";
    import { prettifyResourceName, resourceNameSlug } from "$lib/resources/common/util";
    import AudioPreviewPlayer from "$lib/audio/client/components/AudioPreviewPlayer.svelte";
    import PlayIcon from "$lib/audio/client/components/PlayIcon.svelte";
    import PauseIcon from "$lib/audio/client/components/PauseIcon.svelte";
    import PencilIcon from "$lib/components/PencilIcon.svelte";
    import { AUDIO_ASSET_METADATA_MAX_LENGTH, emptyAudioAssetMetadata, type AudioAssetMetadata } from "$lib/audio/common/audioAssetMetadata";

    /**
     * An audio asset, with its file size in bytes (null if it couldn't be read), and where it keeps metadata, that and
     * the name to show for it (the metadata title, or the tidied filename).
     */
    type AssetResource = Resource & { size: number | null, metadata?: AudioAssetMetadata, title?: string };

    let { data }: { data: { clockSfxPresets: ClockSfxPreset[], ambienceResources: AssetResource[], stingResources: AssetResource[], musicLoudness: { measured: number, total: number } } } = $props();

    // ---- Audio asset libraries (ambience, stings) ----

    type AudioAssetListOptions = {
        type: 'ambience' | 'sting',
        getResources: () => AssetResource[],
        loop: boolean,
        addLabel: string,
        emptyText: string,
        deleteWarning: string,
        /**
         * Whether each asset has editable metadata (title, artist, link, license). Its title is then the name shown, edited
         * in the metadata form, so the file itself can't be renamed in place.
         */
        metadata: boolean
    };

    /** The name shown for an asset: its title where it keeps metadata, otherwise its tidied filename. */
    function displayName(res: AssetResource) {
        return res.title ?? prettifyResourceName(res.name);
    }

    const METADATA_INPUTS: { field: keyof AudioAssetMetadata, label: string, placeholder: string, type: string }[] = [
        { field: 'title', label: 'Title', placeholder: 'Track title', type: 'text' },
        { field: 'artist', label: 'Artist', placeholder: 'Artist', type: 'text' },
        { field: 'link', label: 'Link', placeholder: 'https://... (optional)', type: 'url' },
        { field: 'license', label: 'License', placeholder: 'e.g. Attribution 4.0', type: 'text' }
    ];

    /** One library's list: a single preview player, plus uploading, renaming and deleting. */
    class AudioAssetList {
        /** The asset loaded in the preview player. */
        previewId: string | null = $state(null);
        player: AudioPreviewPlayer | undefined = $state();
        /** The asset whose name is being edited, and the name typed so far. */
        editingId: string | null = $state(null);
        nameDraft = $state('');
        /** The asset whose metadata form is open, and the values typed so far. */
        detailsId: string | null = $state(null);
        detailsDraft: AudioAssetMetadata = $state(emptyAudioAssetMetadata());
        savingDetails = $state(false);

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
            if (this.detailsId === res.id) this.detailsId = id;
            await invalidateAll();
        }

        /** Opens the asset's metadata form, or closes it if it's already open (dropping unsaved changes). */
        toggleDetails(res: AssetResource) {
            if (this.detailsId === res.id) {
                this.detailsId = null;
                return;
            }
            this.detailsId = res.id;
            // An asset with no title shows its filename, so start from that rather than an empty box
            this.detailsDraft = { ...(res.metadata ?? emptyAudioAssetMetadata()) };
            if (!this.detailsDraft.title) this.detailsDraft.title = displayName(res);
        }

        async saveDetails(res: AssetResource) {
            this.savingDetails = true;
            try {
                const r = await fetch(`/api/audioAssets/${encodeURIComponent(res.id)}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ metadata: this.detailsDraft }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!r.ok) {
                    const message = await r.json().then(j => j.message).catch(() => r.statusText);
                    alert(`Failed to save details (${r.status}): ${message}`);
                    return;
                }
                this.detailsId = null;
                await invalidateAll();
            } finally {
                this.savingDetails = false;
            }
        }

        async delete(res: AssetResource) {
            if (!confirm(`Delete "${displayName(res)}"? ${this.options.deleteWarning} This cannot be undone.`)) return;
            const r = await fetch(`/api/audioAssets/${encodeURIComponent(res.id)}`, { method: 'DELETE' });
            if (!r.ok) {
                alert(`Failed to delete (${r.status})`);
                return;
            }
            if (this.previewId === res.id) this.previewId = null;
            if (this.detailsId === res.id) this.detailsId = null;
            await invalidateAll();
        }
    }

    /** "Title - Artist" for an asset with metadata (just the title if it has no artist), otherwise its name. */
    function headline(res: AssetResource) {
        const artist = res.metadata?.artist.trim();
        return artist ? `${displayName(res)} - ${artist}` : displayName(res);
    }

    /** Only web links are made clickable; anything else typed in the link field is shown as plain text. */
    function isWebLink(link: string) {
        return /^https?:\/\//i.test(link);
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
        deleteWarning: 'Any ambience track playing it will be emptied.',
        metadata: true
    });
    const stingAssets = new AudioAssetList({
        type: 'sting',
        getResources: () => data.stingResources,
        loop: false,
        addLabel: '+ Sting Asset',
        emptyText: 'No audio stings uploaded.',
        deleteWarning: 'A sting slot holding it will be re-armed with another one.',
        metadata: false
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
    let musicLevelling = $state<MusicLevelling | null>(null);
    /** The levelling target slider's position while it's being dragged, before it's sent. */
    let draggingTargetLufs: number | null = $state(null);
    const levellingTarget = $derived(draggingTargetLufs ?? musicLevelling?.targetLufs ?? DEFAULT_MUSIC_LEVELLING.targetLufs);

    onMount(() => {
        audioDim = new AudioDim();
        musicLevelling = new MusicLevelling();
        return () => {
            audioDim?.close();
            musicLevelling?.close();
        };
    });

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
<label class="option">
    <input type="checkbox" checked={musicLevelling?.enabled ?? DEFAULT_MUSIC_LEVELLING.enabled} disabled={!musicLevelling}
        onchange={(e) => { if (musicLevelling) musicLevelling.enabled = e.currentTarget.checked; }}/>
    <span class="option-name">Loudness Levelling</span>
</label>
<p class="description option-description">
    Turns each uploaded music track up or down so they all play at about the same loudness (not Spotify).
    {#if data.musicLoudness.measured < data.musicLoudness.total}
        {data.musicLoudness.measured} of {data.musicLoudness.total} tracks measured so far; the rest play as they are until they're measured.
    {/if}
</p>
<label class="option">
    <span class="option-name">Target loudness</span>
    <input class="dim-slider" type="range" min={MIN_LEVELLING_TARGET_LUFS} max={MAX_LEVELLING_TARGET_LUFS} step={1}
        value={levellingTarget}
        disabled={!musicLevelling || !musicLevelling.enabled}
        oninput={(e) => draggingTargetLufs = e.currentTarget.valueAsNumber}
        onchange={(e) => { if (musicLevelling) musicLevelling.targetLufs = e.currentTarget.valueAsNumber; draggingTargetLufs = null; }}/>
    <span class="option-value">{levellingTarget} LUFS</span>
</label>
</div>

<div class="panel">
<div class="panel-header">
    <h2>Clock SFX</h2>
</div>
<p class="description">The sounds a game's clock plays at the start and end of the day, and for the reminder bell. Each game picks one of these in its settings; new games use the first.</p>
<div class="data-table-scroll">
<table class="data-table">
    <tbody>
        <tr>
            <th>Name</th>
            {#each CLOCK_SFX_SLOTS as slot}
                <th class="slot-heading" title={CLOCK_SFX_SLOT_LABELS[slot]} aria-label={CLOCK_SFX_SLOT_LABELS[slot]}><TimeOfDayIcon timeOfDay={CLOCK_SFX_SLOT_TIMES_OF_DAY[slot]} size={20}/></th>
            {/each}
            <th></th>
        </tr>
        {#each data.clockSfxPresets as preset (preset.id)}
            <tr>
                <td>{preset.name}</td>
                {#each CLOCK_SFX_SLOTS as slot}<td class="has-sound">{preset[slot] ? '✓' : '—'}</td>{/each}
                <td class="row-actions edit-cell"><a class="edit-link" href="/settings/audio/clocksfx/{preset.id}" aria-label="Edit {preset.name}" title="Edit"><PencilIcon size={18}/></a></td>
            </tr>
        {/each}
        <tr>
            <td colspan={CLOCK_SFX_SLOTS.length + 2}>
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
            {res ? displayName(res) : ''}
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
            <th class="asset-meta">Type</th>
            <th class="asset-meta">Size</th>
            <th></th>
        </tr>
        {#each list.resources as res (res.id)}
            {@const rowPlaying = list.isPlaying(res)}
            <tr class="asset-row" class:selected={list.previewId === res.id} onclick={() => list.togglePlay(res)}>
                <td class="play-cell">
                    <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
                    <button class="play-button" onclick={(e) => { e.stopPropagation(); list.togglePlay(res); }}
                        aria-label="{rowPlaying ? 'Pause' : 'Play'} {displayName(res)}" title={rowPlaying ? 'Pause' : 'Play'}>
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
                            <span><span class="asset-headline">{headline(res)}</span>
                                {#if res.metadata && (res.metadata.link || res.metadata.license)}
                                    {@const link = res.metadata.link.trim()}
                                    {@const license = res.metadata.license.trim()}
                                    <!-- Second line: where it's from, and its license -->
                                    <span class="asset-credit">
                                        {#if link && isWebLink(link)}<a href={link} target="_blank" rel="noopener noreferrer" onclick={(e) => e.stopPropagation()}>{link}</a>{:else}{link}{/if}{#if license}{link ? ' ' : ''}({license}){/if}
                                    </span>
                                {/if}
                                <span class="asset-meta-inline">{containerType(res)} · {formatFileSize(res.size)}</span></span>
                            {#if !list.options.metadata}
                                <button class="edit-button" onclick={(e) => { e.stopPropagation(); list.startEdit(res); }}
                                    aria-label="Rename {displayName(res)}" title="Rename"><PencilIcon size={16}/></button>
                            {/if}
                        </div>
                    {/if}
                </td>
                <td class="asset-meta">{containerType(res)}</td>
                <td class="asset-meta">{formatFileSize(res.size)}</td>
                <td class="row-actions">
                    {#if list.options.metadata}
                        <button class="icon-button details-button" class:active={list.detailsId === res.id} onclick={(e) => { e.stopPropagation(); list.toggleDetails(res); }}
                            aria-label="Details for {displayName(res)}" aria-expanded={list.detailsId === res.id} title="Track details">
                            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="11" y="10.5" width="2" height="7" rx="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/></svg>
                        </button>
                    {/if}
                    <button class="icon-button" onclick={(e) => { e.stopPropagation(); list.delete(res); }} aria-label="Delete {displayName(res)}" title="Delete"><BinIcon size={18}/></button>
                </td>
            </tr>
            {#if list.detailsId === res.id}
                <tr class="details-row">
                    <td colspan="5">
                        <form class="details-form" onsubmit={(e) => { e.preventDefault(); list.saveDetails(res); }}>
                            {#each METADATA_INPUTS as input}
                                <label class="details-field">
                                    <span>{input.label}</span>
                                    <input type={input.type} placeholder={input.placeholder} maxlength={AUDIO_ASSET_METADATA_MAX_LENGTH} bind:value={list.detailsDraft[input.field]}/>
                                </label>
                            {/each}
                            <div class="details-actions">
                                <button type="button" onclick={() => list.detailsId = null}>Cancel</button>
                                <button type="submit" class="save" disabled={list.savingDetails}>{list.savingDetails ? 'Saving...' : 'Save'}</button>
                            </div>
                        </form>
                    </td>
                </tr>
            {/if}
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

</div>
</div>

<style>
    input.name-input {
        width: 100%;
        min-width: 10em;
        box-sizing: border-box;
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

    /* Phones only: the type and size, under the name in place of their own columns. */
    .asset-meta-inline {
        display: none;
        font-size: 0.85em;
        font-variant-numeric: tabular-nums;
        opacity: 0.7;
    }

    .asset-name > span {
        overflow-wrap: anywhere;
    }

    .asset-credit {
        display: block;
        font-size: 0.85em;
        opacity: 0.7;
    }

    .asset-credit a {
        color: inherit;
    }

    button.icon-button.details-button:hover, button.icon-button.details-button.active {
        border-color: var(--theme-highlight);
        color: inherit;
    }

    button.icon-button.details-button {
        margin-right: 0.3em;
    }

    tr.details-row td {
        background-color: var(--theme-bg-tertiary);
    }

    /* Label above its input, two fields a row where there's room */
    .details-form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14em, 1fr));
        gap: 0.6em 1em;
        padding: 0.3em 0;
    }

    .details-field {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
        font-size: 0.9em;
    }

    .details-field input {
        width: 100%;
        box-sizing: border-box;
    }

    .details-actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        gap: 0.5em;
    }

    .asset-row {
        cursor: pointer;
    }

    /* The asset loaded in the preview player: its name in the app's highlight colour */
    tr.asset-row.selected .asset-headline {
        color: var(--theme-highlight);
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

    /* The icon columns, and the edit button's, shrink to their content so the name column takes the rest of the width. */
    th.slot-heading, td.has-sound, td.edit-cell {
        width: 1px;
        padding-left: 0.3em;
        padding-right: 0.3em;
    }

    th.slot-heading {
        line-height: 0; /* Hug the icon */
        vertical-align: middle;
    }

    a.edit-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em;
        text-decoration: none;
    }

    a.edit-link:hover {
        border-color: var(--theme-highlight);
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
        width: 100%;
    }

    .option {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5em 1em;
    }

    .option-name {
        font-weight: bold;
    }

    .option + .option {
        margin-top: 1em;
    }

    .description.option-description {
        margin: 0.25em 0 0.75em;
    }

    .dim-slider {
        flex: 0 1 16em;
        min-width: 8em;
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
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem 1.5rem;
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

    @media (max-width: 560px) {
        .main {
            padding: 0.75rem;
        }
        .panels {
            gap: 0.75rem;
        }
        .panel {
            padding: 1rem;
        }
        .description {
            margin-bottom: 1rem;
        }

        /* Fold the type and size columns into the name cell */
        .asset-meta {
            display: none;
        }
        .asset-meta-inline {
            display: block;
        }

        input.name-input {
            min-width: 0;
        }
    }
</style>
