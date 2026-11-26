<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { inputIcon, warningIcon } from "$lib/icons/material.js";
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { shownHex } from '@boltmk0/lightscapes/color';
    import type { ReportedState } from '@boltmk0/lightscapes/protocol';
    import PencilIcon from "$lib/components/PencilIcon.svelte";
    import { fetchOverview, hubAction, type HubSummary, type LightingOverview } from '$lib/lighting/common/api';

    let overview = $state<LightingOverview | null>(null);
    let loadError = $state('');
    /** The hub whose lights, buttons and activity are showing. */
    let openHubId = $state<string | null>(null);
    let busy = $state(false);
    let origin = $state('');

    const pending = $derived(overview?.hubs.filter(h => h.status === 'pending') ?? []);
    const approved = $derived(overview?.hubs.filter(h => h.status === 'approved') ?? []);

    async function refresh() {
        try {
            overview = await fetchOverview();
            loadError = '';
        } catch(err) {
            loadError = (err as Error).message;
        }
    }

    onMount(() => {
        origin = location.origin;
        refresh();
        // Hubs come and go, and ask to connect, while the page is open
        const timer = setInterval(refresh, 2000);
        return () => clearInterval(timer);
    });

    async function act(hub: HubSummary, body: { action: string } & Record<string, unknown>, confirmText?: string) {
        if(confirmText && !confirm(confirmText)) return;
        busy = true;
        try {
            const result = await hubAction<{ preset?: { id: string } }>(hub.hubId, body);
            await refresh();
            return result;
        } catch(err) {
            alert((err as Error).message);
        } finally {
            busy = false;
        }
    }

    async function importLegacy(hub: HubSummary) {
        const result = await act(hub, { action: 'importLegacy' });
        if(result?.preset) goto(`/settings/lightscapes/${result.preset.id}`);
    }

    async function createPreset() {
        const res = await fetch('/api/lightscapes/presets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'New Lighting Preset' })
        });
        if(!res.ok) return alert(`Failed to create the preset (${res.status})`);
        goto(`/settings/lightscapes/${(await res.json()).id}`);
    }

    async function duplicatePreset(id: string) {
        const res = await fetch(`/api/lightscapes/presets/${id}`, { method: 'POST' });
        if(!res.ok) return alert(`Failed to duplicate the preset (${res.status})`);
        await refresh();
    }

    function gameName(clockId: string | null): string {
        if(!clockId) return 'No game';
        return overview?.games.find(g => g.id === clockId)?.name ?? 'A game that has ended';
    }

    function gamesUsing(presetId: string): number {
        return overview?.games.filter(g => (g.lightingPresetId && overview?.presets.some(p => p.id === g.lightingPresetId) ? g.lightingPresetId : overview?.defaultPresetId) === presetId).length ?? 0;
    }

    function ago(at: number | undefined): string {
        if(!at) return 'never';
        const s = Math.max(0, Math.round((Date.now() - at) / 1000));
        if(s < 60) return 'just now';
        if(s < 3600) return `${Math.round(s / 60)} min ago`;
        if(s < 86400) return `${Math.round(s / 3600)} h ago`;
        return new Date(at).toLocaleDateString();
    }

    function describeState(state: ReportedState | undefined): string {
        if(!state) return 'Not known';
        if(state.reachable === false) return 'Not answering';
        if(state.on === null) return 'Not known';
        if(!state.on) return 'Off';
        const parts = ['On'];
        if(state.brightness !== undefined) parts.push(`${Math.round(state.brightness * 100)}%`);
        if(state.color?.kind === 'white') parts.push(`${Math.round(state.color.kelvin / 50) * 50}K`);
        return parts.join(', ') + (state.source === 'assumed' ? ' (as last sent)' : '');
    }
</script>

<div class="center-content main">
<div class="panels">

<div class="panel">
    <div class="panel-header"><h2>Lightscapes Hubs</h2></div>
    <p class="description">
        A Lightscapes hub drives the lights for a game: its scenes for each phase, flashing them for the bells, and its
        buttons as a clock remote. On the hub's own page, set its address to
        <code>{origin || 'this server'}/lightscapes</code>; it then asks to connect, and shows here to approve. Which game
        each hub follows is picked on Play.
    </p>

    {#if loadError}<p class="error">{loadError}</p>{/if}

    {#if pending.length}
        <h3>Asking to connect</h3>
        <div class="data-table-scroll">
        <table class="data-table">
            <tbody>
                {#each pending as hub (hub.hubId)}
                    <tr>
                        <td><span class="dot" class:online={hub.online} title={hub.online ? 'Waiting' : 'Gone'}></span>{hub.name}</td>
                        <td class="meta">asked {ago(hub.requestedAt)}</td>
                        <td class="row-actions">
                            <button disabled={busy} onclick={() => act(hub, { action: 'remove' }, `Turn ${hub.name} away? It won't ask again until it's told to on its own page.`)}>Reject</button>
                            <button class="save" disabled={busy} onclick={() => act(hub, { action: 'approve' })}>Approve</button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
        </div>
    {/if}

    {#if overview && approved.length === 0 && pending.length === 0}
        <p class="empty">No hubs yet.</p>
    {/if}

    {#if approved.length}
        {#if pending.length}<h3>Approved</h3>{/if}
        <div class="data-table-scroll">
        <table class="data-table">
            <tbody>
                <tr><th>Hub</th><th>Following</th><th class="meta">Lights</th><th class="meta">Seen</th><th></th></tr>
                {#each approved as hub (hub.hubId)}
                    {@const open = openHubId === hub.hubId}
                    <tr class="hub-row" class:open onclick={() => openHubId = open ? null : hub.hubId}>
                        <td>
                            <span class="dot" class:online={hub.online} title={hub.online ? 'Online' : 'Offline'}></span>{hub.name}
                            {#if hub.adapters.some(a => !a.ok)}<span class="warning" title={hub.adapters.filter(a => !a.ok).map(a => `${a.name}: ${a.detail ?? 'not working'}`).join('\n')}><MaterialIcon icon={warningIcon} size="1.2em"/></span>{/if}
                            {#if hub.hasLegacyConfig}<span class="tag" title="It has settings from before Clockmaker drove it">Old settings</span>{/if}
                        </td>
                        <td>{gameName(hub.clockId)}</td>
                        <td class="meta">{hub.inventory?.lights.length ?? '—'}</td>
                        <td class="meta">{hub.online ? 'Now' : ago(hub.lastSeenAt)}</td>
                        <td class="row-actions"><button class="details" aria-expanded={open}>{open ? 'Hide' : 'Details'}</button></td>
                    </tr>
                    {#if open}
                        <tr class="details-row">
                            <td colspan="5">
                                <div class="details">
                                    {#if hub.hasLegacyConfig}
                                        <div class="callout">
                                            <span>{hub.name} has settings from before Clockmaker drove it: its scenes, spectrums, bells and buttons.</span>
                                            <span class="callout-actions">
                                                <button disabled={busy} onclick={() => act(hub, { action: 'forgetLegacy' })}>Dismiss</button>
                                                <button class="save" disabled={busy} onclick={() => importLegacy(hub)}><MaterialIcon icon={inputIcon} size="1.2em"/> Import as a preset</button>
                                            </span>
                                        </div>
                                    {/if}

                                    <div class="facts">
                                        <span>Version {hub.hubVersion ?? 'unknown'}</span>
                                        {#each hub.adapters as adapter (adapter.id)}
                                            <span class:bad={!adapter.ok}>{adapter.name}: {adapter.ok ? 'working' : adapter.detail ?? 'not working'}</span>
                                        {/each}
                                        {#if hub.previewing}<span>Previewing {hub.previewing}</span>{/if}
                                    </div>

                                    <h4>Lights</h4>
                                    {#if hub.inventory?.lights.length}
                                        <ul class="lights">
                                            {#each hub.inventory.lights as light (light.id)}
                                                {@const state = hub.states[light.id]}
                                                <li>
                                                    <span class="swatch" style:background={state?.on && state.color ? shownHex(state.color) : 'transparent'} class:off={!state?.on}></span>
                                                    <span class="light-name">{light.name}{light.kind === 'group' ? ' (group)' : ''}</span>
                                                    <span class="meta">{describeState(state)}</span>
                                                </li>
                                            {/each}
                                        </ul>
                                    {:else}
                                        <p class="empty">It hasn't said what lights it has.</p>
                                    {/if}

                                    {#if hub.inventory?.inputs.length}
                                        <h4>Buttons</h4>
                                        <ul class="lights">
                                            {#each hub.inventory.inputs as input (input.id)}
                                                <li><span class="light-name">{input.name}</span><span class="meta">{input.actions?.join(', ') ?? ''}</span></li>
                                            {/each}
                                        </ul>
                                    {/if}

                                    {#if hub.activity.length}
                                        <h4>Activity</h4>
                                        <ul class="activity">
                                            {#each hub.activity.slice(0, 10) as a, i (i)}
                                                <li><time>{new Date(a.at).toLocaleTimeString()}</time>{a.text}</li>
                                            {/each}
                                        </ul>
                                    {/if}

                                    <div class="detail-actions">
                                        <button disabled={busy || !hub.online} onclick={() => act(hub, { action: 'refreshStates' })}>Ask for the lights' states again</button>
                                        <button class="remove" disabled={busy} onclick={() => act(hub, { action: 'remove' }, `Remove ${hub.name}? It stops driving the lights, and has to be told to ask again on its own page.`)}>Remove</button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    {/if}
                {/each}
            </tbody>
        </table>
        </div>
    {/if}
</div>

<div class="panel">
    <div class="panel-header"><h2>Lighting Presets</h2></div>
    <p class="description">
        What a game's lights do: a scene for each phase, spectrums for the day, reactions to the bells and stings, and
        buttons. Each game picks one on Play; games that haven't use the first.
    </p>
    <div class="data-table-scroll">
    <table class="data-table">
        <tbody>
            <tr><th>Name</th><th class="meta">Games</th><th></th></tr>
            {#each overview?.presets ?? [] as preset (preset.id)}
                <tr>
                    <td>{preset.name}{#if preset.id === overview?.defaultPresetId}<span class="tag">Default</span>{/if}</td>
                    <td class="meta">{gamesUsing(preset.id)}</td>
                    <td class="row-actions">
                        <button onclick={() => duplicatePreset(preset.id)}>Duplicate</button>
                        <a class="edit-link" href="/settings/lightscapes/{preset.id}" aria-label="Edit {preset.name}" title="Edit"><PencilIcon size={18}/></a>
                    </td>
                </tr>
            {/each}
            <tr>
                <td colspan="3"><button style="width: 100%;" class="add" onclick={createPreset}>+ Lighting Preset</button></td>
            </tr>
        </tbody>
    </table>
    </div>
</div>

</div>
</div>

<style>
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

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
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

    h3 {
        margin: 1rem 0 0.5rem;
        font-size: 1rem;
    }

    h4 {
        margin: 0.75rem 0 0.3rem;
        font-size: 0.9rem;
    }

    code {
        font-style: normal;
        user-select: all;
    }

    .empty, .meta {
        opacity: 0.7;
    }

    .empty {
        font-style: italic;
    }

    .error, .bad {
        color: var(--theme-error);
    }

    td.meta, th.meta {
        width: 1px;
        white-space: nowrap;
    }

    .dot {
        display: inline-block;
        width: 0.6em;
        height: 0.6em;
        margin-right: 0.5em;
        border-radius: 50%;
        background-color: var(--theme-slider-trim);
    }

    .dot.online {
        background-color: #3cb371;
    }

    .warning {
        margin-left: 0.4em;
        color: var(--theme-error);
    }

    .tag {
        margin-left: 0.5em;
        padding: 0.05em 0.45em;
        border-radius: 999px;
        font-size: 0.75em;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    .hub-row {
        cursor: pointer;
    }

    tr.details-row td {
        background-color: var(--theme-bg-tertiary);
    }

    .details {
        padding: 0.4rem 0.2rem;
    }

    .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem 1.2rem;
        font-size: 0.9em;
    }

    .callout {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem 1rem;
        margin-bottom: 0.75rem;
        padding: 0.6rem 0.8rem;
        border-radius: 8px;
        border: 1px solid var(--theme-highlight);
    }

    .callout-actions, .detail-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .detail-actions {
        margin-top: 0.75rem;
        justify-content: flex-end;
    }

    ul.lights, ul.activity {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.2rem;
    }

    ul.lights {
        grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    }

    ul.lights li {
        display: flex;
        align-items: center;
        gap: 0.5em;
        min-width: 0;
    }

    .light-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    ul.lights .meta {
        margin-left: auto;
        font-size: 0.85em;
        white-space: nowrap;
    }

    .swatch {
        flex: none;
        width: 0.9em;
        height: 0.9em;
        border-radius: 3px;
        border: 1px solid var(--theme-slider-trim);
    }

    .swatch.off {
        opacity: 0.3;
    }

    ul.activity {
        font-size: 0.85em;
    }

    ul.activity time {
        margin-right: 0.75em;
        opacity: 0.7;
        font-variant-numeric: tabular-nums;
    }

    .row-actions {
        width: 1px;
        white-space: nowrap;
        text-align: right;
    }

    .row-actions > * + * {
        margin-left: 0.4em;
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

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.6em;
        cursor: pointer;
    }

    button:hover:not(:disabled) {
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
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    button.remove:hover:not(:disabled) {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
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
        td.meta, th.meta {
            display: none;
        }
    }
</style>
