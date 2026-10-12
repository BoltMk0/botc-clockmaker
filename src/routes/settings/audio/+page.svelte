<script lang="ts">
    import { COUNTDOWN_PHASES, isSpotifyAdaptivePreset, isSpotifyCountdownPreset, parseSpotifyContextUri, type CountdownPhase, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import BinIcon from "$lib/assets/binIcon.svelte";
    import { onMount, tick } from "svelte";
    import { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import { DEFAULT_DIM_AMOUNT_DB, MAX_DIM_AMOUNT_DB, MIN_DIM_AMOUNT_DB } from "$lib/audio/common/model/audioDimModel";
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

    let { data }: { data: { clockSfxPresets: ClockSfxPreset[], ambienceResources: AssetResource[], stingResources: AssetResource[] } } = $props();

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

    // The links are whatever the user typed/pasted; they become normalised URIs on save.
    // A `phase` row is an adaptive playlist, using a link per phase (any of which may be empty); a `countdown` row is a
    // countdown playlist, with a day and a night link (either may be empty); otherwise just `link`.
    type Row = {
        id: string, name: string, phase: boolean, countdown: boolean, link: string,
        phaseLinks: Record<TimeOfDay, string>, countdownLinks: Record<CountdownPhase, string>
    };

    function emptyPhaseLinks(): Record<TimeOfDay, string> {
        return Object.fromEntries(TIMES_OF_DAY.map(t => [t, ''])) as Record<TimeOfDay, string>;
    }

    function emptyCountdownLinks(): Record<CountdownPhase, string> {
        return Object.fromEntries(COUNTDOWN_PHASES.map(p => [p, ''])) as Record<CountdownPhase, string>;
    }

    function newRow(kind: 'single' | 'phase' | 'countdown'): Row {
        return { id: newId(), name: '', phase: kind === 'phase', countdown: kind === 'countdown', link: '', phaseLinks: emptyPhaseLinks(), countdownLinks: emptyCountdownLinks() };
    }

    function toRow(p: SpotifyPreset): Row {
        const row: Row = { id: p.id, name: p.name, phase: false, countdown: false, link: '', phaseLinks: emptyPhaseLinks(), countdownLinks: emptyCountdownLinks() };
        if (isSpotifyAdaptivePreset(p)) {
            row.phase = true;
            row.phaseLinks = Object.fromEntries(TIMES_OF_DAY.map(t => [t, p.phaseUris[t] ?? ''])) as Record<TimeOfDay, string>;
        } else if (isSpotifyCountdownPreset(p)) {
            row.countdown = true;
            row.countdownLinks = Object.fromEntries(COUNTDOWN_PHASES.map(c => [c, p.countdownUris[c] ?? ''])) as Record<CountdownPhase, string>;
        } else {
            row.link = p.uri;
        }
        return row;
    }

    /** A day & night playlist's two lists, as the settings name them. */
    const COUNTDOWN_LIST_LABELS: Record<CountdownPhase, string> = { day: 'Day', night: 'Night' };

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
                const phaseUris = {} as Record<TimeOfDay, string | null>;
                for (const t of TIMES_OF_DAY) {
                    if (isInvalidLink(row.phaseLinks[t])) {
                        alert(`"${row.name || '(unnamed)'}": the ${TIME_OF_DAY_LABELS[t].toLowerCase()} link isn't a Spotify album or playlist link.`);
                        return;
                    }
                    phaseUris[t] = row.phaseLinks[t].trim() === '' ? null : parseSpotifyContextUri(row.phaseLinks[t]);
                }
                if (TIMES_OF_DAY.every(t => phaseUris[t] === null)) {
                    alert(`"${row.name || '(unnamed)'}" needs a Spotify album or playlist link for at least one phase.`);
                    return;
                }
                presets.push({ id: row.id, name: row.name.trim() || 'Ambient Adaptive Playlist', phaseUris });
            } else if (row.countdown) {
                const countdownUris = {} as Record<CountdownPhase, string | null>;
                for (const c of COUNTDOWN_PHASES) {
                    if (isInvalidLink(row.countdownLinks[c])) {
                        alert(`"${row.name || '(unnamed)'}": the ${COUNTDOWN_LIST_LABELS[c].toLowerCase()} link isn't a Spotify album or playlist link.`);
                        return;
                    }
                    countdownUris[c] = row.countdownLinks[c].trim() === '' ? null : parseSpotifyContextUri(row.countdownLinks[c]);
                }
                if (COUNTDOWN_PHASES.every(c => countdownUris[c] === null)) {
                    alert(`"${row.name || '(unnamed)'}" needs a Spotify album or playlist link for the day or the night.`);
                    return;
                }
                presets.push({ id: row.id, name: row.name.trim() || 'Day & Night Playlist', countdownUris });
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

<div class="panel">
<div class="panel-header">
    <h2>Spotify Presets</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Albums and playlists shown on the Spotify strip in the mixer. Clicking one starts it playing straight away. In Spotify, use Share &rarr; Copy link and paste it here.<br/>An ambient adaptive playlist has a list for each phase: it plays the one for the current phase, and fades out to a random track from the next phase's list whenever the games' phase changes. Leave a phase empty to keep playing whatever was on through it; a phase with the same list as the one playing also carries straight on.<br/>A day &amp; night playlist has a list for the day and one for the night. The day list only plays while a game's countdown is running; the rest of the day (the morning before it's started, a pause, and dusk) is silent, and it picks up again by itself when the countdown starts or night falls. Leave a list empty to keep that time silent too.</p>
<div class="data-table-scroll">
<table class="data-table spotify-table">
    <tbody>
        <tr class="spotify-header">
            <th>Name</th>
            <th></th>
            <th>Album / playlist link</th>
            <th></th>
        </tr>
        {#each rows as row, i (row.id)}
            <tr class="spotify-row">
                <td class="spotify-name"><input class="name-input" bind:value={row.name} type="text" placeholder="Name"/></td>
                <td class="phase-icons">
                    {#if row.phase}
                        <div class="phase-stack">
                            {#each TIMES_OF_DAY as t}
                                <span class="phase-icon" title={TIME_OF_DAY_LABELS[t]}><TimeOfDayIcon timeOfDay={t}/></span>
                            {/each}
                        </div>
                    {:else if row.countdown}
                        <div class="phase-stack">
                            {#each COUNTDOWN_PHASES as c}
                                <span class="phase-icon" title={COUNTDOWN_LIST_LABELS[c]}><TimeOfDayIcon timeOfDay={c}/></span>
                            {/each}
                        </div>
                    {/if}
                </td>
                <td class="spotify-links">
                    {#if row.phase}
                        <div class="phase-stack">
                            {#each TIMES_OF_DAY as t}
                                <input class="link-input" class:invalid={isInvalidLink(row.phaseLinks[t])} bind:value={row.phaseLinks[t]} type="text" placeholder="{TIME_OF_DAY_LABELS[t]}: https://open.spotify.com/playlist/... (empty: no change)"/>
                            {/each}
                        </div>
                    {:else if row.countdown}
                        <div class="phase-stack">
                            {#each COUNTDOWN_PHASES as c}
                                <input class="link-input" class:invalid={isInvalidLink(row.countdownLinks[c])} bind:value={row.countdownLinks[c]} type="text" placeholder="{COUNTDOWN_LIST_LABELS[c]}: https://open.spotify.com/playlist/... (empty: silent)"/>
                            {/each}
                        </div>
                    {:else}
                        <input class="link-input" class:invalid={isInvalidLink(row.link)} bind:value={row.link} type="text" placeholder="https://open.spotify.com/playlist/..."/>
                    {/if}
                </td>
                <td class="row-actions"><button class="icon-button" onclick={()=>rows.splice(i, 1)} aria-label="Delete preset" title="Delete"><BinIcon size={18}/></button></td>
            </tr>
        {/each}
        <tr class="spotify-add-row">
            <td colspan="4">
                <div class="add-buttons">
                <button style="flex: 1;" class="add" onclick={()=>rows.push(newRow('single'))}>Add Ambient Playlist</button>
                <button style="flex: 1;" class="add" onclick={()=>rows.push(newRow('phase'))}>Add Ambient Adaptive Playlist</button>
                <button style="flex: 1;" class="add" onclick={()=>rows.push(newRow('countdown'))}>Add Day &amp; Night Playlist</button>
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
        gap: 0.3rem;
    }

    /* rem, not em: inputs have the browser's smaller default font size, so an em height would differ from the icons' */
    .phase-stack > * {
        height: 2rem;
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

    .add-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
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

        /* Each Spotify preset becomes a card: the name and delete button on top, then its link(s) full width below */
        .spotify-table tbody {
            display: block;
        }
        .spotify-header {
            display: none;
        }
        tr.spotify-row {
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-areas:
                "name name actions"
                "icons links links";
        }
        tr.spotify-row td {
            border-top: none;
        }
        tr.spotify-row td:first-child {
            border-top: 1px solid var(--theme-bg-tertiary);
        }
        tr.spotify-row td.spotify-name {
            grid-area: name;
        }
        tr.spotify-row td.row-actions {
            grid-area: actions;
            border-top: 1px solid var(--theme-bg-tertiary);
        }
        tr.spotify-row td.phase-icons {
            grid-area: icons;
            width: auto;
            padding-left: 0.3em;
        }
        tr.spotify-row td.spotify-links {
            grid-area: links;
        }
        tr.spotify-add-row {
            display: block;
        }
        tr.spotify-add-row td {
            display: block;
        }
        input.name-input, input.link-input {
            min-width: 0;
        }
    }
</style>
