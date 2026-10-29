<script lang="ts">
    import { onDestroy, untrack } from "svelte";
    import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
    import type { LightOverride } from "$lib/model/common/ClocktowerClockModel";
    import { COOLEST, WARMEST, miredsToHex } from "./lighting";

    /**
     * The remote's lighting view: sets every light Lightscapes sets to one colour (or white) and brightness, in place of
     * following the game, until it's ended.
     */
    let { model, onback }: { model: Clocktower; onback: () => void } = $props();

    /** While overridden, changes are sent at most this often (and the last as the slider's let go), not to crowd the Zigbee network. */
    const SEND_EVERY_MS = 400;
    /** The override as another remote changes it is shown, except for this long after a change here, so echoes don't fight the sliders. */
    const LOCAL_EDIT_HOLD_MS = 1000;
    const WARMEST_K = Math.round(1_000_000 / WARMEST / 100) * 100;
    const COOLEST_K = Math.round(1_000_000 / COOLEST / 100) * 100;
    const COLOURS = ['#ff2a1a', '#ff7a00', '#ffb000', '#2ad44a', '#00c8b4', '#2a5cff', '#5a2aff', '#a02aff', '#ff2a9a'];

    const overridden = $derived(model.lightOverride !== undefined);

    // What's picked: the override's, or (before there is one) a warm white
    let kind: 'temp' | 'rgb' = $state('temp');
    let kelvin = $state(2700);
    let hex = $state('#ff7a00');
    let percent = $state(80);
    let editedAt = 0;

    $effect(() => {
        const override = model.lightOverride;
        if (!override || Date.now() - editedAt < LOCAL_EDIT_HOLD_MS) return;
        untrack(() => {
            kind = override.color.kind;
            if (override.color.kind === 'temp') kelvin = Math.round(1_000_000 / override.color.mireds / 100) * 100;
            else hex = override.color.hex;
            percent = Math.max(1, Math.round(override.brightness / 2.54));
        });
    });

    const mireds = $derived(Math.round(1_000_000 / kelvin));
    const shownHex = $derived(kind === 'temp' ? miredsToHex(mireds) : hex);
    // The white slider runs from warm to cool, in the whites the lights show
    const whiteGradient = $derived.by(() => {
        const stops = [];
        for (let k = WARMEST_K; k <= COOLEST_K; k += 500) stops.push(miredsToHex(1_000_000 / k));
        return `linear-gradient(to right, ${stops.join(', ')})`;
    });

    function picked(): LightOverride {
        return {
            color: kind === 'temp' ? { kind: 'temp', mireds } : { kind: 'rgb', hex },
            brightness: Math.max(1, Math.round(percent * 2.54))
        };
    }

    let error: string | null = $state(null);
    let errorTimeout: ReturnType<typeof setTimeout> | null = null;

    async function send(override: LightOverride | null, failure: string) {
        try {
            const response = await fetch(`/api/clock/${model.id}/lightOverride`, {
                method: 'POST',
                body: JSON.stringify({ override }),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
        } catch (e) {
            console.error(failure, e);
            error = failure;
            if (errorTimeout) clearTimeout(errorTimeout);
            errorTimeout = setTimeout(() => error = null, 4000);
        }
    }

    let sendTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSentAt = 0;

    function cancelSend() {
        if (sendTimer !== null) clearTimeout(sendTimer);
        sendTimer = null;
    }

    function sendNow() {
        cancelSend();
        lastSentAt = Date.now();
        send(picked(), "Couldn't change the lights");
    }

    /** Something's been picked: sent on, if the lights are overridden, at most every SEND_EVERY_MS. */
    function changed() {
        editedAt = Date.now();
        if (!overridden || sendTimer !== null) return;
        sendTimer = setTimeout(sendNow, Math.max(0, lastSentAt + SEND_EVERY_MS - Date.now()));
    }

    /** A slider's let go of (or a colour picked): sent now, rather than waiting its turn. */
    function settled() {
        editedAt = Date.now();
        if (overridden) sendNow();
    }

    function pickKind(k: 'temp' | 'rgb') {
        if (kind === k) return;
        kind = k;
        settled();
    }

    function pickColour(c: string) {
        hex = c;
        settled();
    }

    function override() {
        cancelSend();
        editedAt = Date.now();
        send(picked(), "Couldn't override the lights");
    }

    function endOverride() {
        cancelSend();
        send(null, "Couldn't go back to the game");
    }

    // Don't lose the last change
    onDestroy(() => {
        if (sendTimer !== null) sendNow();
    });
</script>

<div class="lighting-view">
    <div class="header">
        <button class="back" onclick={onback}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
            Clock
        </button>
        <span class="state" class:on={overridden}>{overridden ? 'Overridden' : 'Following the game'}</span>
    </div>

    <div class="swatch" style="background-color: {shownHex}; filter: brightness({0.25 + 0.75 * percent / 100});"></div>

    <p class="about">
        {#if overridden}
        Every light Lightscapes sets is showing this, and changes as you change it. They don't follow the game, or
        flash for the bells, until you go back to it.
        {:else}
        Set every light Lightscapes sets to one white or colour. They don't follow the game, or flash for the bells,
        until you go back to it.
        {/if}
    </p>

    <div class="kinds" role="radiogroup" aria-label="White or colour">
        <button role="radio" aria-checked={kind === 'temp'} class:active={kind === 'temp'} onclick={() => pickKind('temp')}>White</button>
        <button role="radio" aria-checked={kind === 'rgb'} class:active={kind === 'rgb'} onclick={() => pickKind('rgb')}>Colour</button>
    </div>

    {#if kind === 'temp'}
    <label class="slider">
        <span class="slider-label"><span>Warmth</span><span>{kelvin} K</span></span>
        <input type="range" class="white-range" min={WARMEST_K} max={COOLEST_K} step="100" bind:value={kelvin}
            style="background: {whiteGradient};" oninput={changed} onchange={settled}/>
        <span class="ends"><span>Warm</span><span>Cool</span></span>
    </label>
    {:else}
    <div class="colours">
        {#each COLOURS as c}
        <button class="colour" class:active={hex === c} style="background-color: {c};" onclick={() => pickColour(c)} aria-label="Colour {c}"></button>
        {/each}
        <label class="colour custom" class:active={!COLOURS.includes(hex)} title="Any colour">
            <input type="color" bind:value={hex} oninput={changed} onchange={settled} aria-label="Any colour"/>
        </label>
    </div>
    {/if}

    <label class="slider">
        <span class="slider-label"><span>Brightness</span><span>{percent}%</span></span>
        <input type="range" min="1" max="100" bind:value={percent} oninput={changed} onchange={settled}/>
    </label>

    {#if overridden}
    <button class="main-btn end" onclick={endOverride}>Back to the game</button>
    {:else}
    <button class="main-btn" onclick={override}>Override the lights</button>
    {/if}

    {#if error}<div class="error" role="alert">{error}</div>{/if}
</div>

<style>
    .lighting-view {
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

    .back {
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

    .back:hover {
        background: rgba(255, 255, 255, 0.08);
        opacity: 1;
    }

    .state {
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        font-size: 0.7em;
        opacity: 0.8;
    }

    .state.on {
        background: #e0a030;
        color: #222;
        opacity: 1;
        font-weight: 600;
    }

    .swatch {
        height: 90px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        transition: background-color 0.3s, filter 0.3s;
    }

    .about {
        margin: 0;
        font-size: 0.75em;
        opacity: 0.7;
        text-align: center;
    }

    .kinds {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px;
        padding: 4px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
    }

    .kinds button {
        padding: 8px 0;
        border: none;
        border-radius: 7px;
        background: none;
        color: inherit;
        font: inherit;
        font-size: 0.85em;
        cursor: pointer;
        opacity: 0.7;
    }

    .kinds button.active {
        background: rgba(255, 255, 255, 0.14);
        opacity: 1;
        font-weight: 600;
    }

    .slider {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .slider-label, .ends {
        display: flex;
        justify-content: space-between;
        font-size: 0.8em;
        font-variant-numeric: tabular-nums;
    }

    .ends {
        margin-top: -2px;
        font-size: 0.65em;
        opacity: 0.55;
    }

    .slider input {
        width: 100%;
        margin: 0;
        accent-color: #e0a030;
    }

    .white-range {
        appearance: none;
        height: 14px;
        border-radius: 7px;
    }

    .white-range::-webkit-slider-thumb {
        appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: white;
        border: 2px solid #333;
        cursor: pointer;
    }

    .white-range::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: white;
        border: 2px solid #333;
        cursor: pointer;
    }

    .colours {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
    }

    .colour {
        aspect-ratio: 1;
        padding: 0;
        border: 2px solid transparent;
        border-radius: 10px;
        cursor: pointer;
    }

    .colour.active {
        border-color: white;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.5) inset;
    }

    .custom {
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
        background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
    }

    /* The picker fills the swatch, but isn't seen: the swatch is what's tapped */
    .custom input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
    }

    .main-btn {
        padding: 14px 16px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #e0a030, #c76b1c);
        color: white;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        transition: filter 0.2s;
    }

    .main-btn.end {
        background: linear-gradient(135deg, #3d6e9b, #2c4a6e);
    }

    .main-btn:hover {
        filter: brightness(1.1);
    }

    .error {
        font-size: 0.8em;
        color: #ff8a8a;
        text-align: center;
    }
</style>
