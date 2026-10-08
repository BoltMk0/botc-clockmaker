<script lang="ts">
    import { onMount } from "svelte";
    import type { Config } from "$lib/common/config";
    import { formatTime } from "$lib/common/util";
    import bell_and_waves from '$lib/assets/bell.and.waves.left.and.right.png';
    import gearshape from '$lib/assets/gearshape.fill.png';
    import timer from '$lib/assets/timer.png';
    import bell from '$lib/assets/bell.fill.png';
    import bell_slash from '$lib/assets/bell.slash.png';
    import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
    import { type TimerOption } from "$lib/common/timerOption";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import { SpotifyPlayer } from "$lib/audio/client/SpotifyPlayer.svelte";
    import { DEFAULT_DIM_AMOUNT_DB } from "$lib/audio/common/model/audioDimModel";


    let {
        model,
        timerOptions,
        onstart = () => {},
        onmixer
    }: {
        model: Clocktower;
        timerOptions: TimerOption[];
        onstart?: () => void;
        /** When given, the timer settings button becomes a mixer button calling this (to open the mixer as a remote). */
        onmixer?: () => void;
    } = $props();

    // Counting down, as opposed to paused, or run out (left "running" until the next setup)
    const counting = $derived(model.running && model.progress < 1);

    // The shared audio dim and Spotify transport. Created on mount: they connect to the server.
    let audioDim: AudioDim|null = $state(null);
    let spotify: SpotifyPlayer|null = $state(null); // Remote-only: controls a player running on another device
    // Only offer skipping while a Spotify player is running somewhere and can take commands
    const spotifyActive = $derived.by(() => {
        const model = (spotify as SpotifyPlayer|null)?.model;
        return !!model?.hostClientId && model.hostReady;
    });

    onMount(() => {
        audioDim = new AudioDim();
        spotify = new SpotifyPlayer({ remoteOnly: true });
        return () => {
            audioDim?.close();
            spotify?.close();
        };
    });

    function onStop(){
        fetch(`/api/clock/${model.id}/stop`, {
            method: 'POST'
        }).then(response => {
            if (!response.ok) {
                alert("Failed to stop clock");
                throw new Error('Failed to stop clock');
            }
            console.log("Clock stopped");
        }).catch(error => {
            console.error("Error stopping clock:", error);
        });
    }

    function onStart(){
        fetch(`/api/clock/${model.id}/start`, {
            method: 'POST'
        }).then(response => {
            if (!response.ok) {
                alert("Failed to start clock");
                throw new Error('Failed to start clock');
            }
            console.log("Clock started");
            onstart();
        }).catch(error => {
            console.error("Error starting clock:", error);
        });
    }

    function onBell(){
        fetch(`/api/clock/${model.id}/ringBell`, {
            method: 'POST'
        }).then(response => {
            if (!response.ok) {
                alert("Failed to ring bell");
                throw new Error('Failed to ring bell');
            }
            console.log("Bell rung");
        }).catch(error => {
            console.error("Error ringing bell:", error);
        });
    }

    function setupClock(option: TimerOption){
        fetch(`/api/clock/${model.id}/setup`, {
            method: 'POST',
            body: JSON.stringify(option),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                alert("Failed to setup clock");
                throw new Error('Failed to setup clock');
            }
            console.log("Clock setup successfully");
        }).catch(error => {
            console.error("Error setting up clock:", error);
        });
    }

    function setDay(day: number){
        fetch(`/api/clock/${model.id}/day`, {
            method: 'POST',
            body: JSON.stringify({day: day}),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                alert("Failed to set day");
                throw new Error('Failed to set day');
            }
            console.log("Day set to", day);
        }).catch(error => {
            console.error("Error setting day:", error);
        });
    }

    function setTimeOfDay(timeOfDay: TimeOfDay){
        fetch(`/api/clock/${model.id}/timeOfDay`, {
            method: 'POST',
            body: JSON.stringify({timeOfDay}),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                alert("Failed to set time of day");
                throw new Error('Failed to set time of day');
            }
            console.log("Time of day set to", timeOfDay);
        }).catch(error => {
            console.error("Error setting time of day:", error);
        });
    }

    function setPlayers(players: number){
        fetch(`/api/clock/${model.id}/playerCount`, {
            method: 'POST',
            body: JSON.stringify({playerCount: players}),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                alert("Failed to set player count");
                throw new Error('Failed to set player count');
            }
            console.log("Player count set to", players);
        }).catch(error => {
            console.error("Error setting player count:", error);
        });
    }
    
</script>
<div class="clock-setter-main">
    <div class="sections-wrap">
        <div class="setter-section">
            <div class="time-remaining-display">
                {#if counting}
                <button class="play-pause-btn" onclick={onStop} title="Pause the timer" aria-label="Pause the timer">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                {:else}
                <button class="play-pause-btn" onclick={onStart} disabled={model.running} title="Start the timer" aria-label="Start the timer">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
                {/if}
                <span>{formatTime(model.secondsRemaining)}</span>
            </div>

            <div class="time-of-day-row" style="grid-template-columns: repeat({TIMES_OF_DAY.length}, 1fr);">
                {#each TIMES_OF_DAY as timeOfDay}
                    <button class="button-container-button time-of-day-btn" class:active={model.timeOfDay === timeOfDay} onclick={() => setTimeOfDay(timeOfDay)}>
                        <TimeOfDayIcon {timeOfDay} size={18}/>
                        {TIME_OF_DAY_LABELS[timeOfDay]}
                    </button>
                {/each}
            </div>

            <div class="day-player-row">
                <div class="button-container-button" style="padding: 5px;">
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px;">
                        <button class="button-style updown" onclick={()=>{setDay(model.day-1)}}>-</button>
                        <div>
                            <div style="opacity: 0.5;">Day</div>
                            <div>{model.day}</div>
                        </div>
                        <button class="button-style updown" onclick={()=>{setDay(model.day+1)}}>+</button>
                    </div>
                </div>
                <div class="button-container-button" style="padding: 5px;">
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px;">
                        <button class="button-style updown" onclick={()=>{setPlayers(model.playerCount-1)}}>-</button>
                        <div>
                            <div style="opacity: 0.5;">Players</div>
                            <div>{model.playerCount}</div>
                        </div>
                        <button class="button-style updown" onclick={()=>{setPlayers(model.playerCount+1)}}>+</button>
                    </div>
                </div>
            </div>

            <div class="button-container">
                {#each timerOptions as option, index}
                    <button class="button-container-button timer-option" class:active={option.duration === model.duration} onclick={() => setupClock(option)} disabled={counting} style="grid-column: span {(index === timerOptions.length - 1 && timerOptions.length%2 === 1) ? 2 : 1};">
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
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); font-size: 1em; gap: 5px;">
                {#if onmixer}
                <button class="button-style" id="edit-button" onclick={onmixer} title="Mixer remote">
                    <svg class="button-icon-img" viewBox="0 0 24 24" fill="currentColor" aria-label="Mixer remote">
                        <path d="M4 5h2v14H4zM11 5h2v14h-2zM18 5h2v14h-2z"/>
                        <rect x="2" y="13" width="6" height="3" rx="1"/>
                        <rect x="9" y="7" width="6" height="3" rx="1"/>
                        <rect x="16" y="11" width="6" height="3" rx="1"/>
                    </svg>
                </button>
                {:else}
                <a class="button-style" id="edit-button" href="/settings/timerOptions">
                    <img class="button-icon-img" src="{gearshape}" alt="Config"/>
                </a>
                {/if}
                <button class="button-container-button dim-btn" class:active={audioDim?.dimmed} onclick={() => audioDim?.toggle()} disabled={!audioDim} title={audioDim?.dimmed ? 'Restore audio volume' : `Dim audio (-${audioDim?.amountDb ?? DEFAULT_DIM_AMOUNT_DB} dB)`}>
                    <div>DIM</div>
                    <div class="dim-amount">{audioDim?.dimmed ? `-${audioDim.amountDb}` : 0} dB</div>
                </button>
                <button class="button-container-button" onclick={() => spotify?.next()} disabled={!spotifyActive} title="Skip Spotify track" aria-label="Skip Spotify track">
                    <svg class="button-icon-img" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
                <button class="button-container-button ring-bell-btn" onclick={onBell}>
                    <img class="button-icon-img" src="{bell_and_waves}" alt="Ring Bell"/>
                </button>
            </div>
        </div>
    </div>
</div>

<style>

    .button-icon-img {
        height: 1.2em;
        object-fit: contain;
    }

    #edit-button {
        text-decoration: none;
        display: flex;
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
    }
    .clock-setter-main {
        display: grid;
        gap: 5px;
        justify-items: stretch;
        align-items: start;
        width: 100%;
        box-sizing: border-box;
    }

    .sections-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        justify-content: center;
        align-items: start;
        width: 100%;
    }

    .setter-section {
        display: grid;
        gap: 5px;
        width: 100%;
        max-width: 320px;
        min-width: 300px;
    }

    .time-remaining-display {
        font-size: 2.5em;
        padding: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.3em;
    }

    .play-pause-btn {
        display: flex;
        font-size: inherit; /* Buttons don't inherit it by default; the icon is sized relative to the time */
        padding: 0;
        margin: -0.2em 0; /* Keep the bigger icon from making the row taller */
        border: none;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    .play-pause-btn svg {
        width: 1.2em;
        height: 1.2em;
    }

    .play-pause-btn:hover:not(:disabled) {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .dim-btn {
        font-weight: bold;
        padding: 5px;
        line-height: 1.1;
    }

    .dim-amount {
        font-size: 0.65em;
        font-weight: normal;
        opacity: 0.7;
    }

    .dim-btn.active {
        background-color: #2c6e9b;
    }

    .time-of-day-row {
        display: grid;
        gap: 5px;
    }

    .time-of-day-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.4em;
        padding: 10px;
    }

    .time-of-day-btn.active {
        background-color: #2c6e9b;
    }

    .day-player-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    }

    .button-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: 1fr;
        flex-wrap: wrap;
        gap: 5px;
        width: 100%;
        min-width: 300px;
        height: fit-content;
    }

    .button-container-button {
        flex-grow: 1;
        box-sizing: border-box;
        padding: 15px;
        font-size: inherit;
        border-radius: 5px;
        border: none;
        background-color: #444;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
        text-align: center;
    }

    .button-container-button.active {
        background-color: #27ae60;
    }

    .timer-option {
        padding: 19px 15px;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    button.ring-bell-btn {
        background-color: #f39c12;
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

    .button-style.updown {
        font-size: 1.5em;
        opacity: 0.4;
    }
</style>