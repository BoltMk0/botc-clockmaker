<script lang="ts">
    import { onMount } from "svelte";
    import HSlider from "$lib/audio/client/components/HSlider.svelte";
    import { appSettings } from "$lib/model/client/appSettings.svelte";
    import type { ClocktowerModel } from "$lib/model/common/ClocktowerModel";
    import SiteQRCode from "./SiteQRCode.svelte";
    import { page } from "$app/state";
    import type { AudioEngine } from "$lib/audio/client/AudioEngine.svelte";
    import MutedIcon from "./MutedIcon.svelte";
    import UnmutedIcon from "./UnmutedIcon.svelte";

    // In the town square the menu is just the display settings (cogwheel icon, no page links), with a back button to /play.
    // Pass the page's audio engine to show a mute toggle for it.
    let { townSquare = false, audioEngine = null }: { townSquare?: boolean, audioEngine?: AudioEngine | null } = $props();

    let visible = $state(false);
    let showQRPopup = $state(false);
    let clients: ClocktowerModel[] | undefined = $state(undefined);

    const currentPath = $derived(page.url.pathname + page.url.search);

    async function loadClockData(){
        const response = await fetch('/api/clock');
        if(response.ok){
            const data = await response.json() as { instances: ClocktowerModel[] };
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
        opacity: 0.85;
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

    .qr-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.75);
    }

    .qr-overlay :global(.feedback-qr) {
        position: static;
        box-shadow: none;
    }
</style>

{#if townSquare}
    <a aria-label="Back to Play" class="hamburger" href="/play" style="position: absolute; top: 10px; left: 10px; display: flex;">
        <svg width={36} height={36} viewBox="0 0 24 24" style="fill: none; stroke: #FFF; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));">
            <path d="M15 5l-7 7 7 7" />
        </svg>
    </a>
{/if}
<button aria-label={townSquare ? "Settings" : "Menu"} class="no-button-style hamburger" onclick={()=>{visible = true;}} style="position: absolute; top: 10px; left: {townSquare ? 56 : 10}px;">
    {#if townSquare}
        <svg width={36} height={36} viewBox="0 0 24 24" style="fill: #FFF; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.75 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.08.63-.08.94s.03.63.08.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.37.29.6.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.09.48 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
        </svg>
    {:else}
        <svg width={36} height={36} viewBox="0 0 100 100" style="fill: #FFF; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));">
            <rect x={0} y={0} width={100} height={20} rx={10} ry={10}/>
            <rect x={0} y={40} width={100} height={20} rx={10} ry={10}/>
            <rect x={0} y={80} width={100} height={20} rx={10} ry={10}/>
        </svg>
    {/if}
</button>

<div class="navbar-main" style="transform: translateX({visible ? "0" : "-100%"});">
    <button onclick={()=>{visible = false;}} class="close-button">
        X
    </button>
    {#if !townSquare}
    <ul style="list-style-type: none; padding: 0 2em 0 1em; margin: 0; margin-bottom: 1em;">
        <li><a href="/" target="_self">Home</a></li>
        <li>
            <a href="/play" target="_self">Play</a>
            {#if clients !== undefined && clients.length > 0}
            <ul>
                <li><a href="/townsquare/all" target="_self">All</a></li>
                {#each clients as client}
                    <li>
                        <a href="/townsquare/{client.clock.clockId}" target="_self">{client.config.teamName}</a>
                        <ul>
                            <li><a href="/admin/{client.clock.clockId}/storytell" target="_self">Storytell</a></li>
                        </ul>
                    </li>
                {/each}
            </ul>
            {/if}
        </li>
        <li><a href="/admin/mixer">Audio Mixer</a></li>
        <li><a href="/rules" target="_self">Rules</a></li>
        <li><a href="/settings" target="_self">Settings</a></li>
    </ul>
    {/if}

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
                <button class="button-style" style="display: inline-block;" onclick={() => appSettings.reCalculateSize()}>Reset</button>
            </div>
            {/if}
        </div>
        <div class="navbar-settings-pane">
            <div style="font-size: smaller; text-align: center;">Display Mode</div>
            <select bind:value={appSettings.displayMode} style="width: 100%; font-size: x-large;">
                <option value="original">Original</option>
                <option value="clocktower">Clocktower</option>
                <option value="clocktower3d">Clocktower (3D)</option>
            </select>
        </div>
        <div class="navbar-settings-pane">
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">Show Clock Names</div>

                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <input name="autosize" type="checkbox" bind:checked={appSettings.showClockNames}/>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">Show Feedback QR</div>
                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <input name="autosize" type="checkbox" bind:checked={appSettings.showQRCodes}/>
                </div>
            </div>
        </div>
        {#if audioEngine}
        <div class="navbar-settings-pane">
            <button class="button-style" style="width: 100%; font-size: large; padding: 0.5em 1em; display: flex; gap: 0.5em; align-items: center; justify-content: center;" onclick={() => { audioEngine.muted = !audioEngine.muted; }}>
                {#if audioEngine.muted}
                    <MutedIcon color="red" size={24}/> Unmute
                {:else}
                    <UnmutedIcon color="white" size={24}/> Mute
                {/if}
            </button>
        </div>
        {/if}
        <div class="navbar-settings-pane">
            <button class="button-style" style="width: 100%; font-size: large; padding: 0.5em 1em;" onclick={() => { showQRPopup = true; visible = false;}}>
                Share QR Code
            </button>
        </div>
    </div>
</div>

{#if showQRPopup}
    <div
        class="qr-overlay"
        role="button"
        tabindex="0"
        onclick={() => { showQRPopup = false; }}
        onkeydown={() => { showQRPopup = false; }}
    >
        <SiteQRCode path={currentPath} title="Scan to open this page" />
    </div>
{/if}