<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { ICON_VIEWBOX, chevronLeftIcon, chevronRightIcon, visibilityIcon } from "$lib/icons/material.js";
    import { formatPlayDate, playSnapshotUrl, type PlayHistoryEntry } from '$lib/resources/common/presetPlays';

    // Every game logged against a preset, most recent first. Tapping one with a grim snapshot opens it.

    let { data }: { data: { plays: PlayHistoryEntry[] } } = $props();

</script>

<div class="history-page">
  <div class="column">
  <a class="back-link" href="/play">
    <svg width={24} height={24} viewBox={ICON_VIEWBOX} fill="currentColor"><path d={chevronLeftIcon}/></svg>
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
                        <!-- Covers the whole row, so tapping anywhere on it opens the snapshot; the preset button sits above it. -->
                        <a class="row-open" aria-label="Show the grim from {formatPlayDate(play.date)}" href={playSnapshotUrl(play)}></a>
                        <span class="grim-chevron" aria-hidden="true"><MaterialIcon icon={visibilityIcon} size="1.4em"/><MaterialIcon icon={chevronRightIcon} size="2em"/></span>
                    {/if}
                    <div class="play-main">
                        <span class="play-date">{formatPlayDate(play.date)}</span>
                        <span class="winner-pill {play.winner}">{play.winner === 'good' ? 'Good' : 'Evil'} won</span>
                        {#if play.day}<span class="play-day">Day {play.day}</span>{/if}
                    </div>
                    <!-- What it was played from, opening the preset -->
                    <a class="preset-link" href="/settings/scripts/{play.script_id}/presets/{play.preset_id}">
                        {play.script_name ?? 'Unknown script'} · {play.preset_name}
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
  </section>
  </div>
</div>

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
    /* Clear of the chevron */
    .play.openable {
        padding-right: 4.4em;
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

    /* Taps on the text go through to the row beneath it */
    .play-main {
        pointer-events: none;
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

    /* A button only as wide as its text, at the row's left, above the row's own button */
    .preset-link {
        position: relative;
        align-self: flex-start;
        max-width: 100%;
        box-sizing: border-box;
        padding: 0.25em 0.7em;
        border-radius: 8px;
        border: 1px solid var(--theme-bg-tertiary);
        background: var(--theme-bg-secondary);
        color: inherit;
        font-size: 0.9em;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .preset-link:hover {
        border-color: var(--theme-highlight);
    }

    /* At the row's right, centred top to bottom; a tap on it opens the snapshot */
    .grim-chevron {
        position: absolute;
        right: 0.5em;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        gap: 0.1em;
        opacity: 0.75;
        pointer-events: none;
    }

    @media (max-width: 560px) {
        .history-page {
            padding: 0.75rem 0.75rem 1rem;
        }
    }
</style>
