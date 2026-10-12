<script lang="ts">
    import { onMount } from "svelte";
    import { COUNTDOWN_PHASES, isSpotifyAdaptivePreset, isSpotifyCountdownPreset, parseSpotifyContextUri, type CountdownPhase, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import BinIcon from "$lib/assets/binIcon.svelte";

    /** The Spotify presets editor: the albums and playlists shown on the mixer's music strip while Spotify runs it. */

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
        fetch('/api/spotifyPresets').then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to fetch');
        }).then((data: SpotifyPreset[]) => {
            rows = data.map(toRow);
            savedSnapshot = JSON.stringify(rows);
        }).catch(() => {
            alert('Failed to fetch Spotify presets!');
        });
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

<div class="panel">
<div class="panel-header">
    <h2>Spotify Presets</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Albums and playlists shown on the Spotify strip in the mixer. Clicking one starts it playing straight away. In Spotify, use Share &rarr; Copy link and paste it here.<br/>An ambient adaptive playlist has a list for each phase: it plays the one for the current phase, and fades out to a random track from the next phase's list whenever the games' phase changes. Leave a phase empty to keep it silent: the music fades out and pauses through it, and picks up again by itself when a phase with a list comes round. A phase with the same list as the one playing carries straight on.<br/>A day &amp; night playlist has a list for the day and one for the night. The day list only plays while a game's countdown is running; the rest of the day (the morning before it's started, a pause, and dusk) is silent, and it picks up again by itself when the countdown starts or night falls. Leave a list empty to keep that time silent too.</p>
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
                                <input class="link-input" class:invalid={isInvalidLink(row.phaseLinks[t])} bind:value={row.phaseLinks[t]} type="text" placeholder="{TIME_OF_DAY_LABELS[t]}: https://open.spotify.com/playlist/... (empty: silent)"/>
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

<style>
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

    .panel-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
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

    input.invalid {
        border-color: #d55;
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button.add {
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.save {
        padding: 0.5em 1.2em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
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

    .row-actions {
        white-space: nowrap;
        text-align: right;
    }

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

    .add-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    @media (max-width: 560px) {
        .panel {
            padding: 1rem;
        }
        .description {
            margin-bottom: 1rem;
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
