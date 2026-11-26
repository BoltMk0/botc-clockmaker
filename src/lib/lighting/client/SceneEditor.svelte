<script lang="ts">
    import type { LightInfo, SceneEntry } from '@boltmk0/lightscapes/protocol';
    import { COOLEST_KELVIN, WARMEST_KELVIN, hexToKelvin, kelvinToHex, shownHex } from '@boltmk0/lightscapes/color';
    import type { TimeOfDay } from '$lib/model/client/types';
    import { bareName, type Catalog } from '$lib/lighting/common/api';
    import type { Spectrum, SpectrumStop } from '$lib/lighting/common/lightingPreset';

    let {
        entries = $bindable(),
        catalog,
        spectrums = null,
        phase = null,
        effects = false,
        hubCount = 1
    }: {
        entries: SceneEntry[];
        catalog: Catalog;
        /** The spectrums its lights can follow, or null where they can't (only a phase's can). */
        spectrums?: Spectrum[] | null;
        /** The phase it's for, for how a spectrum shows in it. */
        phase?: TimeOfDay | null;
        /** Whether to offer effects (e.g. blink) for every light, rather than only those that have one. */
        effects?: boolean;
        /** How many hubs there are, so a light is labelled with its hub's name when there's more than one. */
        hubCount?: number;
    } = $props();

    /** Effects offered when a light doesn't say which it has: Zigbee2MQTT's usual ones. */
    const DEFAULT_EFFECTS = ['blink', 'breathe', 'okay', 'channel_change', 'finish_effect', 'stop_effect'];

    const lights = $derived([...catalog.lights.values()].sort((a, b) => a.info.name.localeCompare(b.info.name)));
    const groups = $derived(lights.filter(l => l.info.kind === 'group'));
    const devices = $derived(lights.filter(l => l.info.kind === 'device'));

    function label(entry: { info: LightInfo; hubs: string[] }): string {
        return hubCount > 1 ? `${entry.info.name} (${entry.hubs.join(', ')})` : entry.info.name;
    }

    function effectLabel(effect: string): string {
        const words = effect.replace(/_/g, ' ');
        return words.charAt(0).toUpperCase() + words.slice(1);
    }

    function colourMode(entry: SceneEntry): string {
        const color = entry.light.color;
        if(!color) return 'keep';
        return color.kind === 'timeline' ? `spectrum:${color.id}` : color.kind;
    }

    function setColourMode(entry: SceneEntry, mode: string) {
        const light = entry.light;
        const was = light.color;
        if(mode === 'keep') delete light.color;
        else if(mode === 'rgb') light.color = { kind: 'rgb', hex: was?.kind === 'white' ? kelvinToHex(was.kelvin) : '#ffb46b' };
        else if(mode === 'white') light.color = { kind: 'white', kelvin: was?.kind === 'rgb' ? hexToKelvin(was.hex) : 2700 };
        else {
            light.color = { kind: 'timeline', id: mode.slice('spectrum:'.length) };
            // Following a spectrum, its brightness is how much of the spectrum's own it shows: all of it, to start
            delete light.brightness;
        }
    }

    function setOn(entry: SceneEntry, on: boolean) {
        entry.light.on = on;
        if(!on){
            delete entry.light.brightness;
            delete entry.light.color;
            delete entry.light.effect;
        }
    }

    function stopHex(stop: SpectrumStop): string {
        return stop.white ? kelvinToHex(stop.kelvin) : stop.hex;
    }

    /** How a spectrum shows in this phase: through the day it moves along it; the morning has its first colour, dusk and night its last. */
    function spectrumCss(spectrum: Spectrum): string {
        const stops = spectrum.stops;
        if(stops.length === 0) return 'transparent';
        if(phase !== 'day') return stopHex(phase === 'morning' ? stops[0] : stops[stops.length - 1]);
        if(stops.length === 1) return stopHex(stops[0]);
        return `linear-gradient(to right, ${stops.map(s => `${stopHex(s)} ${s.at * 100}%`).join(', ')})`;
    }

    /** What the light can't do of what it's set to, if anything. */
    function capsNote(entry: SceneEntry): string | null {
        const info = catalog.lights.get(entry.target)?.info;
        const color = entry.light.color;
        if(!info || !entry.light.on || !color) return null;
        const { caps } = info;
        if(!caps.color && !caps.white) return "It doesn't do colours or whites";
        if(color.kind === 'rgb' && !caps.color) return "It doesn't do colours: it shows the nearest white";
        if(color.kind === 'white' && !caps.white) return "It doesn't do whites: it shows one as a colour";
        if(color.kind === 'white' && caps.white && (color.kelvin < caps.white.minKelvin || color.kelvin > caps.white.maxKelvin)) {
            return `Its whites go from ${caps.white.minKelvin}K to ${caps.white.maxKelvin}K`;
        }
        return null;
    }

    function effectsFor(entry: SceneEntry): string[] {
        const known = catalog.lights.get(entry.target)?.info.caps.effects;
        return known && known.length ? known : DEFAULT_EFFECTS;
    }

    function add() {
        entries.push({ target: '', light: { on: true, brightness: 1 } });
    }
</script>

<div class="entries">
    {#if entries.length === 0}
        <div class="empty">No lights: they're left as they are.</div>
    {/if}
    {#each entries as entry, i (i)}
        {@const light = entry.light}
        {@const known = catalog.lights.has(entry.target)}
        {@const spectrum = light.color?.kind === 'timeline' ? spectrums?.find(s => s.id === (light.color as { id: string }).id) : undefined}
        {@const note = capsNote(entry)}
        <div class="entry">
            <select class="target" bind:value={entry.target} class:missing={entry.target && !known}>
                <option value="">Pick a light or group…</option>
                {#if entry.target && !known}
                    <option value={entry.target}>{bareName(entry.target)} (not on any hub)</option>
                {/if}
                {#if groups.length}
                    <optgroup label="Groups">
                        {#each groups as g (g.info.id)}<option value={g.info.id}>{label(g)}</option>{/each}
                    </optgroup>
                {/if}
                {#if devices.length}
                    <optgroup label="Lights">
                        {#each devices as d (d.info.id)}<option value={d.info.id}>{label(d)}</option>{/each}
                    </optgroup>
                {/if}
            </select>

            <select value={light.on ? 'on' : 'off'} onchange={e => setOn(entry, e.currentTarget.value === 'on')}>
                <option value="on">On</option>
                <option value="off">Off</option>
            </select>

            {#if light.on}
                {#if !spectrum}
                    <label class="inline" title="Brightness (leave unticked to keep it as it is)">
                        <input type="checkbox" checked={light.brightness !== undefined}
                            onchange={e => { if(e.currentTarget.checked) light.brightness = 1; else delete light.brightness; }}/>
                        Brightness
                        {#if light.brightness !== undefined}
                            <input type="range" min="1" max="100" value={Math.round(light.brightness * 100)}
                                oninput={e => light.brightness = e.currentTarget.valueAsNumber / 100}/>
                            <span class="value">{Math.round(light.brightness * 100)}%</span>
                        {/if}
                    </label>
                {/if}

                <select title="Colour" value={colourMode(entry)} onchange={e => setColourMode(entry, e.currentTarget.value)}>
                    <option value="keep">Keep colour</option>
                    <option value="rgb">Colour</option>
                    <option value="white">White</option>
                    {#if spectrums?.length}
                        <optgroup label="Spectrums">
                            {#each spectrums as s (s.id)}<option value="spectrum:{s.id}">{s.name}</option>{/each}
                        </optgroup>
                    {/if}
                    {#if light.color?.kind === 'timeline' && !spectrum}
                        <option value={colourMode(entry)}>A deleted spectrum</option>
                    {/if}
                </select>

                {#if spectrum}
                    <span class="swatch" title={spectrum.name} style:background={spectrumCss(spectrum)}></span>
                    <label class="inline" title="How much of the spectrum's own brightness this light shows">
                        Brightness
                        <input type="range" min="1" max="100" value={Math.round((light.brightness ?? 1) * 100)}
                            oninput={e => light.brightness = e.currentTarget.valueAsNumber / 100}/>
                        <span class="value">{Math.round((light.brightness ?? 1) * 100)}%</span>
                    </label>
                {:else if light.color?.kind === 'rgb'}
                    <input type="color" value={light.color.hex}
                        oninput={e => light.color = { kind: 'rgb', hex: e.currentTarget.value }}/>
                {:else if light.color?.kind === 'white'}
                    <span class="inline" title="Colour temperature: warm to cool">
                        <span class="swatch" style:background={shownHex(light.color)}></span>
                        <input type="range" min={WARMEST_KELVIN} max={COOLEST_KELVIN} step="50" value={light.color.kelvin}
                            oninput={e => light.color = { kind: 'white', kelvin: e.currentTarget.valueAsNumber }}/>
                        <span class="value">{light.color.kelvin}K</span>
                    </span>
                {/if}

                {#if effects || light.effect}
                    <select title="Effect" value={light.effect ?? ''}
                        onchange={e => { if(e.currentTarget.value) light.effect = e.currentTarget.value; else delete light.effect; }}>
                        <option value="">No effect</option>
                        {#each effectsFor(entry) as effect (effect)}<option value={effect}>{effectLabel(effect)}</option>{/each}
                        {#if light.effect && !effectsFor(entry).includes(light.effect)}<option value={light.effect}>{effectLabel(light.effect)}</option>{/if}
                    </select>
                {/if}

                {#if note}<span class="note">{note}</span>{/if}
            {/if}

            <span class="spacer"></span>
            <button class="icon" title="Remove" aria-label="Remove" onclick={() => entries.splice(i, 1)}>×</button>
        </div>
    {/each}
</div>
<button class="add" onclick={add}>+ Add a light</button>

<style>
    .entries {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-bottom: 0.5rem;
    }

    .entry {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 0.75rem;
        padding: 0.5rem 0.6rem;
        border-radius: 8px;
        background-color: var(--theme-bg);
    }

    .empty {
        font-style: italic;
        opacity: 0.7;
    }

    select.target {
        min-width: 12rem;
        max-width: 100%;
    }

    select.missing {
        border-color: var(--theme-error);
    }

    .inline {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
    }

    input[type=range] {
        width: 8rem;
        accent-color: var(--theme-highlight);
    }

    .value {
        min-width: 3.2em;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
    }

    .swatch {
        display: inline-block;
        width: 3rem;
        height: 1.2rem;
        border-radius: 4px;
        border: 1px solid var(--theme-slider-trim);
    }

    .inline .swatch {
        width: 1.2rem;
    }

    .note {
        font-size: 0.85em;
        font-style: italic;
        color: var(--theme-error);
    }

    .spacer {
        flex: 1;
    }

    select, input[type=color], button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input[type=color] {
        width: 3rem;
        height: 1.9rem;
        padding: 0.1em;
    }

    button {
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button.icon {
        padding: 0.1em 0.5em;
        font-size: 1.1em;
    }

    button.icon:hover {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    button.add {
        width: 100%;
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }
</style>
