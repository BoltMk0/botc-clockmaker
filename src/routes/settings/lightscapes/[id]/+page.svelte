<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { arrowBackIcon, arrowForwardIcon, deleteIcon, playArrowFillIcon, saveIcon, stopFillIcon } from "$lib/icons/material.js";
    import { beforeNavigate, goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { COOLEST_KELVIN, WARMEST_KELVIN, hexToKelvin, kelvinToHex } from '@boltmk0/lightscapes/color';
    import { TIMES_OF_DAY, type TimeOfDay } from '$lib/model/client/types';
    import TimeOfDayIcon from '$lib/assets/timeOfDayIcon.svelte';
    import SceneEditor from '$lib/lighting/client/SceneEditor.svelte';
    import { bareName, catalog as makeCatalog, fetchOverview, hubAction, type LightingOverview, type PreviewRequest } from '$lib/lighting/common/api';
    import {
        COMMANDS, COMMAND_LABELS, REACTION_EVENTS, REACTION_LABELS,
        type LightingPreset, type ReactionEvent, type Spectrum, type SpectrumStop
    } from '$lib/lighting/common/lightingPreset';
    import { townSquareStops } from '$lib/lighting/common/sky';

    let { data }: { data: { preset: LightingPreset } } = $props();

    // svelte-ignore state_referenced_locally
    let preset: LightingPreset = $state(structuredClone(data.preset));
    // svelte-ignore state_referenced_locally
    let savedJson = $state(JSON.stringify(data.preset));
    const dirty = $derived(JSON.stringify(preset) !== savedJson);
    let saving = $state(false);
    let saveError = $state('');
    /** Set once it's deleted, so leaving doesn't ask about unsaved changes. */
    let leaving = false;

    let overview = $state<LightingOverview | null>(null);
    const approvedHubs = $derived(overview?.hubs.filter(h => h.status === 'approved') ?? []);
    const catalog = $derived(makeCatalog(overview?.hubs ?? []));
    /** The hub previews are shown on, and buttons learnt from. */
    let previewHubId = $state<string | null>(null);
    const previewHub = $derived(approvedHubs.find(h => h.hubId === previewHubId) ?? null);
    let message = $state('');

    const PHASE_LABELS: Record<TimeOfDay, string> = { morning: 'Morning', day: 'Day', dusk: 'Dusk', night: 'Night' };
    const PHASE_HINTS: Record<TimeOfDay, string> = {
        morning: "Once the day's timer is set up, until it's started (or while it's paused).",
        day: 'While the countdown runs.',
        dusk: 'When the countdown runs out, or the day is ended.',
        night: 'Night.'
    };
    const REACTION_HINTS: Record<ReactionEvent, string> = {
        'bell.start': 'Rings as night turns to day.',
        'bell.reminder': 'Rings when the countdown gets to the reminder time it was set up with.',
        'bell.hand': 'Rung from the remote or a button, and as the countdown runs out.',
        'sting.0': "When the mixer's first sting plays.",
        'sting.1': "When the mixer's second sting plays."
    };
    let phaseTab: TimeOfDay = $state('morning');
    let dayProgress = $state(0.5);

    /** Where each spectrum (by id) is previewed at, and what it's played through over (in seconds). */
    let spectrumAt: Record<string, number> = $state({});
    let playSeconds: Record<string, number> = $state({});
    const PLAY_SECONDS = [10, 20, 30, 60];
    /** Matches the server's: the lights fade to the first colour before it starts, and hold the last after. */
    const PLAY_LEAD_MS = 1000;
    const PLAY_HOLD_MS = 5000;
    let playing = $state<{ id: string; start: number; seconds: number } | null>(null);
    let now = $state(performance.now());

    let learning = $state(false);
    let learnMessage = $state('');

    async function refresh() {
        try {
            overview = await fetchOverview();
        } catch {
            return;
        }
        // Previews go to a hub that's online, preferring one following a game that uses this preset
        if(!previewHub?.online){
            const online = approvedHubs.filter(h => h.online);
            const usingThis = online.find(h => {
                const game = overview!.games.find(g => g.id === h.clockId);
                return game && (game.lightingPresetId ?? overview!.defaultPresetId) === preset.id;
            });
            previewHubId = (usingThis ?? online[0] ?? approvedHubs[0])?.hubId ?? null;
        }
        if(playing && !previewHub?.previewing) playing = null;
    }

    onMount(() => {
        refresh();
        const timer = setInterval(refresh, 2000);
        let frame = requestAnimationFrame(function tick() {
            now = performance.now();
            frame = requestAnimationFrame(tick);
        });
        const onUnload = (e: BeforeUnloadEvent) => { if(dirty && !leaving) e.preventDefault(); };
        window.addEventListener('beforeunload', onUnload);
        return () => {
            clearInterval(timer);
            cancelAnimationFrame(frame);
            window.removeEventListener('beforeunload', onUnload);
        };
    });

    beforeNavigate(nav => {
        if(!dirty || leaving || nav.type === 'leave') return;
        if(!confirm('Leave without saving your changes?')) nav.cancel();
    });

    // --- Saving --------------------------------------------------------------------------------------------------

    async function save() {
        saving = true;
        saveError = '';
        try {
            const res = await fetch(`/api/lightscapes/presets/${preset.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preset)
            });
            if(!res.ok) throw new Error(await res.json().then(j => j.message).catch(() => res.statusText));
            const result = await res.json();
            savedJson = JSON.stringify(result);
            preset = result;
        } catch(err) {
            saveError = (err as Error).message;
        } finally {
            saving = false;
        }
    }

    function discard() {
        preset = JSON.parse(savedJson);
        saveError = '';
    }

    async function deletePreset() {
        if(!confirm(`Delete "${preset.name}"? Games using it will use the first remaining preset. This cannot be undone.`)) return;
        const res = await fetch(`/api/lightscapes/presets/${preset.id}`, { method: 'DELETE' });
        if(!res.ok) return alert(`Failed to delete the preset (${res.status})`);
        leaving = true;
        goto('/settings/lightscapes');
    }

    // --- Previews ------------------------------------------------------------------------------------------------

    async function preview(request: PreviewRequest) {
        message = '';
        if(!previewHubId) return;
        try {
            await hubAction(previewHubId, { action: 'preview', preset: $state.snapshot(preset), request });
            await refresh();
            return true;
        } catch(err) {
            message = `Couldn't preview it: ${(err as Error).message}`;
            return false;
        }
    }

    async function endPreview() {
        if(!previewHubId) return;
        playing = null;
        await hubAction(previewHubId, { action: 'endPreview' }).catch(err => message = (err as Error).message);
        await refresh();
    }

    async function play(spectrum: Spectrum) {
        const seconds = playSeconds[spectrum.id] ?? 20;
        if(await preview({ play: spectrum.id, seconds })) playing = { id: spectrum.id, start: performance.now() + PLAY_LEAD_MS, seconds };
    }

    const playProgress = $derived(playing ? Math.min(Math.max((now - playing.start) / (playing.seconds * 1000), 0), 1) : 0);
    $effect(() => {
        if(playing && now > playing.start + playing.seconds * 1000 + PLAY_HOLD_MS) playing = null;
    });

    const canPreview = $derived(!!previewHub?.online);

    // --- Spectrums -----------------------------------------------------------------------------------------------

    function stopHex(stop: SpectrumStop): string {
        return stop.white ? kelvinToHex(stop.kelvin) : stop.hex;
    }

    function gradientCss(stops: SpectrumStop[]): string {
        if(stops.length === 0) return 'transparent';
        if(stops.length === 1) return stopHex(stops[0]);
        return `linear-gradient(to right, ${stops.map(s => `${stopHex(s)} ${s.at * 100}%`).join(', ')})`;
    }

    /** The phases' lights that follow a spectrum, as "Day: Hall, Bar". */
    function spectrumUse(spectrum: Spectrum): { phase: TimeOfDay; text: string }[] {
        return TIMES_OF_DAY.flatMap(phase => {
            const targets = preset.phases[phase]
                .filter(e => e.light.on && e.light.color?.kind === 'timeline' && e.light.color.id === spectrum.id)
                .map(e => e.target ? (catalog.lights.get(e.target)?.info.name ?? bareName(e.target)) : 'a light not picked yet');
            return targets.length ? [{ phase, text: `${PHASE_LABELS[phase]}: ${targets.join(', ')}` }] : [];
        });
    }

    function addSpectrum() {
        const names = new Set(preset.spectrums.map(s => s.name));
        let n = preset.spectrums.length + 1;
        while(names.has(`Spectrum ${n}`)) n++;
        preset.spectrums.push({
            // Not crypto.randomUUID(): the page may not be served securely
            id: Math.random().toString(36).slice(2, 10),
            name: `Spectrum ${n}`,
            stops: [{ at: 0, white: true, kelvin: 2700, hex: kelvinToHex(2700), brightness: 1 }],
            stepSeconds: 10
        });
    }

    function removeSpectrum(spectrum: Spectrum) {
        const use = spectrumUse(spectrum);
        if(use.length && !confirm(`Delete ${spectrum.name}? The lights following it will keep their colour instead.\n\n${use.map(u => u.text).join('\n')}`)) return;
        preset.spectrums = preset.spectrums.filter(s => s.id !== spectrum.id);
        for(const phase of TIMES_OF_DAY){
            for(const entry of preset.phases[phase]){
                if(entry.light.color?.kind === 'timeline' && entry.light.color.id === spectrum.id) delete entry.light.color;
            }
        }
    }

    function sortStops(spectrum: Spectrum) {
        spectrum.stops.sort((a, b) => a.at - b.at);
    }

    /** Halfway along the widest gap, in the colour nearest it. */
    function addStop(spectrum: Spectrum) {
        const stops = spectrum.stops;
        const points = [0, ...stops.map(s => s.at), 1];
        let at = 0.5, widest = -1;
        for(let i = 0; i < points.length - 1; i++){
            if(points[i + 1] - points[i] > widest){
                widest = points[i + 1] - points[i];
                at = (points[i] + points[i + 1]) / 2;
            }
        }
        const near = stops.reduce<SpectrumStop | null>((best, s) => !best || Math.abs(s.at - at) < Math.abs(best.at - at) ? s : best, null);
        stops.push({ ...(near ?? { white: true, kelvin: 2700, hex: kelvinToHex(2700), brightness: 1 }), at: Math.round(at * 1000) / 1000 });
        sortStops(spectrum);
    }

    function setStopWhite(stop: SpectrumStop, white: boolean) {
        stop.white = white;
        // Starting from the white nearest the colour, and back to the colour it had
        if(white) stop.kelvin = hexToKelvin(stop.hex);
    }

    function useSky(spectrum: Spectrum) {
        if(!confirm("Replace these colours with the town square's sky?")) return;
        spectrum.stops = townSquareStops();
    }

    // --- Buttons -------------------------------------------------------------------------------------------------

    const inputs = $derived([...catalog.inputs.values()].sort((a, b) => a.info.name.localeCompare(b.info.name)));

    async function learn() {
        if(!previewHubId) return;
        learning = true;
        learnMessage = '';
        try {
            const { press } = await hubAction<{ press: { device: string; action: string } | null }>(previewHubId, { action: 'learn' });
            if(!press) learnMessage = 'Nothing was pressed.';
            else {
                const name = catalog.inputs.get(press.device)?.info.name ?? bareName(press.device);
                if(preset.buttons.some(b => b.device === press.device && b.action === press.action)) learnMessage = `${name} (${press.action}) is already bound.`;
                else {
                    preset.buttons.push({ device: press.device, action: press.action, command: 'day' });
                    learnMessage = `Added ${name} (${press.action}): pick what it does.`;
                }
            }
        } catch(err) {
            learnMessage = (err as Error).message;
        }
        learning = false;
    }
</script>

<div class="scroll">
<div class="main">
    <a class="back" href="/settings/lightscapes"><MaterialIcon icon={arrowBackIcon} size="1.2em"/> Lightscapes</a>

    <div class="panel">
        <h2>General</h2>
        <div class="fields">
            <label>Preset name <input type="text" bind:value={preset.name} placeholder="Name"/></label>
            <label>Fade between phases over
                <span class="inline"><input class="number" type="number" min="0" max="60" step="0.5" bind:value={preset.fadeSeconds}/> seconds</span>
            </label>
        </div>
    </div>

    <div class="panel">
        <h2>Phases</h2>
        <p class="hint">What the lights are set to in each phase of the game.</p>
        <div class="tabs" role="tablist">
            {#each TIMES_OF_DAY as phase (phase)}
                <button role="tab" class="tab" class:active={phase === phaseTab} aria-selected={phase === phaseTab} onclick={() => phaseTab = phase}>
                    <TimeOfDayIcon timeOfDay={phase} size={18}/>{PHASE_LABELS[phase]}
                </button>
            {/each}
        </div>
        <p class="hint">{PHASE_HINTS[phaseTab]}</p>
        {#key phaseTab}
            <SceneEditor bind:entries={preset.phases[phaseTab]} {catalog} spectrums={preset.spectrums} phase={phaseTab} hubCount={approvedHubs.length}/>
        {/key}
        <div class="row">
            {#if phaseTab === 'day'}
                <label class="inline">At
                    <input type="range" min="0" max="100" value={dayProgress * 100} oninput={e => dayProgress = e.currentTarget.valueAsNumber / 100}/>
                    <span class="value">{Math.round(dayProgress * 100)}%</span>
                </label>
            {/if}
            <button disabled={!canPreview} onclick={() => preview({ phase: phaseTab, progress: phaseTab === 'day' ? dayProgress : undefined })}>
                Preview {PHASE_LABELS[phaseTab].toLowerCase()}
            </button>
        </div>
    </div>

    <div class="panel">
        <h2>Spectrums</h2>
        <p class="hint">
            Colours that lights can follow in a phase, picked as the light's colour. They fade through them as the day's
            countdown runs, like the town square's sky: from dawn at the start to the night sky as it runs out. In the
            morning they show the first colour, and at dusk and night the last.
        </p>
        {#each preset.spectrums as spectrum (spectrum.id)}
            {@const use = spectrumUse(spectrum)}
            {@const usedInDay = use.some(u => u.phase === 'day')}
            {@const isPlaying = playing?.id === spectrum.id}
            <div class="card">
                <div class="row">
                    <input class="name" type="text" bind:value={spectrum.name} aria-label="Spectrum name"/>
                    <span class="spacer"></span>
                    <button class="remove" onclick={() => removeSpectrum(spectrum)} aria-label="Delete spectrum" title="Delete spectrum"><MaterialIcon icon={deleteIcon} size="1.25em"/></button>
                </div>
                <p class="hint small">{use.length ? `Followed in ${use.map(u => u.text).join(' · ')}` : "Not followed yet: pick it as a light's colour in a phase."}</p>
                <div class="gradient" style:background={gradientCss(spectrum.stops)}>
                    {#each spectrum.stops as stop, i (i)}<span class="tick" style:left="{stop.at * 100}%"></span>{/each}
                    {#if isPlaying}<span class="play-marker" style:left="{playProgress * 100}%"></span>{/if}
                </div>

                <div class="data-table-scroll">
                <table class="data-table stops">
                    <tbody>
                        <tr><th>At</th><th>Colour</th><th>Brightness</th><th></th></tr>
                        {#each spectrum.stops as stop, i (i)}
                            <tr>
                                <td class="nowrap">
                                    <input class="number" type="number" min="0" max="100" step="1" value={Math.round(stop.at * 1000) / 10}
                                        onchange={e => { stop.at = Math.min(Math.max(e.currentTarget.valueAsNumber || 0, 0), 100) / 100; sortStops(spectrum); }}/> %
                                </td>
                                <td>
                                    <span class="inline">
                                        <select value={stop.white ? 'white' : 'rgb'} title="White uses the bulbs' white light" onchange={e => setStopWhite(stop, e.currentTarget.value === 'white')}>
                                            <option value="white">White</option>
                                            <option value="rgb">Colour</option>
                                        </select>
                                        {#if stop.white}
                                            <span class="swatch" style:background={stopHex(stop)}></span>
                                            <input type="range" min={WARMEST_KELVIN} max={COOLEST_KELVIN} step="50" value={stop.kelvin} title="Warm to cool"
                                                oninput={e => stop.kelvin = e.currentTarget.valueAsNumber}/>
                                            <span class="value">{stop.kelvin}K</span>
                                        {:else}
                                            <input type="color" value={stop.hex} oninput={e => stop.hex = e.currentTarget.value}/>
                                        {/if}
                                    </span>
                                </td>
                                <td>
                                    <span class="inline">
                                        <input type="range" min="1" max="100" value={Math.round(stop.brightness * 100)}
                                            oninput={e => stop.brightness = e.currentTarget.valueAsNumber / 100}/>
                                        <span class="value">{Math.round(stop.brightness * 100)}%</span>
                                    </span>
                                </td>
                                <td class="row-actions">
                                    <!-- A spectrum needs a colour -->
                                    <button class="icon" title="Remove" aria-label="Remove" disabled={spectrum.stops.length === 1} onclick={() => spectrum.stops.splice(i, 1)}>×</button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
                </div>
                <div class="row">
                    <button onclick={() => addStop(spectrum)}>+ Add a colour</button>
                    <button onclick={() => useSky(spectrum)}>Use the town square's sky</button>
                </div>

                <label class="inline step">Move the lights along every
                    <input class="number" type="number" min="1" max="300" step="1" bind:value={spectrum.stepSeconds}/> seconds
                </label>
                <p class="hint small">The lights fade from one step to the next. Every few seconds is smooth without flooding the Zigbee network.</p>

                <div class="row">
                    <label class="inline">Preview the day at
                        <input type="range" min="0" max="100" disabled={!usedInDay} value={(spectrumAt[spectrum.id] ?? 0.5) * 100}
                            oninput={e => spectrumAt[spectrum.id] = e.currentTarget.valueAsNumber / 100}
                            onchange={() => canPreview && preview({ phase: 'day', progress: spectrumAt[spectrum.id] })}/>
                        <span class="value">{Math.round((spectrumAt[spectrum.id] ?? 0.5) * 100)}%</span>
                    </label>
                    <button disabled={!usedInDay || !canPreview} title={usedInDay ? undefined : 'No light follows it in the day'}
                        onclick={() => preview({ phase: 'day', progress: spectrumAt[spectrum.id] ?? 0.5 })}>Preview</button>
                </div>
                <div class="row">
                    <label class="inline">Play it through over
                        <select value={playSeconds[spectrum.id] ?? 20} onchange={e => playSeconds[spectrum.id] = Number(e.currentTarget.value)}>
                            {#each PLAY_SECONDS as n (n)}<option value={n}>{n} seconds</option>{/each}
                        </select>
                    </label>
                    <button disabled={use.length === 0 || !canPreview} title={use.length ? undefined : 'No light follows it'}
                        onclick={() => isPlaying ? endPreview() : play(spectrum)}>{#if isPlaying}<MaterialIcon icon={stopFillIcon} size="1.2em"/> Stop{:else}<MaterialIcon icon={playArrowFillIcon} size="1.2em"/> Play{/if}</button>
                </div>
            </div>
        {/each}
        <button class="add" onclick={addSpectrum}>+ Add a spectrum</button>
    </div>

    <div class="panel">
        <h2>Reactions</h2>
        <p class="hint">Lights to change to when a bell rings or a sting plays, fading to them and holding them for a moment before fading back to the phase's.</p>
        {#each REACTION_EVENTS as event (event)}
            {@const reaction = preset.reactions[event]}
            <div class="card">
                <div class="row">
                    <div>
                        <h3>{REACTION_LABELS[event]}</h3>
                        <span class="hint small">{REACTION_HINTS[event]}</span>
                    </div>
                    <span class="spacer"></span>
                    <label class="inline" title="How long the lights take to change to these, and back">Fade over
                        <input class="number" type="number" min="0" max="5" step="0.1" bind:value={reaction.fadeSeconds}/> s
                    </label>
                    <label class="inline">Hold for
                        <input class="number" type="number" min="0" max="120" step="0.5" bind:value={reaction.holdSeconds}/> s
                    </label>
                    <button disabled={reaction.entries.length === 0 || !canPreview} onclick={() => preview({ reaction: event })}>Test</button>
                </div>
                <SceneEditor bind:entries={reaction.entries} {catalog} effects hubCount={approvedHubs.length}/>
            </div>
        {/each}
    </div>

    <div class="panel">
        <h2>Buttons</h2>
        <p class="hint">Buttons on a hub as a clock remote, for the games using this preset. Pair them with the hub first (in Zigbee2MQTT).</p>
        <div class="bindings">
            {#if preset.buttons.length === 0}<div class="empty">No buttons bound.</div>{/if}
            {#each preset.buttons as binding, i (i)}
                {@const input = catalog.inputs.get(binding.device)}
                {@const actions = input?.info.actions ?? []}
                <div class="binding">
                    <select bind:value={binding.device} class:missing={binding.device && !input}>
                        <option value="">Pick a button…</option>
                        {#if binding.device && !input}<option value={binding.device}>{bareName(binding.device)} (not on any hub)</option>{/if}
                        {#each inputs as entry (entry.info.id)}
                            <option value={entry.info.id}>{entry.info.name}{approvedHubs.length > 1 ? ` (${entry.hubs.join(', ')})` : ''}</option>
                        {/each}
                    </select>
                    {#if actions.length}
                        <select bind:value={binding.action}>
                            <option value="">Pick an action…</option>
                            {#if binding.action && !actions.includes(binding.action)}<option value={binding.action}>{binding.action}</option>{/if}
                            {#each actions as action (action)}<option value={action}>{action}</option>{/each}
                        </select>
                    {:else}
                        <input type="text" placeholder="Action, e.g. single" bind:value={binding.action}/>
                    {/if}
                    <span><MaterialIcon icon={arrowForwardIcon} size="1.2em"/></span>
                    <select bind:value={binding.command}>
                        {#each COMMANDS as command (command)}<option value={command}>{COMMAND_LABELS[command]}</option>{/each}
                    </select>
                    <span class="spacer"></span>
                    <button class="icon" title="Remove" aria-label="Remove" onclick={() => preset.buttons.splice(i, 1)}>×</button>
                </div>
            {/each}
        </div>
        <div class="row">
            <button disabled={learning || !canPreview} onclick={learn}>{learning ? 'Press the button now…' : `Learn a button${previewHub ? ` on ${previewHub.name}` : ''}`}</button>
            <button onclick={() => preset.buttons.push({ device: '', action: '', command: 'day' })}>+ Add by hand</button>
        </div>
        {#if learnMessage}<p class="hint">{learnMessage}</p>{/if}
        <p class="hint small">While learning, the next press on the hub is taken as the button to bind, not acted on.</p>
    </div>

    <div class="panel">
        <button class="remove wide" onclick={deletePreset} aria-label="Delete this preset" title="Delete this preset"><MaterialIcon icon={deleteIcon} size="1.25em"/></button>
    </div>
</div>
</div>

<div class="bar">
    <div class="bar-preview">
        {#if approvedHubs.length === 0}
            <span class="hint">Approve a hub to preview on.</span>
        {:else}
            <label class="inline">Preview on
                <select bind:value={previewHubId}>
                    {#each approvedHubs as hub (hub.hubId)}<option value={hub.hubId}>{hub.name}{hub.online ? '' : ' (offline)'}</option>{/each}
                </select>
            </label>
            {#if previewHub?.previewing}
                <span>Previewing {previewHub.previewing}</span>
                <button onclick={endPreview}>Back to the game</button>
            {/if}
        {/if}
        {#if message}<span class="error">{message}</span>{/if}
    </div>
    {#if dirty || saveError}
        <div class="bar-save">
            {#if saveError}<span class="error">{saveError}</span>{:else}<span class="hint">Unsaved changes</span>{/if}
            <button onclick={discard} disabled={saving}>Discard</button>
            <button class="save" onclick={save} disabled={saving}><MaterialIcon icon={saveIcon} size="1.2em"/> {saving ? 'Saving…' : 'Save'}</button>
        </div>
    {/if}
</div>

<style>
    .scroll {
        height: 100%;
        overflow-y: auto;
        padding-bottom: 4.5rem;
        box-sizing: border-box;
    }

    .main {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: auto;
        padding: 1.5rem;
        box-sizing: border-box;
        width: 100%;
        max-width: 64rem;
        color: var(--theme-on-bg);
    }

    .back {
        color: var(--theme-on-bg-secondary);
        text-decoration: none;
    }

    .back:hover {
        color: var(--theme-highlight);
    }

    .panel {
        background-color: var(--theme-bg-secondary);
        padding: 1.25rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 16px var(--theme-shadow);
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    h2 {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--theme-on-bg-secondary);
    }

    h3 {
        margin: 0;
        font-size: 1rem;
    }

    .hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--theme-on-bg-secondary);
    }

    .hint.small {
        font-size: 0.8rem;
        font-style: italic;
    }

    .empty {
        font-style: italic;
        opacity: 0.7;
    }

    .error {
        color: var(--theme-error);
    }

    .fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 0.75rem 1.5rem;
    }

    .fields label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem 0.75rem;
    }

    .inline {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4em;
    }

    .spacer {
        flex: 1;
    }

    .nowrap {
        white-space: nowrap;
    }

    .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .tab {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
    }

    .tab.active {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    /* Coloured like the table rows, so it doesn't match the panel it sits on */
    .card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 0.9rem 1rem;
        border-radius: 10px;
        background-color: color-mix(in srgb, var(--theme-bg) 50%, var(--theme-bg-secondary));
    }

    input.name {
        font-size: 1.05rem;
        font-weight: 600;
        min-width: 12rem;
    }

    .gradient {
        position: relative;
        height: 2rem;
        border-radius: 6px;
        border: 1px solid var(--theme-slider-trim);
    }

    .tick {
        position: absolute;
        bottom: -1px;
        width: 2px;
        height: 0.5rem;
        margin-left: -1px;
        background-color: var(--theme-on-bg);
        opacity: 0.7;
    }

    .play-marker {
        position: absolute;
        top: -0.25rem;
        bottom: -0.25rem;
        width: 3px;
        margin-left: -1.5px;
        border-radius: 2px;
        background-color: var(--theme-on-bg);
        box-shadow: 0 0 4px var(--theme-shadow);
    }

    .swatch {
        display: inline-block;
        width: 1.2rem;
        height: 1.2rem;
        border-radius: 4px;
        border: 1px solid var(--theme-slider-trim);
    }

    .value {
        min-width: 3.2em;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
    }

    .step {
        margin-top: 0.3rem;
    }

    .stops th {
        text-align: left;
    }

    .row-actions {
        width: 1px;
        text-align: right;
    }

    .bindings {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .binding {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 0.75rem;
        padding: 0.5rem 0.6rem;
        border-radius: 8px;
        background-color: var(--theme-bg);
    }

    .missing {
        border-color: var(--theme-error) !important;
    }

    input, select, button {
        box-sizing: border-box;
        padding: 0.35rem 0.55rem;
        border: 1px solid var(--theme-slider-trim);
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    input:focus, select:focus {
        outline: none;
        border-color: var(--theme-highlight);
    }

    input[type=range] {
        width: 8rem;
        padding: 0;
        border: none;
        background: transparent;
        accent-color: var(--theme-highlight);
    }

    input[type=color] {
        width: 3rem;
        height: 1.9rem;
        padding: 0.1em;
    }

    input.number {
        width: 5em;
    }

    button {
        cursor: pointer;
    }

    button:hover:not(:disabled) {
        border-color: var(--theme-highlight);
    }

    button:disabled, input:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    button.icon {
        padding: 0.1em 0.5em;
        font-size: 1.1em;
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

    button.remove:hover:not(:disabled), button.icon:hover:not(:disabled) {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    button.wide {
        width: 100%;
    }

    .bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem 1rem;
        padding: 0.6rem 1.25rem;
        background-color: var(--theme-bg-secondary);
        border-top: 1px solid var(--theme-bg-tertiary);
        box-shadow: 0 -4px 16px var(--theme-shadow);
        z-index: 10;
    }

    .bar-preview, .bar-save {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem 0.75rem;
    }

    .bar-save {
        margin-left: auto;
    }

    @media (max-width: 560px) {
        .main {
            padding: 0.75rem;
        }
        .panel {
            padding: 1rem;
        }
    }
</style>
