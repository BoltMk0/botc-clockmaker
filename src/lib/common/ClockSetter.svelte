<script lang="ts">
    import { onMount } from "svelte";
    import type { Config, TimerOption } from "./config";
    import { formatTime } from "./util";
    import type { ClientModel } from "$lib/client/model";
    export let model: ClientModel;

    $: state = model.state;

    var options: TimerOption[] = [
        {duration: 0},
        {duration: 5},
        {duration: 30},
        {duration: 180, ringBellWhenRemaining: 30},
        {duration: 300, ringBellWhenRemaining: 30},
        {duration: 480, ringBellWhenRemaining: 30}
    ];

    onMount(()=>{
        console.log("ClockSetter mounted, fetching config...");
        fetch('/admin/api/config').then(response => {
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
    })
    
</script>
<div class="clock-setter-main">
    <div class="button-container">
        {#each options as option}
            <button on:click={() => {
                fetch('/admin/api/clock/setup', {
                    method: 'POST',
                    body: JSON.stringify({
                        duration: option.duration,
                        ringBellAfter: option.ringBellWhenRemaining === undefined ? undefined : option.duration - option.ringBellWhenRemaining
                    }),
                    headers: {'Content-Type': 'application/json'}
                }).then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to setup clock');
                    }
                    console.log("Clock setup successfully");
                }).catch(error => {
                    console.error("Error setting up clock:", error);
                });
            }} disabled={$state === 'counting'}>
                <div>
                    <div class="timer-icons" style="font-size: {option.label ? '0.8em' : '1em'};">
                        <div>
                            <img class="timer-icon-img" src="/icons/timer.png" alt="Timer"/>
                            {formatTime(option.duration)}
                        </div>
                        <div>
                            {#if option.ringBellWhenRemaining !== undefined}
                            <img class="timer-icon-img" src="/icons/bell.fill.png" alt="Bell"/>
                            {formatTime(option.ringBellWhenRemaining)}
                            {:else}
                            <img class="timer-icon-img" src="/icons/bell.slash.png" alt="No bell"/>
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
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 1em; margin-top: 5px; gap: 5px;">
        <button class="stop-btn" on:click={() => {
            fetch('/admin/api/clock/stop', {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to stop clock');
                }
                console.log("Clock stopped");
            }).catch(error => {
                console.error("Error stopping clock:", error);
            });
        }} disabled={$state !== 'counting'}>
            Stop
        </button>
        <button class="start-btn" on:click={() => {
            fetch('/admin/api/clock/start', {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to start clock');
                }
                console.log("Clock started");
            }).catch(error => {
                console.error("Error starting clock:", error);
            });
        }} disabled={$state !== 'idle'}>
            Start
        </button>

        <button class="ring-bell-btn" on:click={() => {
            fetch('/admin/api/clock/ringBell', {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to ring bell');
                }
                console.log("Bell rung");
            }).catch(error => {
                console.error("Error ringing bell:", error);
            });
        }}>
            Ring Bell
        </button>
    </div>
</div>

<style>
    .button-container {
        display: grid; 
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    }

    button {
        padding: 10px;
        font-size: inherit;
        border-radius: 5px;
        border: none;
        background-color: #444;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
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
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        align-items: center;
        justify-content: center;

    }

    .timer-icon-img {
        width: 1em;
        height: 1em;
        vertical-align: middle;
        margin-right: 2px;
    }
</style>