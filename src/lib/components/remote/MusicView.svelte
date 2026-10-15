<script lang="ts">
    import type { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import { DEFAULT_DIM_AMOUNT_DB } from "$lib/audio/common/model/audioDimModel";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import type { RemoteMusic, StartTrackList } from "./remoteMusic.svelte";
    import MusicArt from "./MusicArt.svelte";

    /** The remote's music view: what's playing, full transport and volume, and the music and Spotify presets as one list. */
    let { music, audioDim, onback, onmixer }: {
        music: RemoteMusic;
        audioDim: AudioDim | null;
        onback: () => void;
        /** Opens the mixer as a remote, when the page offers it. */
        onmixer?: () => void;
    } = $props();

    const nowPlaying = $derived(music.nowPlaying);
    const presets = $derived(music.presets);
    const noPlayer = $derived(!music.musicAvailable && !music.spotifyAvailable);
    const unavailable = $derived([
        ...(!music.musicAvailable && presets.some(p => p.source === 'music') ? ['Music'] : []),
        ...(!music.spotifyAvailable && presets.some(p => p.source === 'spotify') ? ['Spotify'] : [])
    ]);

    // The slider follows the player's volume, except while it's being dragged, so echoes don't fight it
    let dragging = $state(false);
    let localVolume = $state(0);
    const volume = $derived(dragging ? localVolume : music.volume ?? 0);
    function onVolumeInput(ev: Event) {
        localVolume = Number((ev.target as HTMLInputElement).value);
        music.setVolume(localVolume);
    }

    /** The preset shown on the preset button: the one being switched to, or else the one loaded on the player shown. */
    const currentPreset = $derived(presets.find(p => p.pending) ?? presets.find(p => p.current && p.source === nowPlaying?.source) ?? presets.find(p => p.current));
    const scheduledPreset = $derived(presets.find(p => p.scheduled));
    let pickingPreset = $state(false);

    // The track the waiting preset starts with: picked from its playlists' tracks, listed as the sheet opens
    const scheduledStart = $derived(music.scheduledStart);
    let pickingStart = $state(false);
    let startLists = $state<StartTrackList[] | null>(null);
    let startFilter = $state('');
    /** Bumped for each opening, so a slow listing from an earlier one is dropped. */
    let startLoad = 0;
    /** A list long enough to scroll through gets a search box. */
    const SEARCH_FROM_TRACKS = 12;

    async function openStartPicker() {
        pickingStart = true;
        startLists = null;
        startFilter = '';
        const load = ++startLoad;
        const lists = await music.loadStartTrackLists();
        if (load === startLoad) startLists = lists;
    }

    function pickStart(start: { listKey: string, trackId: string } | null) {
        music.pickStartTrack(start);
        pickingStart = false;
    }

    // Nothing to pick a start for any more (the phase changed, or the preset was cancelled)
    $effect(() => { if (!music.canPickStart) pickingStart = false; });

    const filteredStartLists = $derived.by(() => {
        const words = startFilter.trim().toLowerCase().split(/\s+/).filter(w => w);
        if (!startLists || words.length === 0) return startLists;
        return startLists.map(l => ({ ...l, tracks: l.tracks.filter(t => words.every(w => `${t.title} ${t.artist}`.toLowerCase().includes(w))) }));
    });

    function phaseList(phases: TimeOfDay[]) {
        return phases.map(p => TIME_OF_DAY_LABELS[p]).join(', ');
    }

    function presetStatus(preset: typeof presets[number]): string {
        if (preset.pending) return 'Loading…';
        if (preset.scheduled) return 'Next phase';
        if (preset.silent) return 'Silent this phase';
        if (preset.playing) return 'Playing';
        if (preset.current) return 'Paused';
        return '';
    }
</script>

<div class="music-view">
    <div class="header">
        <button class="back" onclick={onback}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
            Clock
        </button>
        {#if onmixer}
        <button class="mixer" onclick={onmixer} title="Open the mixer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M4 5h2v14H4zM11 5h2v14h-2zM18 5h2v14h-2z"/>
                <rect x="2" y="13" width="6" height="3" rx="1"/>
                <rect x="9" y="7" width="6" height="3" rx="1"/>
                <rect x="16" y="11" width="6" height="3" rx="1"/>
            </svg>
            Mixer
        </button>
        {/if}
    </div>

    <button class="preset-picker-btn" onclick={() => pickingPreset = true} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 6h16v2H4zm0 5h10v2H4zm0 5h10v2H4zm12-1v-4l5 3z"/></svg>
        <span class="preset-picker-text">
            <span class="preset-picker-name">{currentPreset?.name ?? 'Choose a preset'}</span>
            {#if scheduledPreset && scheduledPreset !== currentPreset}<span class="preset-picker-next">Next phase: {scheduledPreset.name}</span>{/if}
        </span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button>

    {#if music.canPickStart}
    <button class="start-picker-btn" class:picked={scheduledStart} onclick={openStartPicker} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {#if scheduledStart}
            <path d="M5 4l12 8-12 8z"/><path d="M20 4v16"/>
            {:else}
            <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
            {/if}
        </svg>
        <span class="start-picker-text">
            Starts with <b>{scheduledStart ? scheduledStart.title : 'a shuffled track'}</b>{#if scheduledStart?.phases}<span class="start-picker-phases"> · if {phaseList(scheduledStart.phases).toLowerCase()}</span>{/if}
        </span>
    </button>
    {/if}

    <div class="hero">
        <MusicArt imageUrl={nowPlaying?.imageUrl ?? null} source={nowPlaying?.source ?? null} size={180}/>
        <div class="track">
            <div class="title">{nowPlaying?.title ?? 'Nothing playing'}</div>
            <div class="artist">{nowPlaying?.artist ?? (noPlayer ? 'No music player running' : 'Choose a preset above')}</div>
            {#if nowPlaying}
            <div class="source">{nowPlaying.source === 'spotify' ? 'Spotify' : 'Music'}</div>
            {/if}
        </div>
    </div>

    <div class="transport">
        <button class="round" onclick={() => music.previous()} disabled={!nowPlaying} title="Previous track" aria-label="Previous track">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button class="round play" onclick={() => music.togglePlayPause()} disabled={!nowPlaying} title={nowPlaying?.playing ? 'Pause' : 'Play'} aria-label={nowPlaying?.playing ? 'Pause' : 'Play'}>
            {#if nowPlaying?.playing}
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            {:else}
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            {/if}
        </button>
        <button class="round" onclick={() => music.next()} disabled={!nowPlaying} title="Next track" aria-label="Next track">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
    </div>

    <div class="volume-row">
        <button class="mute" class:active={music.muted} onclick={() => music.toggleMute()} disabled={!nowPlaying}
            title={music.muted ? 'Unmute music' : 'Mute music'} aria-label="Mute music" aria-pressed={music.muted}>
            {#if music.muted}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M15.3 9.7l1.4-1.4 2.3 2.3 2.3-2.3 1.4 1.4-2.3 2.3 2.3 2.3-1.4 1.4-2.3-2.3-2.3 2.3-1.4-1.4 2.3-2.3z"/></svg>
            {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
            {/if}
        </button>
        <input type="range" min="0" max="1" step="0.01" value={volume} disabled={!nowPlaying}
            aria-label="Music volume"
            oninput={onVolumeInput}
            onpointerdown={() => { localVolume = volume; dragging = true; }}
            onpointerup={() => dragging = false}
            onpointercancel={() => dragging = false}/>
        <button class="dim" class:active={audioDim?.dimmed} onclick={() => audioDim?.toggle()} disabled={!audioDim}
            title={audioDim?.dimmed ? 'Restore audio volume' : `Dim all audio (-${audioDim?.amountDb ?? DEFAULT_DIM_AMOUNT_DB} dB)`}
            aria-pressed={audioDim?.dimmed ?? false}>
            <span class="dim-label">DIM</span>
            <span class="dim-amount">{audioDim?.dimmed ? `-${audioDim.amountDb}` : 0} dB</span>
        </button>
    </div>

    {#if music.error}<div class="error">{music.error}</div>{/if}

</div>

{#if pickingStart}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="sheet-backdrop" onclick={() => pickingStart = false} role="presentation">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="First track" tabindex="-1">
        <div class="sheet-header">
            <h3>First track</h3>
            <button class="sheet-close" onclick={() => pickingStart = false} aria-label="Close">✕</button>
        </div>
        <div class="hint">{scheduledPreset?.name ?? 'The next preset'} starts with this at the next phase, then shuffles</div>
        {#if startLists && startLists.reduce((n, l) => n + l.tracks.length, 0) > SEARCH_FROM_TRACKS}
        <input class="track-search" type="search" placeholder="Search tracks" aria-label="Search tracks" bind:value={startFilter}/>
        {/if}
        <div class="sheet-body">
            <button class="start-track" class:chosen={!scheduledStart} onclick={() => pickStart(null)}>
                <span class="track-shuffle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
                </span>
                <span class="track-text"><span class="track-title">Shuffle</span><span class="track-artist">Whatever comes up next</span></span>
            </button>
            {#if !filteredStartLists}
            <div class="empty">Loading tracks…</div>
            {:else}
            {#each filteredStartLists as list (list.key)}
            {#if list.phases || filteredStartLists.length > 1}
            <div class="list-header">
                <span class="list-name">{list.name}</span>
                {#if list.phases}<span class="list-phases">{phaseList(list.phases)}</span>{/if}
            </div>
            {/if}
            {#if list.error}
            <div class="empty">{list.error}</div>
            {:else if list.tracks.length === 0}
            <div class="empty">{startFilter.trim() ? 'No tracks match' : 'No tracks'}</div>
            {:else}
            <div class="tracks">
                {#each list.tracks as track (track.id)}
                {@const chosen = scheduledStart?.listKey === list.key && scheduledStart.trackId === track.id}
                <button class="start-track" class:chosen onclick={() => pickStart({ listKey: list.key, trackId: track.id })}>
                    <MusicArt imageUrl={track.imageUrl} source={null} size={36}/>
                    <span class="track-text">
                        <span class="track-title">{track.title}</span>
                        {#if track.artist}<span class="track-artist">{track.artist}</span>{/if}
                    </span>
                    {#if chosen}<span class="preset-status">First</span>{/if}
                </button>
                {/each}
            </div>
            {/if}
            {/each}
            {/if}
        </div>
    </div>
</div>
{/if}

{#if pickingPreset}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="sheet-backdrop" onclick={() => pickingPreset = false} role="presentation">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheet" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Presets" tabindex="-1">
        <div class="sheet-header">
            <h3>Presets</h3>
            <button class="sheet-close" onclick={() => pickingPreset = false} aria-label="Close">✕</button>
        </div>
        <div class="sheet-body">
            {#if music.anyPlaying}<div class="hint">Picks wait for the next phase · tap twice to switch now</div>{/if}
            {#if presets.length === 0}
            <div class="empty">No presets yet. Add them in Settings → Music or Settings → Spotify.</div>
            {:else}
            <div class="presets">
                {#each presets as preset (preset.key)}
                    {@const status = presetStatus(preset)}
                    <button class="preset" class:current={preset.current} class:pending={preset.pending} class:scheduled={preset.scheduled}
                        onclick={preset.click} disabled={!preset.available}>
                        <span class="preset-source" class:spotify={preset.source === 'spotify'} title={preset.source === 'spotify' ? 'Spotify' : 'Music'}>
                            {#if preset.playing}
                            <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
                            {:else}
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
                            {/if}
                        </span>
                        <span class="preset-name">
                            {preset.name}
                            <span class="preset-meta">
                                <span class="preset-kind">{preset.source === 'spotify' ? 'Spotify' : 'Music'}{preset.adaptive ? ' · Adaptive' : ''}</span>
                                {#if preset.phases}
                                {@const phases = preset.phases}
                                <span class="phases">
                                    {#each TIMES_OF_DAY as phase (phase)}
                                    <svg class:active={phases[phase]} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <title>{phase[0].toUpperCase() + phase.slice(1)}: {phases[phase] ? 'playlist' : 'silent'}</title>
                                        {#if phase === 'morning'}
                                        <path d="M3 19h18M7 19a5 5 0 0 1 10 0M12 4v6M9.5 6.5 12 4l2.5 2.5"/>
                                        {:else if phase === 'day'}
                                        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
                                        {:else if phase === 'dusk'}
                                        <path d="M3 19h18M7 19a5 5 0 0 1 10 0M12 4v6M9.5 7.5 12 10l2.5-2.5"/>
                                        {:else}
                                        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>
                                        {/if}
                                    </svg>
                                    {/each}
                                </span>
                                {/if}
                            </span>
                        </span>
                        {#if status}<span class="preset-status">{status}</span>{/if}
                    </button>
                {/each}
            </div>
            {#if unavailable.length > 0}
            <div class="empty">{unavailable.join(' and ')} {unavailable.length === 1 ? "isn't" : "aren't"} running. Start {unavailable.length === 1 ? 'it' : 'them'} on the device that plays the sound (in its mixer).</div>
            {/if}
            {/if}
        </div>
    </div>
</div>
{/if}

<style>
    .music-view {
        display: flex;
        flex-direction: column;
        gap: 14px;
        /* A fixed width, not the content's, so it doesn't shift as the labels change */
        width: min(360px, calc(100vw - 32px));
        margin: 0 auto;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .back, .mixer {
        display: flex;
        align-items: center;
        gap: 0.3em;
        padding: 6px 10px 6px 4px;
        border: none;
        border-radius: 8px;
        background: none;
        color: inherit;
        font: inherit;
        font-size: 0.85em;
        cursor: pointer;
        opacity: 0.85;
    }

    .mixer {
        padding: 6px 10px;
    }

    .back:hover, .mixer:hover {
        background: rgba(255, 255, 255, 0.08);
        opacity: 1;
    }

    .preset-picker-btn {
        align-self: center;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 100%;
        box-sizing: border-box;
        padding: 8px 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font: inherit;
        font-size: 0.85em;
        cursor: pointer;
    }

    .preset-picker-btn:hover {
        background: rgba(255, 255, 255, 0.12);
    }

    .preset-picker-btn svg {
        flex: none;
        opacity: 0.7;
    }

    .preset-picker-text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.2;
    }

    .preset-picker-name, .preset-picker-next {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .preset-picker-name {
        font-weight: 600;
    }

    .preset-picker-next {
        font-size: 0.75em;
        color: #fc6;
    }

    /* What the waiting preset starts with, under the preset button, in the waiting colour once one's picked */
    .start-picker-btn {
        align-self: center;
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 100%;
        box-sizing: border-box;
        margin-top: -6px;
        padding: 4px 12px;
        border: none;
        border-radius: 999px;
        background: none;
        color: inherit;
        font: inherit;
        font-size: 0.75em;
        opacity: 0.75;
        cursor: pointer;
    }

    .start-picker-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        opacity: 1;
    }

    .start-picker-btn.picked {
        color: #fc6;
        opacity: 1;
    }

    .start-picker-btn svg {
        flex: none;
    }

    .start-picker-text {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .start-picker-phases {
        opacity: 0.75;
    }

    .track-search {
        margin-bottom: 8px;
        padding: 8px 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font: inherit;
        font-size: 0.9em;
    }

    .list-header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 4px;
        font-size: 0.8em;
        font-weight: 600;
    }

    .list-phases {
        flex: none;
        font-weight: normal;
        opacity: 0.6;
    }

    .tracks {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .start-track {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 12px 6px 6px;
        border: none;
        border-radius: 10px;
        background: none;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .start-track:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    .start-track.chosen {
        box-shadow: inset 0 0 0 2px #fc6;
    }

    .start-track.chosen .preset-status {
        color: #fc6;
        opacity: 1;
    }

    .track-shuffle {
        flex: none;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        border-radius: 4px;
        background: #3a3a44;
    }

    .track-shuffle svg {
        width: 18px;
        height: 18px;
    }

    .track-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        font-size: 0.9em;
    }

    .track-title, .track-artist {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .track-artist {
        font-size: 0.8em;
        opacity: 0.6;
    }

    .sheet-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        background: rgba(0, 0, 0, 0.55);
        animation: fade-in 0.15s ease-out;
    }

    .sheet {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 420px;
        max-height: 75vh;
        box-sizing: border-box;
        padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
        border-radius: 16px 16px 0 0;
        background: var(--theme-bg-secondary);
        color: var(--theme-on-bg);
        animation: slide-up 0.2s ease-out;
    }

    @media (min-width: 600px) {
        .sheet-backdrop { align-items: center; }
        .sheet { border-radius: 16px; }
    }

    @keyframes fade-in {
        from { opacity: 0; }
    }

    @keyframes slide-up {
        from { transform: translateY(30px); opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
        .sheet-backdrop, .sheet { animation: none; }
    }

    .sheet-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .sheet-header h3 {
        margin: 0;
    }

    .sheet-close {
        padding: 4px 10px;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }

    /* The list scrolls inside the sheet, however many presets there are */
    .sheet-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
    }

    .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
    }

    .hero :global(.art) {
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .track {
        width: 100%;
        min-width: 0;
    }

    .title {
        font-size: 1.1em;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .artist {
        font-size: 0.85em;
        opacity: 0.7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .source {
        margin-top: 4px;
        font-size: 0.7em;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.5;
    }

    .transport {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 18px;
    }

    .round {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 48px;
        height: 48px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        color: inherit;
        cursor: pointer;
    }

    .round svg {
        width: 28px;
        height: 28px;
    }

    .round.play {
        width: 64px;
        height: 64px;
        background: #f2f2f2;
        color: #1c1c1c;
    }

    .round.play svg {
        width: 32px;
        height: 32px;
    }

    .round:hover:not(:disabled):not(.play) {
        background: rgba(255, 255, 255, 0.1);
    }

    .round:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .volume-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* The speaker: mutes the music, red while muted */
    .mute {
        flex: none;
        display: flex;
        padding: 4px;
        border: none;
        background: none;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .mute svg {
        width: 20px;
        height: 20px;
    }

    .mute.active {
        opacity: 1;
        color: #ff6b6b;
    }

    .mute:hover:not(:disabled):not(.active) {
        opacity: 0.85;
    }

    .mute:disabled {
        opacity: 0.2;
        cursor: not-allowed;
    }

    .volume-row input {
        flex: 1;
        min-width: 0;
        accent-color: #f2f2f2;
    }

    /* Just text, as in the now playing bar: faint while off, red while dimmed */
    .dim {
        flex: none;
        box-sizing: border-box;
        width: 48px; /* Fits "-18 dB", so the readout doesn't shift its neighbours as it changes */
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 4px 6px;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        line-height: 1.1;
        opacity: 0.45;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .dim.active {
        opacity: 1;
        color: #ff6b6b;
    }

    .dim:hover:not(:disabled):not(.active) {
        opacity: 0.7;
    }

    .dim:disabled {
        opacity: 0.2;
        cursor: not-allowed;
    }

    .dim-label {
        font-size: 0.75em;
        font-weight: bold;
    }

    .dim-amount {
        font-size: 0.6em;
    }

    .hint {
        font-size: 0.75em;
        opacity: 0.65;
    }

    .presets {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .preset {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px 8px 8px;
        border: none;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .preset:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
    }

    .preset.current {
        background: rgba(255, 255, 255, 0.16);
    }

    /* As on the mixer's strips: the one being switched to in the pending colour, the one waiting outlined in it */
    .preset.pending {
        background: rgba(255, 204, 102, 0.25);
    }

    .preset.scheduled {
        box-shadow: inset 0 0 0 2px #fc6;
    }

    .preset:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .preset-source {
        flex: none;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #3a3a44;
    }

    .preset-source.spotify {
        background: #1d4d2f;
        color: #1db954;
    }

    .preset-source svg {
        width: 18px;
        height: 18px;
    }

    .preset-name {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        font-size: 0.9em;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .preset-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75em;
    }

    .preset-kind {
        opacity: 0.55;
    }

    /* An adaptive preset's phases: bright where it has a playlist, faint where it's silent */
    .phases {
        display: flex;
        gap: 3px;
    }

    .phases svg {
        width: 14px;
        height: 14px;
        opacity: 0.5;
    }

    .phases svg.active {
        opacity: 1;
    }

    .preset-status {
        flex: none;
        font-size: 0.7em;
        opacity: 0.75;
    }

    .preset.scheduled .preset-status, .preset.pending .preset-status {
        color: #fc6;
        opacity: 1;
    }

    /* A small equaliser for the preset that's playing */
    .bars {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 14px;
    }

    .bars i {
        width: 3px;
        background: currentColor;
        animation: bar 0.9s ease-in-out infinite alternate;
    }

    .bars i:nth-child(2) { animation-delay: -0.3s; }
    .bars i:nth-child(3) { animation-delay: -0.6s; }

    @keyframes bar {
        from { height: 3px; }
        to { height: 14px; }
    }

    @media (prefers-reduced-motion: reduce) {
        .bars i { animation: none; height: 10px; }
    }

    .empty {
        font-size: 0.8em;
        opacity: 0.6;
        text-align: center;
    }

    .error {
        font-size: 0.8em;
        color: #ff8a8a;
        text-align: center;
    }
</style>
