<script lang="ts">
    import { onMount } from "svelte";
    import HSlider from "$lib/audio/client/components/HSlider.svelte";
    import { appSettings } from "$lib/model/client/appSettings.svelte";
    import type { ClocktowerModel } from "$lib/model/common/ClocktowerModel";
    import SiteQRCode from "./SiteQRCode.svelte";
    import { page } from "$app/state";
    import type { AudioEngine } from "$lib/audio/client/AudioEngine.svelte";
    import AudioMixer from "$lib/audio/client/components/AudioMixer.svelte";
    import type { Resource } from "$lib/resources/common/types";
    import type { SpotifyPlayer } from "$lib/audio/client/SpotifyPlayer.svelte";
    import type { SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import type { Clocktower } from "$lib/model/client/Clocktower.svelte";
    import type { TimerOption } from "$lib/common/timerOption";
    import ClockSetter from "./ClockSetter.svelte";
    import { QR_POSITIONS, QR_POSITION_LABELS } from "$lib/resources/common/qrCodes";

    // In the town square the menu has no page links: a back button to /play, the clock timer controls (when given a clock),
    // the audio mixer and the display settings.
    // Pass the page's audio engine (and its ambience resources / spotify player) so the mixer button can show the full mixer for it.
    let {
        townSquare = false,
        clock = null,
        timerOptions = [],
        audioEngine = null,
        ambienceResources = [],
        spotify = null,
        spotifyPresets = []
    }: {
        townSquare?: boolean;
        clock?: Clocktower | null;
        timerOptions?: TimerOption[];
        audioEngine?: AudioEngine | null;
        ambienceResources?: Resource[];
        spotify?: SpotifyPlayer | null;
        spotifyPresets?: SpotifyPreset[];
    } = $props();

    let visible = $state(false);
    let showQRPopup = $state(false);
    let showMixer = $state(false);
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
        overflow-y: auto;
    }

    .back-link {
        position: absolute;
        top: 12px;
        left: 14px;
        display: flex;
        align-items: center;
        gap: 0.2em;
        font-size: large;
    }

    .clock-controls-pane {
        font-size: medium;
    }

    .remote-link {
        display: block;
        text-align: center;
        margin-top: 8px;
        font-size: small;
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

    .qr-settings-pane {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

    .mixer-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        background-color: rgba(0, 0, 0, 0.85);
    }

    .mixer-overlay-scroll {
        width: 100%;
        overflow-x: auto;
        touch-action: pan-x pan-y;
        padding: 20px 0;
        box-sizing: border-box;
    }

    .mixer-close-button {
        position: fixed;
    }
</style>

<button aria-label="Menu" class="no-button-style hamburger" onclick={()=>{visible = true;}} style="position: absolute; top: 10px; left: 10px;">
    <svg width={36} height={36} viewBox="0 0 100 100" style="fill: #FFF; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));">
        <rect x={0} y={0} width={100} height={20} rx={10} ry={10}/>
        <rect x={0} y={40} width={100} height={20} rx={10} ry={10}/>
        <rect x={0} y={80} width={100} height={20} rx={10} ry={10}/>
    </svg>
</button>

<div class="navbar-main" style="transform: translateX({visible ? "0" : "-100%"});">
    <button onclick={()=>{visible = false;}} class="close-button">
        X
    </button>
    {#if townSquare}
    <a class="back-link" href="/play" target="_self">
        <svg width={28} height={28} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;">
            <path d="M15 5l-7 7 7 7" />
        </svg>
        Back to Play
    </a>
    {/if}
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
                            <li><a href="/admin/{client.clock.clockId}/grim" target="_self">Grimoire</a></li>
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
        {#if townSquare && clock}
        <div class="navbar-settings-pane clock-controls-pane">
            <ClockSetter model={clock} {timerOptions}/>
            <a class="remote-link" href="/admin/{clock.id}/remote" target="_blank" rel="noopener">Open remote in its own page ↗</a>
        </div>
        {/if}
        {#if townSquare && audioEngine}
        <div class="navbar-settings-pane">
            <button class="button-style" style="width: 100%; font-size: large; padding: 0.5em 1em;" onclick={() => { showMixer = true; visible = false; }}>
                Audio Mixer
            </button>
        </div>
        {/if}
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
        </div>
        <div class="navbar-settings-pane qr-settings-pane">
            <div style="font-size: smaller; text-align: center;">QR Codes</div>
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">Show Custom QR</div>
                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <input name="autosize" type="checkbox" bind:checked={appSettings.showQRCodes}/>
                </div>
            </div>
            {#if townSquare}
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: smaller; text-align: center;">Script QR</div>
                <select bind:value={appSettings.scriptQrPosition} aria-label="Script QR position">
                    <option value={null}>Off</option>
                    {#each QR_POSITIONS as position}
                        <option value={position}>{QR_POSITION_LABELS[position]}</option>
                    {/each}
                </select>
            </div>
            {/if}
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">QR Size</div>
                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <div>Auto</div>
                    <input name="qrautosize" type="checkbox" bind:checked={appSettings.qrAutoSize}/>
                </div>
            </div>
            {#if !appSettings.qrAutoSize}
            <div style="display: grid; grid-template-columns: 1fr 3.5em; gap: 10px; align-items: center;">
                <HSlider bind:value={appSettings.qrScale} min={0.5} max={2} step={0.05}/>
                <div style="text-align: right;">{Math.round(appSettings.qrScale * 100)}%</div>
            </div>
            {/if}
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

{#if showMixer && audioEngine}
    <div class="mixer-overlay">
        <button class="close-button mixer-close-button" onclick={() => { showMixer = false; }}>X</button>
        <div class="mixer-overlay-scroll">
            <AudioMixer {audioEngine} {ambienceResources} spotify={spotify ?? undefined} {spotifyPresets}/>
        </div>
    </div>
{/if}