<script lang="ts">
    import { onMount } from "svelte";
    import HSlider from "$lib/audio/client/components/HSlider.svelte";
    import type { ClockInstanceInfo } from "$lib/common/config";
    import { appSettings } from "$lib/model/client/appSettings.svelte";

    let visible = $state(false);
    let clients: ClockInstanceInfo[] | undefined = $state(undefined);

    async function loadClockData(){
        const response = await fetch('/api/clock');
        if(response.ok){
            const data = await response.json() as { instances: ClockInstanceInfo[] };
            return data.instances;
        } else {
            throw new Error("Failed to load clock data: " + response.statusText);
        }
    }

    onMount(()=>{
        loadClockData().then(instances => {
            console.log("Clock instances loaded:", instances);
            clients = instances;
        }).catch(error => {
            console.error("Error loading clock instances:", error);
        });
    });


</script>

<style>
    .navbar-main {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: fit-content;
        min-width: 300px;
        padding: 20px;
        box-sizing: border-box;
        transition: transform 0.3s ease;
        background-color: var(--theme-bg-secondary);
        font-size: x-large;
        padding-top: 60px;
        z-index: 1000;
    }

    a {
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
    }

    a:hover {
        opacity: 1;
    }

    li {
        list-style: none;
    }

    .hamburger {
        opacity: 0.2;
    }

    .hamburger:hover {
        opacity: 1;
    }

    .close-button {
        position: absolute;
        top: 10px;
        right: 10px;
        background-color: red;
        border: none;
        border-radius: 5px;
        font-size: x-large;
        color: var(--theme-on-bg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px;
        aspect-ratio: 1 / 1;
        height: 1.5em;
        text-align: center;
    }

    .navbar-settings-pane {
        background-color: var(--theme-bg); 
        padding: 10px; 
        border-radius: 8px;
    }
</style>

<button aria-label="Menu" class="no-button-style hamburger" onclick={()=>{visible = true;}} style="position: absolute; top: 10px; left: 10px;">
    <svg width={40} height={40} viewBox="0 0 100 100" style="fill: #FFF6;">
        <rect x={0} y={0} width={100} height={20}/>
        <rect x={0} y={37.5} width={100} height={20}/>
        <rect x={0} y={75} width={100} height={20}/>
    </svg>
</button>

<div class="navbar-main" style="transform: translateX({visible ? "0" : "-100%"});">
    <button onclick={()=>{visible = false;}} class="close-button">
        X
    </button>
    <ul style="list-style-type: none; padding: 0 2em 0 1em; margin: 0; margin-bottom: 1em;">
        {#if clients !== undefined && clients.length > 0}
        <li>
            <a href="/" target="_self">Clocks</a>
            <ul>
                {#each clients as client}
                    <li>
                        <a href="/{client.id}" target="_self">{client.config.teamName}</a>
                        <ul>
                            <li><a href="/admin/{client.id}" target="_self">Remote</a></li>
                        </ul>
                    </li>
                {/each}
            </ul>
        </li>
         {/if}
        <li><a href="/admin/mixer">Audio Mixer</a></li>
        <li><a href="/admin/games" target="_self">Games</a></li>
        <li><a href="/settings" target="_self">Settings</a></li>
    </ul>

    <div style="display: grid; gap: 10px;">
        <div class="navbar-settings-pane">
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">Display Size</div>

                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <div>Auto</div>
                    <input name="autosize" type="checkbox" bind:checked={appSettings.autoSize}/>
                </div>
            </div>
            {#if !appSettings.autoSize}
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;">
                <HSlider bind:value={appSettings.size} max={1400} min={400}/>
                <button style="display: inline-block;" onclick={appSettings.reCalculateSize}>Reset</button>
            </div>
            {/if}
        </div>
        <div class="navbar-settings-pane">
            <div style="font-size: smaller; text-align: center;">Display Mode</div>
            <select bind:value={appSettings.displayMode} style="width: 100%; font-size: x-large;">
                <option value="original">Original</option>
                <option value="clocktower">Clocktower</option>
            </select>
        </div>
        <div class="navbar-settings-pane">
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">Show Clock Names</div>

                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <input name="autosize" type="checkbox" bind:checked={appSettings.showClockNames}/>
                </div>
            </div>
        </div>
    </div>
</div>