<script lang="ts">
    import { browser } from '$app/environment';
    import { ClientModel } from '$lib/client/model.js';
    import { onDestroy, onMount } from 'svelte';
    import ChannelStrip from './admin/mixer/ChannelStrip.svelte';
    import FullDisplay from '$lib/common/FullDisplay/FullDisplay.svelte';
    import AmbienceChannelStrip from './admin/mixer/AmbienceChannelStrip.svelte';

    export let data;

    $: models = browser ? data.instances.map(({id, config}) => new ClientModel(id, config)) : [];
    let audioContext: AudioContext | null = null;
    let showMixer: boolean = false;
    let audioUnlocked = false;

    async function unlockAudio() {
        if (!browser || audioUnlocked || !audioContext) return;
        try {
            if (audioContext.state !== 'running') {
                await audioContext.resume();
            }
            // Some browsers are happier if something touches the graph after resume.
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            gain.gain.value = 0;
            osc.connect(gain).connect(audioContext.destination);
            osc.start();
            osc.stop(audioContext.currentTime + 0.01);
            audioUnlocked = true;
        } catch (err) {
            console.warn('Audio unlock failed (likely autoplay policy).', err);
        }
    }

    onMount(() => {
        if(browser){
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            // Edge/Chromium often requires a user gesture before audio will play.
            window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
            window.addEventListener('keydown', unlockAudio, { once: true, capture: true });
            window.addEventListener('click', unlockAudio, { once: true, capture: true });
        }
    });

    onDestroy(()=>{
        models.forEach(model => model.close());
        audioContext?.close();
    })
</script>

<div class="clock-container">
    {#each models as model, index (model.clockId)}
        <div style="">
            <FullDisplay model={model} models={models}/>
        </div>
    {/each}
</div>

<div class="mixer-container" style="height: {showMixer ? "500px":"0"}">
    <div style="display: flex; gap: 5px; height: fit-content;">
        
    {#if audioContext}
        {#each models as model, index (model.clockId)}
            <div style="">
                <ChannelStrip audioContext={audioContext} clientModel={model} />
            </div>
        {/each}
        <AmbienceChannelStrip context={audioContext} resources={data.ambienceResources}/>
    {/if}
    
    </div>
</div>

<div class="settings-button-container">
    <button on:click={() => { showMixer = !showMixer; }}>
        {showMixer ? "Hide Mixer" : "Show Mixer"}
    </button>
</div>

<style>
    .mixer-container {
        position: absolute;
        bottom: 0;
        overflow: hidden;
        transition: height 0.5s ease;
    }

    .clock-container{
        display: flex;
        width: 100%;
        gap: 10px;
        padding: 5px;
        justify-content: space-evenly;
        box-sizing: border-box;
    }

    .settings-button-container {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 5px;
        opacity: 0;
        transition: opacity 0.3s ease;
        cursor: pointer;
        padding: 5px;
    }

    .settings-button-container:hover {
        opacity: 1;
    }

    .settings-button-container button {
        padding: 10px;
        font-size: inherit;
        border-radius: 5px;
        border: none;
        background-color: #444;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
    }
</style>

<svelte:body on:click={()=>{}}/>