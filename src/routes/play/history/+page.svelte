<script lang="ts">
    import GrimSnapshotView from '$lib/components/GrimSnapshotView.svelte';
    import { formatPlayDate, snapshotViewProps, type PlayHistoryEntry, type PresetPlay } from '$lib/resources/common/presetPlays';

    // Every game logged against a preset, most recent first. Tapping one with a grim snapshot opens it.

    let { data }: { data: { plays: PlayHistoryEntry[] } } = $props();

    let viewing = $state<PresetPlay | null>(null);

    async function openSnapshot(play: PlayHistoryEntry){
        try{
            const response = await fetch(`/api/presets/${play.preset_id}/plays/${play.id}`);
            if(!response.ok) throw new Error(response.statusText);
            const full: PresetPlay = await response.json();
            if(!full.grim) throw new Error('This game has no grim snapshot');
            viewing = full;
        }catch(er){
            alert(`Failed to open the grim snapshot: ${er}`);
        }
    }
</script>

<div class="history-page">
  <div class="column">
  <a class="back-link" href="/play">
    <svg width={24} height={24} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M15 5l-7 7 7 7" />
    </svg>
    Back
  </a>
  <h1>Game History</h1>
  <p class="description">Every game played from a preset, most recent first. Tap a game with a grim snapshot to see how the grim ended.</p>

  <section class="card">
    {#if data.plays.length === 0}
        <p class="empty">No games played yet. Games are logged when you end a game set up from a preset, or add one in a preset's history.</p>
    {:else}
        <ul class="plays">
            {#each data.plays as play (play.id)}
                <li class="play" class:openable={play.has_grim}>
                    {#if play.has_grim}
                        <!-- Covers the whole row, so tapping anywhere on it opens the snapshot; the preset link sits above it. -->
                        <button class="row-open" aria-label="Show the grim from {formatPlayDate(play.date)}" onclick={() => openSnapshot(play)}></button>
                    {/if}
                    <div class="play-main">
                        <span class="play-date">{formatPlayDate(play.date)}</span>
                        <span class="winner-pill {play.winner}">{play.winner === 'good' ? 'Good' : 'Evil'} won</span>
                        {#if play.day}<span class="play-day">Day {play.day}</span>{/if}
                    </div>
                    <div class="play-source">
                        {play.script_name ?? 'Unknown script'} ·
                        <a class="preset-link" href="/settings/scripts/{play.script_id}/presets/{play.preset_id}">{play.preset_name}</a>
                        {#if play.has_grim}<span class="grim-badge">Grim snapshot ›</span>{/if}
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
  </section>
  </div>
</div>

{#if viewing?.grim}
    <GrimSnapshotView snapshot={viewing.grim.snapshot} {...snapshotViewProps(viewing)} onclose={() => viewing = null}/>
{/if}

<style>
    .history-page {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 1rem 1.5rem 1.5rem;
        overflow: auto;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        color: var(--theme-on-bg);
    }

    .column {
        width: 100%;
        max-width: 42rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .back-link {
        align-self: flex-start;
        display: flex;
        align-items: center;
        gap: 0.2em;
        font-size: large;
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
    }
    .back-link:hover {
        opacity: 1;
    }

    h1 {
        margin: 0;
        font-size: 1.5rem;
    }

    .description {
        margin: -0.5rem 0 0.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .card {
        width: 100%;
        padding: 1rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .empty {
        margin: 0.5rem 0;
        text-align: center;
        opacity: 0.7;
    }

    .plays {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
    }

    .play {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        padding: 0.7em 0.9em;
        border-radius: 10px;
        background: var(--theme-bg);
        color: var(--theme-on-bg);
        border: 1px solid var(--theme-bg-tertiary);
    }
    .play.openable:hover {
        background: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    .row-open {
        position: absolute;
        inset: 0;
        padding: 0;
        border: none;
        border-radius: inherit;
        background: none;
        cursor: pointer;
    }
    .row-open:focus-visible {
        outline: 2px solid var(--theme-highlight);
        outline-offset: 2px;
    }

    .play-main {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4em 0.8em;
    }
    .play-date {
        font-weight: 600;
    }
    .winner-pill {
        padding: 0.15em 0.7em;
        border-radius: 999px;
        font-size: 0.85em;
        font-weight: 600;
        color: white;
    }
    .winner-pill.good {
        background: #2563eb;
    }
    .winner-pill.evil {
        background: #dc2626;
    }
    .play-day {
        font-size: 0.9em;
        opacity: 0.8;
    }

    .play-source {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3em;
        font-size: 0.9em;
        opacity: 0.75;
    }
    .preset-link {
        position: relative;
        color: inherit;
    }
    .grim-badge {
        margin-left: auto;
        font-size: 0.9em;
    }

    @media (max-width: 560px) {
        .history-page {
            padding: 0.75rem 0.75rem 1rem;
        }
    }
</style>
