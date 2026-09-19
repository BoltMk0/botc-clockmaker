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
    import { goto } from "$app/navigation";


    let {
        model,
        timerOptions,
        hasGrim,
        onstart = () => {}
    }: {
        model: Clocktower;
        timerOptions: TimerOption[];
        hasGrim: boolean;
        onstart?: () => void;
    } = $props();

    // Whether a grimoire state exists for this clock - tracked locally
    // (seeded from the initial server-loaded value) so the Setup/View/Remove
    // buttons below can update immediately after an action without a full
    // page reload. The virtual grimoire is optional: some tables run without
    // one, so this lets a game exist with or without it.
    let grimExists = $state(hasGrim);
    function setupGrim(){
        goto(`/admin/${model.id}/grim/setup`);
    }

    function removeGrim(){
        if(!confirm("Are you sure you want to remove the grim for this game? This action cannot be undone.")) return;
        fetch(`/admin/${model.id}/grim/state`, {
            method: 'DELETE'
        }).then(response => {
            if (!response.ok) {
                alert("Failed to remove grim");
                throw new Error('Failed to remove grim');
            }
            grimExists = false;
        }).catch(error => {
            console.error("Error removing grim:", error);
        });
    }

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
            <div class="time-remaining-display">{formatTime(model.secondsRemaining)}</div>

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
                    <button class="button-container-button" class:active={option.duration === model.duration} onclick={() => setupClock(option)} disabled={model.running && model.timeOfDay === 'day'} style="grid-column: span {(index === timerOptions.length - 1 && timerOptions.length%2 === 1) ? 2 : 1};">
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
            <div style="display: grid; grid-template-columns: 2fr 3fr 3fr 2fr; font-size: 1em; gap: 5px;">
                <a class="button-style" id="edit-button" href="/settings/clocks">
                    <img class="button-icon-img" src="{gearshape}" alt="Config"/>
                </a>
                <button class="button-container-button stop-btn" onclick={onStop} disabled={!model.running || model.timeOfDay === 'night'}>Stop</button>
                <button class="button-container-button start-btn" onclick={onStart} disabled={model.running}>Start</button>
                <button class="button-container-button ring-bell-btn" onclick={onBell}>
                    <img class="button-icon-img" src="{bell_and_waves}" alt="Ring Bell"/>
                </button>
            </div>

            {#if grimExists}
                <div class="grim-controls">
                    <a class="button-style" href="/admin/{model.id}/grim">View</a>
                    <button class="button-style error" onclick={removeGrim}>Remove</button>
                </div>
            {:else}
                <button class="button-style" onclick={setupGrim} style="width: 100%; box-sizing: border-box; text-align: center; background: transparent; border: 2px dashed currentColor; opacity: 0.45; padding: 0.8em 1em;">Setup Grim</button>
            {/if}
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
        text-align: center;
        padding: 10px;
    }

    .day-player-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    }

    .grim-controls {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    }

    .grim-controls .button-style {
        box-sizing: border-box;
        text-align: center;
    }

    .button-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
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

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    button.stop-btn {
        background-color: #c0392b;
    }

    button.start-btn {
        background-color: #27ae60;
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