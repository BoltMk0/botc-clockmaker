<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { chevronRightIcon, closeIcon } from "$lib/icons/material.js";
    import GrimSnapshotView from "$lib/components/GrimSnapshotView.svelte";
    import type { Character, Preset } from "$lib/resources/common/gameData.js";
    import { byMostRecentPlay, formatPlayDate as formatDate, snapshotViewProps, todayPlayDate, type PresetPlay, type PresetPlaySummary, type PresetWinner } from "$lib/resources/common/presetPlays.js";

    // The games played from a preset, most recent first: ones ended from the virtual grim (with a snapshot of it) and
    // ones logged by hand here. Adding or deleting a game also changes the preset's win counts, passed back in onchange.
    // Tapping a game with a grim snapshot opens it.

    let { presetId, plays: initialPlays, counts, characters, onchange }: {
        presetId: string;
        plays: PresetPlaySummary[];
        counts: Pick<Preset, 'good_victories' | 'evil_victories'>;
        /** The script's characters, for showing grim snapshots. */
        characters?: ReadonlyMap<string, Character>;
        onchange: (preset: Preset) => void;
    } = $props();

    let viewing = $state<PresetPlay | null>(null);

    async function openSnapshot(play: PresetPlaySummary) {
        try {
            const response = await fetch(`/api/presets/${presetId}/plays/${play.id}`);
            if (!response.ok) throw new Error(response.statusText);
            const full: PresetPlay = await response.json();
            if (!full.grim) throw new Error('This game has no grim snapshot');
            viewing = full;
        } catch (er) {
            alert(`Failed to open the grim snapshot: ${er}`);
        }
    }

    // svelte-ignore state_referenced_locally
    let plays = $state(initialPlays);
    let date = $state(todayPlayDate());
    let winner = $state<PresetWinner | null>(null);
    let busy = $state(false);

    // Games won before plays were logged only show up in the counts.
    const earlierGood = $derived(Math.max(0, counts.good_victories - plays.filter(p => p.winner === 'good').length));
    const earlierEvil = $derived(Math.max(0, counts.evil_victories - plays.filter(p => p.winner === 'evil').length));

    function sortPlays(list: PresetPlaySummary[]): PresetPlaySummary[] {
        return [...list].sort(byMostRecentPlay);
    }

    async function addPlay() {
        if (!winner || !date) return;
        busy = true;
        try {
            const response = await fetch(`/api/presets/${presetId}/plays`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, winner })
            });
            if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? response.statusText);
            const result: { preset: Preset, play: PresetPlaySummary } = await response.json();
            plays = sortPlays([...plays, result.play]);
            onchange(result.preset);
            winner = null;
            date = todayPlayDate();
        } catch (er) {
            alert(`Failed to add the game: ${er}`);
        } finally {
            busy = false;
        }
    }

    async function deletePlay(play: PresetPlaySummary) {
        if (!confirm(`Delete the game played on ${formatDate(play.date)}?${play.has_grim ? ' Its grim snapshot will be deleted too.' : ''}`)) return;
        busy = true;
        try {
            const response = await fetch(`/api/presets/${presetId}/plays/${play.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(response.statusText);
            plays = plays.filter(p => p.id !== play.id);
            onchange(await response.json());
        } catch (er) {
            alert(`Failed to delete the game: ${er}`);
        } finally {
            busy = false;
        }
    }
</script>

<div class="history">
    <div class="add-play">
        <input class="input-style" type="date" bind:value={date} max={todayPlayDate()} aria-label="Date played"/>
        <div class="winner-choice" role="radiogroup" aria-label="Winning team">
            <button class="button-style good" class:highlight={winner === 'good'} role="radio" aria-checked={winner === 'good'} onclick={() => winner = 'good'}>Good won</button>
            <button class="button-style evil" class:highlight={winner === 'evil'} role="radio" aria-checked={winner === 'evil'} onclick={() => winner = 'evil'}>Evil won</button>
        </div>
        <button class="button-style highlight" disabled={busy || !winner || !date} onclick={addPlay}>+ Add game</button>
    </div>

    {#if plays.length === 0 && earlierGood + earlierEvil === 0}
        <div class="empty">Not played yet.</div>
    {:else}
        <ul class="plays">
            {#each plays as play (play.id)}
                <li class="play" class:openable={play.has_grim}>
                    {#if play.has_grim}
                        <!-- Covers the whole row, so tapping anywhere on it opens the snapshot; the delete button sits above it. -->
                        <button class="row-open" aria-label="Show the grim from {formatDate(play.date)}" onclick={() => openSnapshot(play)}></button>
                    {/if}
                    <span class="play-date">{formatDate(play.date)}</span>
                    <span class="winner-pill {play.winner}">{play.winner === 'good' ? 'Good' : 'Evil'} won</span>
                    {#if play.has_grim}
                        <span class="grim-badge" title="Tap to see the virtual grim as it was when this game was ended">Grim snapshot <MaterialIcon icon={chevronRightIcon} size="1.2em"/></span>
                    {/if}
                    <button class="remove" disabled={busy} aria-label="Delete the game on {formatDate(play.date)}" title="Delete" onclick={() => deletePlay(play)}><MaterialIcon icon={closeIcon} size="1.25em"/></button>
                </li>
            {/each}
        </ul>
        {#if earlierGood + earlierEvil > 0}
            <div class="earlier">
                Plus {earlierGood + earlierEvil} earlier {earlierGood + earlierEvil === 1 ? 'game' : 'games'} from before history was kept
                (good {earlierGood}, evil {earlierEvil}).
            </div>
        {/if}
    {/if}
</div>

{#if viewing?.grim}
    <GrimSnapshotView snapshot={viewing.grim.snapshot} {...snapshotViewProps(viewing)} {characters} onclose={() => viewing = null}/>
{/if}

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
    }

    .add-play {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5em 1em;
    }

    .winner-choice {
        display: flex;
        gap: 0.5em;
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
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4em 0.8em;
        padding: 0.5em 0.5em 0.5em 0.9em;
        border-radius: 0.6em;
        background: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    .play.openable {
        position: relative;
    }
    .play.openable:hover {
        background: var(--theme-bg);
        color: var(--theme-on-bg);
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
    .play.openable .remove {
        position: relative;
    }

    .play-date {
        min-width: 9em;
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

    .grim-badge {
        font-size: 0.8em;
        opacity: 0.7;
    }

    .remove {
        margin-left: auto;
        width: 2em;
        height: 2em;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        color: inherit;
        font: inherit;
        opacity: 0.6;
        cursor: pointer;
    }
    .remove:hover:not(:disabled) {
        opacity: 1;
        background: var(--theme-bg-secondary);
    }

    .empty,
    .earlier {
        opacity: 0.6;
        font-style: italic;
    }
</style>
