<script lang="ts">
    import { onMount } from "svelte";
    import { formatTime } from "$lib/common/util";
    import timer from '$lib/assets/timer.png';
    import bell from '$lib/assets/bell.fill.png';
    import bell_slash from '$lib/assets/bell.slash.png';
    import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
    import { type TimerOption } from "$lib/common/timerOption";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import { SpotifyPlayer } from "$lib/audio/client/SpotifyPlayer.svelte";
    import { MusicPlayer } from "$lib/audio/client/MusicPlayer.svelte";
    import type { MusicPreset } from "$lib/audio/common/musicPreset";
    import type { SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import { RemoteMusic } from "./remote/remoteMusic.svelte";
    import NowPlayingBar from "./remote/NowPlayingBar.svelte";
    import MusicView from "./remote/MusicView.svelte";
    import LightingView from "./remote/LightingView.svelte";
    import { overrideHex } from "./remote/lighting";

    let {
        model,
        timerOptions,
        musicPresets = [],
        spotifyPresets = [],
        onstart = () => {},
        onmixer
    }: {
        model: Clocktower;
        timerOptions: TimerOption[];
        musicPresets?: MusicPreset[];
        spotifyPresets?: SpotifyPreset[];
        onstart?: () => void;
        /** When given, the music view offers the mixer, calling this (to open the mixer as a remote). */
        onmixer?: () => void;
    } = $props();

    /** What the time adjustment buttons add or take off, in seconds. */
    const ADJUST_STEPS = [-60, -30, 30, 60];
    /** How long the End Day button waits for its second tap. */
    const CONFIRM_MS = 3000;

    // Counting down, as opposed to paused, or run out (left "running" until the next setup)
    const counting = $derived(model.running && model.progress < 1);
    // The phase as the remote shows it: the day turns to dusk the moment the countdown runs out, before the server says so
    const phase: TimeOfDay = $derived(model.timeOfDay === 'day' && !counting ? 'dusk' : model.timeOfDay);
    const phaseIndex = $derived(TIMES_OF_DAY.indexOf(phase));
    // A timer that's still to run out (set up in the morning, or counting down) can be given more or less time
    const adjustable = $derived(phase === 'morning' || counting);
    /** The day the next morning is: this one, while it's still daytime (or the game hasn't started). */
    const nextDay = $derived(model.day + 1);

    // The shared audio dim and the music players, all remote-only: they control what plays on another device
    let audioDim: AudioDim|null = $state(null);
    let music: RemoteMusic|null = $state(null);

    onMount(() => {
        audioDim = new AudioDim();
        const spotify = new SpotifyPlayer({ remoteOnly: true });
        const musicPlayer = new MusicPlayer({ remoteOnly: true });
        music = new RemoteMusic(musicPlayer, spotify, () => ({ music: musicPresets, spotify: spotifyPresets }));
        return () => {
            audioDim?.close();
            spotify.close();
            musicPlayer.close();
        };
    });

    let view: 'clock' | 'music' | 'lighting' = $state('clock');
    /** The timer picker, when open: to start the day with the timer picked, or only set it up. */
    let pickingTimer: 'start' | 'setup' | null = $state(null);
    let gameOpen = $state(false);
    let error: string|null = $state(null);
    let errorTimeout: ReturnType<typeof setTimeout>|null = null;

    /** POSTs to the clock's API, showing what went wrong (briefly) if it fails. */
    async function post(action: string, body?: object, failure = `Couldn't ${action}`): Promise<boolean> {
        try {
            const response = await fetch(`/api/clock/${model.id}/${action}`, {
                method: 'POST',
                ...(body ? { body: JSON.stringify(body), headers: {'Content-Type': 'application/json'} } : {})
            });
            if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
            return true;
        } catch (e) {
            console.error(failure, e);
            showError(failure);
            return false;
        }
    }

    function showError(message: string){
        error = message;
        if (errorTimeout) clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => error = null, 4000);
    }

    function setTimeOfDay(timeOfDay: TimeOfDay){
        // Morning is asked for as 'day', which sets the timer up again (as last time) and waits for it to start
        const asked = timeOfDay === 'morning' ? 'day' : timeOfDay;
        return post('timeOfDay', { timeOfDay: asked }, `Couldn't set the time of day to ${TIME_OF_DAY_LABELS[timeOfDay].toLowerCase()}`);
    }

    async function start(){
        if (await post('start', undefined, "Couldn't start the timer")) onstart();
    }

    /** Sets the day up with the timer picked, starting it if the picker was opened to. */
    async function pick(option: TimerOption){
        const andStart = pickingTimer === 'start';
        pickingTimer = null;
        if (!await post('setup', option, "Couldn't set the timer up")) return;
        if (andStart) await start();
    }

    // The End Day button needs a second tap, so a stray one doesn't end the day (forgotten if the day ends meanwhile)
    let confirmEndAsked = $state(false);
    const confirmingEnd = $derived(confirmEndAsked && phase === 'day');
    let confirmTimeout: ReturnType<typeof setTimeout>|null = null;
    function endDay(){
        if (!confirmingEnd) {
            confirmEndAsked = true;
            confirmTimeout = setTimeout(() => confirmEndAsked = false, CONFIRM_MS);
            return;
        }
        if (confirmTimeout) clearTimeout(confirmTimeout);
        confirmEndAsked = false;
        setTimeOfDay('dusk');
    }

    /** Moves the game on to its next phase: the main button. */
    function advance(){
        switch (phase) {
            case 'morning': start(); break;
            case 'day': endDay(); break;
            case 'dusk': setTimeOfDay('night'); break;
            case 'night': setTimeOfDay('morning'); break;
        }
    }

    /** Jumps straight to a phase from the flow, out of order: ending a countdown that's running needs confirming. */
    function jumpTo(timeOfDay: TimeOfDay){
        if (timeOfDay === phase) return;
        if (timeOfDay === 'day') { pickingTimer = 'start'; return; }
        if (counting && !confirm(`End the day now and go to ${TIME_OF_DAY_LABELS[timeOfDay].toLowerCase()}?`)) return;
        setTimeOfDay(timeOfDay);
    }

    function formatStep(seconds: number){
        const sign = seconds < 0 ? '−' : '+';
        const abs = Math.abs(seconds);
        return abs % 60 === 0 ? `${sign}${abs / 60}m` : `${sign}${abs}s`;
    }

    function setDay(day: number){
        post('day', { day }, "Couldn't set the day");
    }

    function setPlayers(players: number){
        post('playerCount', { playerCount: players }, "Couldn't set the player count");
    }
</script>

{#if view === 'music' && music}
<MusicView {music} {audioDim} {onmixer} onback={() => view = 'clock'}/>
{:else if view === 'lighting'}
<LightingView {model} onback={() => view = 'clock'}/>
{:else}
<div class="clock-setter-main">
    <div class="top-row">
    <section class="game-section">
        <button class="game-summary" onclick={() => gameOpen = !gameOpen} aria-expanded={gameOpen}>
            <span class="game-title">Game</span>
            <span class="game-values">Day {model.day} · {model.playerCount} players</span>
            <svg class="chevron" class:open={gameOpen} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>
        </button>
        {#if gameOpen}
        <div class="game-controls">
            <div class="stepper">
                <button onclick={() => setDay(model.day - 1)} disabled={model.day <= 0} aria-label="Previous day">−</button>
                <div><div class="stepper-label">Day</div><div>{model.day}</div></div>
                <button onclick={() => setDay(model.day + 1)} aria-label="Next day">+</button>
            </div>
            <div class="stepper">
                <button onclick={() => setPlayers(model.playerCount - 1)} disabled={model.playerCount <= 0} aria-label="One fewer player">−</button>
                <div><div class="stepper-label">Players</div><div>{model.playerCount}</div></div>
                <button onclick={() => setPlayers(model.playerCount + 1)} aria-label="One more player">+</button>
            </div>
        </div>
        {/if}
    </section>
    {#if model.lightscapes}
    <!-- Lit up in the override's colour while the lights are overridden -->
    <button class="lighting-btn" class:on={model.lightOverride} onclick={() => view = 'lighting'}
        style={model.lightOverride ? `color: ${overrideHex(model.lightOverride)};` : ''}
        title={model.lightOverride ? "The lights are overridden: they don't follow the game" : 'Override the lights'}
        aria-label={model.lightOverride ? 'Lighting (overridden)' : 'Lighting'}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill={model.lightOverride ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z"/>
            <path d="M10 22h4" fill="none"/>
        </svg>
    </button>
    {/if}
    </div>

    <section class="phase-card">
        <!-- The day's flow, left to right; each phase can also be jumped to by hand -->
        <ol class="flow">
            {#each TIMES_OF_DAY as timeOfDay, i}
                <li class="flow-step" class:done={i < phaseIndex} class:current={i === phaseIndex} class:next={i === (phaseIndex + 1) % TIMES_OF_DAY.length}>
                    <button onclick={() => jumpTo(timeOfDay)} disabled={i === phaseIndex || (timeOfDay === 'morning' && counting)}
                        title={i === phaseIndex ? `It's ${TIME_OF_DAY_LABELS[timeOfDay].toLowerCase()}` : timeOfDay === 'day' ? 'Pick a timer and start the day' : timeOfDay === 'morning' ? 'Set the timer up again, ready to start' : `Go to ${TIME_OF_DAY_LABELS[timeOfDay].toLowerCase()}`}>
                        <span class="flow-dot"><TimeOfDayIcon {timeOfDay} size={18}/></span>
                        <span class="flow-label">{TIME_OF_DAY_LABELS[timeOfDay]}</span>
                    </button>
                </li>
            {/each}
        </ol>

        <div class="time-display" class:dim={!adjustable}>
            {#if counting}
            <button class="play-pause-btn" onclick={() => post('stop', undefined, "Couldn't pause the timer")} title="Pause (the timer goes back to the start, in the morning)" aria-label="Pause the timer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            {:else if phase === 'morning'}
            <button class="play-pause-btn" onclick={start} title="Start the timer as it's set up" aria-label="Start the timer">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            {/if}
            <span class="time">{formatTime(model.secondsRemaining)}</span>
        </div>

        {#if adjustable}
        <div class="bell-reminder">
            {#if model.ringBellWhen !== undefined}
            <img class="timer-icon-img" src="{bell}" alt="Bell"/> Reminder at {formatTime(model.ringBellWhen)} left
            {:else}
            <img class="timer-icon-img" src="{bell_slash}" alt="No bell"/> No reminder
            {/if}
        </div>
        {/if}

        <div class="adjust-row">
            {#each ADJUST_STEPS as step}
                <button class="adjust-btn" onclick={() => post('adjustTime', { seconds: step }, "Couldn't change the time")}
                    disabled={!adjustable || (step < 0 && model.secondsRemaining <= -step)}
                    title="{step < 0 ? 'Take' : 'Add'} {Math.abs(step)} seconds {step < 0 ? 'off' : ''}">
                    {formatStep(step)}
                </button>
            {/each}
        </div>

        <button class="preset-btn" onclick={() => pickingTimer = 'setup'} disabled={phase !== 'morning'} title="Set the timer up as one of the presets">
            <img class="timer-icon-img" src="{timer}" alt=""/> Pick a preset
        </button>

        <button class="advance-btn phase-{phase}" class:confirming={confirmingEnd} onclick={advance}>
            {#if phase === 'morning'}
                <TimeOfDayIcon timeOfDay="day" size={22}/>
                <span class="advance-text"><span>Start day {model.day}</span><small>Start the {formatTime(model.duration)} timer</small></span>
            {:else if phase === 'day'}
                <TimeOfDayIcon timeOfDay="dusk" size={22}/>
                <span class="advance-text">
                    <span>{confirmingEnd ? 'Tap again to end the day' : 'End the day'}</span>
                    <small>{confirmingEnd ? 'Dusk falls now' : 'Dusk falls when the timer runs out'}</small>
                </span>
            {:else if phase === 'dusk'}
                <TimeOfDayIcon timeOfDay="night" size={22}/>
                <span class="advance-text"><span>Enter the night phase</span><small>End day {model.day}</small></span>
            {:else}
                <TimeOfDayIcon timeOfDay="morning" size={22}/>
                <span class="advance-text"><span>Wake up</span><small>End the night and begin day {nextDay}</small></span>
            {/if}
        </button>

        {#if error}<div class="error" role="alert">{error}</div>{/if}
    </section>

    {#if music}
    <div class="now-playing-slot">
        <NowPlayingBar {music} {audioDim} onopen={() => view = 'music'}/>
    </div>
    {/if}
</div>
{/if}

{#if pickingTimer}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="picker-backdrop" onclick={() => pickingTimer = null} role="presentation">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="picker" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick a timer" tabindex="-1">
        <div class="picker-header">
            <div>
                <h3>{pickingTimer === 'start' ? 'Start the day' : 'Pick a preset'}</h3>
                <div class="picker-subtitle">Day {phase === 'morning' && model.day > 0 ? model.day : nextDay} · pick a timer {pickingTimer === 'start' ? 'to start it' : 'to set it up'}</div>
            </div>
            <button class="picker-close" onclick={() => pickingTimer = null} aria-label="Close">✕</button>
        </div>
        <div class="button-container">
            {#each timerOptions as option, index}
                <button class="button-container-button timer-option" class:active={option.duration === model.duration} onclick={() => pick(option)} style="grid-column: span {(index === timerOptions.length - 1 && timerOptions.length%2 === 1) ? 2 : 1};">
                    <div>
                        <div class="timer-icons" style="font-size: {option.label ? '0.8em' : '1em'};">
                            <div>
                                <img class="timer-icon-img" src="{timer}" alt="Timer"/>
                                {formatTime(option.duration)}
                            </div>
                            <div>
                                {#if option.ringBellWhenRemaining !== null}
                                <img class="timer-icon-img" src="{bell}" alt="Bell"/>
                                {formatTime(option.ringBellWhenRemaining)}
                                {:else}
                                <img class="timer-icon-img" src="{bell_slash}" alt="No bell"/>
                                {/if}
                            </div>
                        </div>
                        {#if option.label}
                        <div style="font-size: 1.2em; margin-top: 5px;">{option.label}</div>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
    </div>
</div>
{/if}

<style>
    .clock-setter-main {
        display: flex;
        flex-direction: column;
        gap: 10px;
        /* A fixed width, not the content's, so it doesn't shift as the labels change */
        width: min(360px, calc(100vw - 32px));
        margin: 0 auto;
        box-sizing: border-box;
    }

    /* ---- Phase card ---- */

    .phase-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .flow {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .flow-step {
        position: relative;
        display: flex;
        justify-content: center;
    }

    /* The line joining each step to the one before it */
    .flow-step + .flow-step::before {
        content: '';
        position: absolute;
        top: 17px;
        right: calc(50% + 20px);
        left: calc(-50% + 20px);
        height: 2px;
        border-radius: 1px;
        background: rgba(255, 255, 255, 0.15);
    }

    .flow-step.done::before, .flow-step.current::before {
        background: rgba(255, 255, 255, 0.45);
    }

    .flow-step button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 0;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }

    .flow-step button:disabled {
        cursor: default;
    }

    .flow-dot {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.07);
        color: rgba(255, 255, 255, 0.45);
        transition: background-color 0.3s, color 0.3s, box-shadow 0.3s;
    }

    .flow-step.done .flow-dot {
        color: rgba(255, 255, 255, 0.75);
    }

    .flow-step.next .flow-dot {
        box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.4);
        color: rgba(255, 255, 255, 0.8);
    }

    .flow-step.current .flow-dot {
        background: #2c6e9b;
        color: white;
        box-shadow: 0 0 0 4px rgba(44, 110, 155, 0.35);
    }

    .flow-step button:hover:not(:disabled) .flow-dot {
        background: rgba(255, 255, 255, 0.15);
    }

    .flow-label {
        font-size: 0.65em;
        opacity: 0.6;
    }

    .flow-step.current .flow-label {
        opacity: 1;
        font-weight: 600;
    }

    .time-display {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.25em;
        font-size: 2.6em;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }

    .time-display.dim .time {
        opacity: 0.45;
    }

    .bell-reminder {
        margin-top: -6px;
        font-size: 0.75em;
        text-align: center;
        opacity: 0.65;
        font-variant-numeric: tabular-nums;
    }

    .play-pause-btn {
        display: flex;
        font-size: inherit; /* Buttons don't inherit it by default; the icon is sized relative to the time */
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    .play-pause-btn svg {
        width: 1em;
        height: 1em;
    }

    .play-pause-btn:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .adjust-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
    }

    .adjust-btn {
        padding: 11px 0;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        font-size: 0.8em;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
    }

    .adjust-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
    }

    .adjust-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .preset-btn {
        display: flex;
        margin-top: -6px; /* Closer to the adjustment buttons: as far as they are apart (the card's gap is 12px) */
        justify-content: center;
        align-items: center;
        gap: 6px;
        padding: 9px 0;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        font-size: 0.85em;
        cursor: pointer;
    }

    .preset-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
    }

    .preset-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    /* The main button, coloured for the phase it moves the game on to */
    .advance-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border: none;
        border-radius: 12px;
        color: white;
        font: inherit;
        cursor: pointer;
        transition: filter 0.2s, background-color 0.3s;
    }

    .advance-btn:hover {
        filter: brightness(1.1);
    }

    .advance-btn:active {
        filter: brightness(0.95);
    }

    .advance-btn.phase-morning { background: linear-gradient(135deg, #e0a030, #c76b1c); }
    .advance-btn.phase-day { background: linear-gradient(135deg, #b85a3c, #7e3555); }
    .advance-btn.phase-dusk { background: linear-gradient(135deg, #4d3a8a, #232a5c); }
    .advance-btn.phase-night { background: linear-gradient(135deg, #3d8bc7, #e0a030); }

    .advance-btn.confirming {
        background: #c0392b;
        animation: pulse 0.8s ease-in-out infinite alternate;
    }

    @keyframes pulse {
        from { filter: brightness(1); }
        to { filter: brightness(1.25); }
    }

    @media (prefers-reduced-motion: reduce) {
        .advance-btn.confirming { animation: none; }
    }

    .advance-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        font-weight: 600;
        line-height: 1.2;
    }

    .advance-text small {
        font-size: 0.65em;
        font-weight: normal;
        opacity: 0.85;
    }

    .error {
        font-size: 0.8em;
        color: #ff8a8a;
        text-align: center;
    }

    /* ---- Game ---- */

    .top-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
    }

    .game-section {
        flex: 1;
        min-width: 0;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        overflow: hidden;
    }

    .lighting-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        flex: none;
        width: 44px;
        align-self: stretch;
        max-height: 44px;
        padding: 0;
        border: none;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.75);
        cursor: pointer;
    }

    .lighting-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .lighting-btn.on {
        background: rgba(255, 255, 255, 0.1);
        box-shadow: 0 0 12px -2px currentColor;
    }

    .game-summary {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        font-size: 0.85em;
        cursor: pointer;
    }

    .game-title {
        font-weight: 600;
    }

    .game-values {
        flex: 1;
        text-align: right;
        opacity: 0.7;
    }

    .chevron {
        flex: none;
        opacity: 0.6;
        transition: transform 0.2s;
    }

    .chevron.open {
        transform: rotate(90deg);
    }

    .game-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        padding: 0 8px 8px;
    }

    .stepper {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 6px;
        padding: 6px;
        border-radius: 8px;
        background: #444;
        text-align: center;
    }

    .stepper button {
        padding: 4px 0;
        border: none;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        font-size: 1.3em;
        cursor: pointer;
    }

    .stepper button:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .stepper-label {
        font-size: 0.7em;
        opacity: 0.55;
    }

    /* ---- Now playing ---- */

    .now-playing-slot {
        position: sticky;
        bottom: 10px;
        margin-top: 6px;
    }

    /* ---- Timer picker ---- */

    .picker-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        background: rgba(0, 0, 0, 0.55);
        animation: fade-in 0.15s ease-out;
    }

    .picker {
        width: 100%;
        max-width: 420px;
        max-height: 85vh;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
        border-radius: 16px 16px 0 0;
        background: var(--theme-bg-secondary);
        color: var(--theme-on-bg);
        animation: slide-up 0.2s ease-out;
    }

    @media (min-width: 600px) {
        .picker-backdrop { align-items: center; }
        .picker { border-radius: 16px; }
    }

    @keyframes fade-in {
        from { opacity: 0; }
    }

    @keyframes slide-up {
        from { transform: translateY(30px); opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
        .picker-backdrop, .picker { animation: none; }
    }

    .picker-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 14px;
    }

    .picker-header h3 {
        margin: 0;
    }

    .picker-subtitle {
        font-size: 0.8em;
        opacity: 0.65;
    }

    .picker-close {
        padding: 4px 10px;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }

    .button-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: 1fr;
        gap: 6px;
    }

    .button-container-button {
        box-sizing: border-box;
        padding: 19px 15px;
        font-size: inherit;
        border-radius: 8px;
        border: none;
        background-color: #444;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
        text-align: center;
    }

    .button-container-button:hover {
        background-color: #555;
    }

    .button-container-button.active {
        background-color: #27ae60;
    }

    .timer-icons {
        display: flex;
        justify-content: center;
        gap: 10px;
        align-items: center;
    }

    .timer-icon-img {
        width: 1em;
        height: 1em;
        vertical-align: middle;
        margin-right: 2px;
    }
</style>
