<script lang="ts">
    import { browser } from '$app/environment';
    import { ClockClientModel } from '$lib/client/model.js';
    import { onDestroy, onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { FullDisplayMode } from '$lib/components/FullDisplay/fullDisplayTypes.js';

    export let data;

    $: clients = browser ? data.instances.map(({id, config}) => new ClockClientModel(id, config)) : [];
    $: clients?.forEach(client => {
        client.init(undefined);
    });
    let audioContext: AudioContext | null = null;
    

    let showNavbar: boolean = false;

    let audioUnlocked = false;

    let displaySize: number;
    
    let displayMode: FullDisplayMode;

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
        clients.forEach(model => model.close());
        audioContext?.close();
    })
</script>

<div class="clock-container" style="grid-template-columns: repeat({clients.length} 1fr);">
    {#each clients as model, index (model.clockId)}
        <FullDisplay model={model} models={clients} bind:size={displaySize} type={displayMode}/>
    {/each}
</div>

<Navbar bind:size={displaySize} bind:displayMode={displayMode} visible={showNavbar}></Navbar>
    
<style>
    .clock-container{
        display: flex;
        width: 100%;
        height: 100%;
        gap: 10px;
        padding: 5px;
        justify-content: space-evenly;
        box-sizing: border-box;
    }

    .navbar-hamburger-container {
        position: absolute;
        top: 10px; left: 10px;
    }
</style>
