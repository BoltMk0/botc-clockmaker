<script lang="ts">
    import { onMount } from "svelte";
    import type { Config, TimerOption } from "./config";
    import { formatTime } from "./util";
    import type { ClientModel } from "$lib/client/model";
    export let model: ClientModel;

    $: state = model.state;

    var options: TimerOption[] = [
        {duration: 0, ringBellWhenRemaining: null, label: null},
        {duration: 5, ringBellWhenRemaining: null, label: null},
        {duration: 30, ringBellWhenRemaining: null, label: null},
        {duration: 180, ringBellWhenRemaining: 30, label: null},
        {duration: 300, ringBellWhenRemaining: 30, label: null},
        {duration: 480, ringBellWhenRemaining: 30, label: null}
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
        {#each options as option, index}
            <button on:click={() => {
                fetch('/admin/api/clock/setup', {
                    method: 'POST',
                    body: JSON.stringify({
                        duration: option.duration,
                        ringBellAfter: option.ringBellWhenRemaining === null ? null : option.duration - option.ringBellWhenRemaining
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
            }} disabled={$state === 'counting'} style="grid-column: span {(index === options.length - 1 && options.length%2 === 1) ? 2 : 1};">
                <div>
                    <div class="timer-icons" style="font-size: {option.label ? '0.8em' : '1em'};">
                        <div>
                            <img class="timer-icon-img" src="/icons/timer.png" alt="Timer"/>
                            {formatTime(option.duration)}
                        </div>
                        <div>
                            {#if option.ringBellWhenRemaining !== null}
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
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; font-size: 1em; gap: 5px;">
        <a class="button-style" id="edit-button" href="/admin/edit-timers">Config</a>
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
            Ring
        </button>
    </div>
</div>

<style>
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
        gap: 5px;
        width: 100%;
        height: 100%;
    }

    .button-container button {
        flex-grow: 1;
        box-sizing: border-box;
        /* height: 100%; */
    }

    button {
        padding: 15px;
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