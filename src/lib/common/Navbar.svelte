<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { FullDisplayMode } from "./FullDisplay/fullDisplayTypes";
    import { browser } from "$app/environment";
    import HSlider from "./AudioMixerComponents/HSlider.svelte";

    export let clients: { id: string, name: string }[] | undefined = undefined;
    export let visible: boolean = false;

    export let size: number;
    export let displayMode: FullDisplayMode = 'clocktower';

    let storedSize: number;
    let autosize: boolean = true;

    function updateSize(){
        console.log("Updating size, autosize:", autosize);
        size = autosize ? calculateIdealSize() : storedSize;
    }

    onMount(()=>{
        if(browser){
            let storedDisplayMode = localStorage.getItem('displayMode');
            if(storedDisplayMode){
                displayMode = storedDisplayMode as FullDisplayMode;
            }
            
            let storedAutosize = localStorage.getItem('autosize');
            if(storedAutosize){
                autosize = storedAutosize.toUpperCase().startsWith('T');
            }
            if(autosize){
                console.log("Enabling autosize and adding resize listener");
                window.addEventListener('resize', updateSize);
            } else {
                let storedSizeTmp = localStorage.getItem('size');
                if(storedSizeTmp){
                    storedSize = parseFloat(storedSizeTmp);
                }
            }
            console.log("Initial size:", size, "Autosize:", autosize, "Display mode:", displayMode);
            updateSize();
        }

        return ()=>{
            if(browser){
                if(autosize)
                    window.removeEventListener('resize', updateSize);
            }
        }
    });

    function calculateIdealSize(){
        if(browser && displayMode !== undefined){
            let nclients = clients?.length ?? 2;
            switch(displayMode){
                case 'clocktower':
                    return window.innerHeight/1.5;
                case 'original':
                    return Math.min(window.innerWidth/nclients - 30*(nclients-1), window.innerHeight-60) - 30;
                default:
                    return 700;
            }
        } else {
            return 700;
        }
    }

    function saveSize(){
        storedSize = size;
        localStorage.setItem('size', size.toString());
    }

    function saveDisplayMode(){
        console.log("Saving display mode", displayMode);
        localStorage.setItem('displayMode', displayMode);
    }

    function saveAutoSize(){
        console.log("Saving autosize", autosize);
        updateSize();
        localStorage.setItem('autosize', autosize ? 'TRUE' : 'FALSE');
    }

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
        font-size: xx-large;
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

<button aria-label="Menu" class="no-button-style hamburger" on:mouseenter={()=>{visible = true;}} on:click={()=>{visible = true;}} style="position: absolute; top: 10px; left: 10px;">
    <svg width={40} height={40} viewBox="0 0 100 100" style="fill: #FFF6;">
        <rect x={0} y={0} width={100} height={20}/>
        <rect x={0} y={37.5} width={100} height={20}/>
        <rect x={0} y={75} width={100} height={20}/>
    </svg>
</button>

<div class="navbar-main" style="transform: translateX({visible ? "0" : "-100%"});">
    <button on:click={()=>{visible = false;}} class="close-button">
        X
    </button>
    <ul style="list-style-type: none; padding: 0 4em 0 2em; margin: 0; margin-bottom: 1em;">
        <li><a href="/" target="_self">Home</a></li>
        <li>
            <a href="/admin">Admin Panel</a>
            {#if clients !== undefined && clients.length > 0}
            <ul>
                {#each clients as client}
                    <li><a href="/admin/{client.id}" target="_self">{client.name}</a></li>
                {/each}
            </ul>
            {/if}
        </li>
        <li><a href="/admin/mixer">Audio Mixer</a></li>
        {#if clients !== undefined && clients.length > 0}
        <li>
            <div style="opacity: 0.4;">Clocks:</div>
            <ul>
                {#each clients as client}
                    <li><a href="/{client.id}" target="_self">{client.name}</a></li>
                {/each}
            </ul>
        </li>
         {/if}
    </ul>

    <div style="display: grid; gap: 10px;">
        <div class="navbar-settings-pane">
            <div style="display: flex; justify-content: space-between;">
                <div style="font-size: smaller; text-align: center;">Display Size</div>

                <div style="display: flex; gap: 0.5em; align-items: center; font-size: 18px;">
                    <div>Auto</div>
                    <input name="autosize" type="checkbox" bind:checked={autosize} on:change={()=>{saveAutoSize()}}/>
                </div>
            </div>
            {#if !autosize}
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center;">
                <HSlider bind:value={size} max={1400} min={400} onchangefinished={()=>saveSize()}/>
                <button style="display: inline-block;" on:click={()=>{size = calculateIdealSize();}}>Reset</button>
            </div>
            {/if}
        </div>
        <div class="navbar-settings-pane">
            <div style="font-size: smaller; text-align: center;">Display Mode</div>
            <select bind:value={displayMode} on:change={() => saveDisplayMode()} style="width: 100%; font-size: x-large;">
                <option value="original">Original</option>
                <option value="clocktower">Clocktower</option>
            </select>
        </div>
    </div>
</div>