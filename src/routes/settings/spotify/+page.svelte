<script lang="ts">
    import { isSpotifyPhasePreset, parseSpotifyContextUri, type SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import DayIcon from "$lib/assets/dayIcon.svelte";
    import NightIcon from "$lib/assets/nightIcon.svelte";
    import { onMount } from "svelte";

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
<div class="panel">
<div class="panel-header">
    <h2>Spotify Presets</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Albums and playlists shown on the Spotify strip in the mixer. Clicking one starts it playing straight away. In Spotify, use Share &rarr; Copy link and paste it here.<br/>A day/night preset has a list for each phase: it plays the one for the current phase, and crossfades to a random track from the other whenever the games go from day to night or back.</p>
<div class="table-container">
<table>
    <tbody>
        <tr>
            <th>Name</th>
            <th>Album / playlist link</th>
            <th></th>
        </tr>
        {#each rows as row, i (row.id)}
            <tr>
                <td><input bind:value={row.name} type="text" placeholder="Name"/></td>
                <td>
                    {#if row.phase}
                        <div class="phase-links">
                            <span class="phase-icon" title="Day"><DayIcon/></span>
                            <input class="link-input" class:invalid={isInvalidLink(row.dayLink)} bind:value={row.dayLink} type="text" placeholder="Day: https://open.spotify.com/playlist/..."/>
                            <span class="phase-icon" title="Night"><NightIcon/></span>
                            <input class="link-input" class:invalid={isInvalidLink(row.nightLink)} bind:value={row.nightLink} type="text" placeholder="Night: https://open.spotify.com/playlist/..."/>
                        </div>
                    {:else}
                        <input class="link-input" class:invalid={isInvalidLink(row.link)} bind:value={row.link} type="text" placeholder="https://open.spotify.com/playlist/..."/>
                    {/if}
                </td>
                <td><button onclick={()=>rows.splice(i, 1)}>Delete</button></td>
            </tr>
        {/each}
        <tr>
            <td colspan="3">
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

<style>
    input.link-input {
        width: 32em;
        max-width: 100%;
    }

    .phase-links {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 0.3em 0.5em;
    }

    .phase-icon {
        display: flex;
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

    .table-container {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
        overflow-x: auto;
    }

    table {
        width: 100%;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border-collapse: collapse;
    }

    th {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        padding: 0.4em 0.6em;
    }

    td {
        padding: 0.3em 0.5em;
        border-top: 1px solid var(--theme-bg-tertiary);
    }

    tr:nth-child(even) td {
        background-color: var(--theme-bg-secondary);
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
