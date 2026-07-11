<script lang="ts">
    import { onMount } from "svelte";
    import type { Config, TimerOption } from "$lib/common/config";
    import { formatTime } from "$lib/common/util";
    import type { ClockClientModel } from "$lib/model/client/ClockClientModel";
    import bell_and_waves from '$lib/assets/bell.and.waves.left.and.right.png';
    import gearshape from '$lib/assets/gearshape.fill.png';
    import timer from '$lib/assets/timer.png';
    import bell from '$lib/assets/bell.fill.png';
    import bell_slash from '$lib/assets/bell.slash.png';


    let {
        model,
        onstart = () => {}
    }: {
        model: ClockClientModel;
        onstart?: () => void;
    } = $props();

    let clockState = model.state;
    let clock_info = model.clock_info;

    let day = model.day_info;
    let players = model.playerCount;

    let options: TimerOption[] = $state([
        {duration: 0, ringBellWhenRemaining: null, label: null},
        {duration: 5, ringBellWhenRemaining: null, label: null},
        {duration: 30, ringBellWhenRemaining: null, label: null},
        {duration: 180, ringBellWhenRemaining: 30, label: null},
        {duration: 300, ringBellWhenRemaining: 30, label: null},
        {duration: 480, ringBellWhenRemaining: 30, label: null}
    ]);

    onMount(()=>{
        console.log("ClockSetter mounted, fetching config...");
        fetch(`/api/clock/${model.clockId}/config`).then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch config');
            }
            return response.json();
        }).then((data: Config) => {
            console.log("Received Config data:", data);
            options = data.timerOptions;
        }).catch(error => {
            console.error("Error fetching config:", error);
        });
    });


    function onStop(){
        fetch(`/api/clock/${model.clockId}/stop`, {
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
        fetch(`/api/clock/${model.clockId}/start`, {
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
        fetch(`/api/clock/${model.clockId}/ringBell`, {
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
        fetch(`/api/clock/${model.clockId}/setup`, {
            method: 'POST',
            body: JSON.stringify({
                duration: option.duration,
                ringBellAfter: option.ringBellWhenRemaining === null ? null : option.duration - option.ringBellWhenRemaining
            }),
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
        fetch(`/api/clock/${model.clockId}/day`, {
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
        fetch(`/api/clock/${model.clockId}/playerCount`, {
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
    <div class="button-container">
        <div class="button-container-button" style="padding: 5px;">
            
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px;">
                <button class="button-style updown" onclick={()=>{setDay($day.day-1)}}>-</button>
                <div>
                    <div style="opacity: 0.5;">Day</div>
                    <div>{$day.day}</div>
                </div>
                <button class="button-style updown" onclick={()=>{setDay($day.day+1)}}>+</button>
            </div>
        </div>
        <div class="button-container-button" style="padding: 5px;">
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px;">
                <button class="button-style updown" onclick={()=>{setPlayers($players-1)}}>-</button>
                <div>
                    <div style="opacity: 0.5;">Players</div>
                    <div>{$players}</div>
                </div>
                <button class="button-style updown" onclick={()=>{setPlayers($players+1)}}>+</button>
            </div>
        </div>
        {#each options as option, index}
            <button class="button-container-button" class:active={option.duration === $clock_info.max} onclick={() => setupClock(option)} disabled={$clockState === 'counting'} style="grid-column: span {(index === options.length - 1 && options.length%2 === 1) ? 2 : 1};">
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
        <a class="button-style" id="edit-button" href="/admin/{model.clockId}/config">
            <img class="button-icon-img" src="{gearshape}" alt="Config"/>
        </a>
        <button class="button-container-button stop-btn" onclick={onStop} disabled={$clockState !== 'counting'}>Stop</button>
        <button class="button-container-button start-btn" onclick={onStart} disabled={$clockState !== 'idle'}>Start</button>
        <button class="button-container-button ring-bell-btn" onclick={onBell}>
            <img class="button-icon-img" src="{bell_and_waves}" alt="Ring Bell"/>
        </button>
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
        align-items: center;
        height: 100%;
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