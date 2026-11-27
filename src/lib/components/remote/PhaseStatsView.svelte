<script lang="ts" module>
    import type { TimeOfDay } from "$lib/model/client/types";

    /**
     * Each phase's colour in the charts: in the phase's own hue (as the remote's buttons), stepped to sit in one
     * lightness band on the dark panels and stay apart for colour-blind eyes (checked with the dataviz validator).
     */
    export const PHASE_COLOURS: Record<TimeOfDay, string> = {
        morning: '#b8891a',
        day: '#d0506a',
        dusk: '#8a6ad8',
        night: '#0a92ad'
    };
</script>

<script lang="ts">
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY } from "$lib/model/client/types";
    import { formatDuration, phaseStats, type PhaseLogEntry } from "$lib/model/common/phaseLog";
    import PhaseDonut, { type DonutGroup, type DonutSegment } from "./PhaseDonut.svelte";

    /**
     * The remote's analysis view: how the game's time has divided between its phases, all days together and day by
     * day, with the averages. The phase the game's in now isn't counted: at the end of the game, that's the storyteller
     * going over the game with the players. Also shows a past game's stats, from its saved log (`ended`).
     */
    let { log, ended = false }: { log: readonly PhaseLogEntry[]; ended?: boolean } = $props();

    const stats = $derived(phaseStats(log));

    function dayLabel(day: number) {
        return day === 0 ? 'First night' : `Day ${day}`;
    }

    const allDays: DonutSegment[] = $derived(TIMES_OF_DAY.map(p => ({
        key: p, label: TIME_OF_DAY_LABELS[p], value: stats.totals[p], color: PHASE_COLOURS[p]
    })));

    const byDay: DonutSegment[] = $derived(stats.days.flatMap(d => TIMES_OF_DAY.map(p => ({
        key: `${d.day}-${p}`,
        label: d.day === 0 ? 'First night' : `Day ${d.day} · ${TIME_OF_DAY_LABELS[p]}`,
        value: d.phases[p],
        color: PHASE_COLOURS[p]
    }))));

    const dayGroups: DonutGroup[] = $derived(stats.days.map(d => ({
        key: `day-${d.day}`, label: dayLabel(d.day), tick: String(d.day), segments: TIMES_OF_DAY.length
    })));

    function share(ms: number) {
        return stats.total > 0 ? `${Math.round((ms / stats.total) * 100)}%` : '';
    }
</script>

<div class="stats-view">
    {#if stats.total === 0}
    <section class="card empty">
        <p>{ended ? 'No phase ended before the game did.' : 'No phase has ended yet.'}</p>
        <p class="note">The game's time is counted from the first night: when night falls on day 0, after a new game.</p>
    </section>
    {:else}
    <p class="note">The {TIME_OF_DAY_LABELS[log[log.length - 1].timeOfDay].toLowerCase()} the game {ended ? 'ended in' : "'s in now"} isn't counted. Tap a slice for its time.</p>

    <section class="card">
        <h3>Averages</h3>
        <div class="averages">
            <div class="tile wide">
                <span class="tile-label">Day, morning to the end of night</span>
                <span class="tile-value">{stats.averageDay === null ? '—' : formatDuration(stats.averageDay)}</span>
                <span class="tile-sub">{stats.fullDays === 0 ? 'No day has ended yet' : `Over ${stats.fullDays} full day${stats.fullDays === 1 ? '' : 's'}`}</span>
            </div>
            {#each TIMES_OF_DAY as p}
            <div class="tile">
                <span class="tile-label"><span class="swatch" style="background: {PHASE_COLOURS[p]};"></span>{TIME_OF_DAY_LABELS[p]}</span>
                <span class="tile-value">{stats.averagePhase[p] === null ? '—' : formatDuration(stats.averagePhase[p]!)}</span>
            </div>
            {/each}
        </div>
    </section>

    <section class="card">
        <h3>All days</h3>
        <PhaseDonut segments={allDays} totalLabel="Played" ariaLabel="Time in each phase, all days together"/>
        <ul class="legend">
            {#each TIMES_OF_DAY as p}
            <li>
                <span class="swatch" style="background: {PHASE_COLOURS[p]};"></span>
                <span class="legend-label">{TIME_OF_DAY_LABELS[p]}</span>
                <span class="legend-value">{formatDuration(stats.totals[p])}</span>
                <span class="legend-share">{share(stats.totals[p])}</span>
            </li>
            {/each}
        </ul>
    </section>

    <section class="card">
        <h3>Day by day</h3>
        <PhaseDonut segments={byDay} groups={dayGroups} totalLabel="Played" ariaLabel="Time in each phase of each day"/>
        <ul class="legend inline">
            {#each TIMES_OF_DAY as p}
            <li><span class="swatch" style="background: {PHASE_COLOURS[p]};"></span>{TIME_OF_DAY_LABELS[p]}</li>
            {/each}
        </ul>
        <p class="note">The outer ring marks off the days, numbered.</p>
        <table>
            <thead>
                <tr>
                    <th scope="col">Day</th>
                    {#each TIMES_OF_DAY as p}<th scope="col">{TIME_OF_DAY_LABELS[p]}</th>{/each}
                    <th scope="col">Total</th>
                </tr>
            </thead>
            <tbody>
                {#each stats.days as d (d.day)}
                <tr>
                    <th scope="row">{d.day}</th>
                    {#each TIMES_OF_DAY as p}<td>{d.phases[p] > 0 ? formatDuration(d.phases[p]) : '—'}</td>{/each}
                    <td class="total">{formatDuration(d.total)}</td>
                </tr>
                {/each}
            </tbody>
        </table>
    </section>
    {/if}
</div>

<style>
    /* The panels side by side as far as they fit, wrapping onto more rows on narrower screens */
    .stats-view {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        /* The panels in a row are all as tall as the tallest */
        align-items: stretch;
        gap: 12px;
    }

    .stats-view > .note {
        flex-basis: 100%;
    }

    /* Tints are opaque mixes of white into --surface, not translucent white, which forced dark modes turn black */
    .card {
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        /* A fixed width, not the content's, as the other views */
        width: min(360px, calc(100vw - 32px));
        gap: 10px;
        padding: 14px 12px;
        border-radius: 14px;
        --surface: color-mix(in srgb, #fff 5%, var(--theme-app-bg));
        background: var(--surface);
        /* An inset ring, not a border: forced dark modes brighten dark borders into strong outlines */
        box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 8%, var(--surface));
    }

    .card h3 {
        margin: 0;
        font-size: 0.8em;
        font-weight: 600;
        opacity: 0.8;
    }

    .empty p {
        margin: 0;
        text-align: center;
    }

    .note {
        margin: 0;
        font-size: 0.7em;
        opacity: 0.65;
        text-align: center;
    }

    .averages {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .tile {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 8px;
        background: color-mix(in srgb, #fff 6%, var(--surface));
        font-variant-numeric: tabular-nums;
    }

    .tile.wide {
        grid-column: span 2;
    }

    .tile-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.65em;
        opacity: 0.7;
    }

    .tile-value {
        font-size: 1.1em;
        font-weight: 600;
    }

    .tile.wide .tile-value {
        font-size: 1.5em;
    }

    .tile-sub {
        font-size: 0.6em;
        opacity: 0.6;
    }

    .swatch {
        flex: none;
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
    }

    .legend {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 0.8em;
        font-variant-numeric: tabular-nums;
    }

    .legend li {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .legend-label {
        flex: 1;
    }

    .legend-share {
        width: 3em;
        text-align: right;
        opacity: 0.65;
    }

    .legend.inline {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px 14px;
        font-size: 0.7em;
    }

    .legend.inline li {
        gap: 5px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.65em;
        font-variant-numeric: tabular-nums;
    }

    th, td {
        padding: 4px 2px;
        text-align: right;
    }

    th:first-child {
        text-align: left;
    }

    thead th {
        font-weight: 600;
        opacity: 0.7;
    }

    tbody tr + tr {
        box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 8%, var(--surface));
    }

    td.total {
        font-weight: 600;
    }
</style>
