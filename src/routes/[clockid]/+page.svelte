<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import { page } from '$app/state';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { FullDisplayMode } from '$lib/components/FullDisplay/fullDisplayTypes.js';
    import { browser } from '$app/environment';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/engine/AudioEngine.svelte.js';

    export let data;

    let enterButtonClicked: boolean =  true;
    let audioContext: AudioContext;
    let audioEngine: ClocktowerAudioEngine;
    let model: ClockClientModel = new ClockClientModel(page.params.clockid, data.config, data.config.audioParams);

    let displaySize = 700;
    let displayMode: FullDisplayMode = "original";

    onMount(()=>{
        model.init();
    });

    function onEnterButtonClicked() {
        console.log("Enter button clicked");
    }

    onMount(() => {
        if(browser){
            model.init();
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioEngine = new ClocktowerAudioEngine(audioContext);
            audioEngine.getClockTrackModelFor(model);
        }
    });

    onDestroy(()=>{
        model.close();
    });

</script>
{#if enterButtonClicked}
<FullDisplay model={model} size={displaySize} type={displayMode}/>
{:else}
    <button on:click={() => { enterButtonClicked = true; onEnterButtonClicked(); }}>
        Enter
    </button>
{/if}
<Navbar bind:size={displaySize} bind:displayMode={displayMode}/>


