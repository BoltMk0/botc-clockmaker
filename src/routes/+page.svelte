<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import MuteButton from '$lib/components/MuteButton.svelte';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte.js';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte.js';
    import FeedbackQRCode from '$lib/components/FeedbackQRCode.svelte';

    let {
        data
    } = $props();

    const clocks = $derived(browser ? data.instances.map(i=>new Clocktower(i)): undefined);
    let audioEngine: AudioEngine|null = $state(null);

    onMount(() => {
        if(browser && clocks){
            audioEngine = new AudioEngine(clocks)
        }

        // Browsers only let an AudioContext run following a genuine user gesture,
        // so resume it on the first interaction with the page.
        const resumeAudio = () => audioEngine?.resume();
        document.addEventListener('pointerdown', resumeAudio);

        return ()=>{
            console.log("Closing...");
            document.removeEventListener('pointerdown', resumeAudio);
            audioEngine?.close();
            if(clocks){
                for(const c of clocks){
                    c.close();
                }
            }
        }
    });

</script>

<div class="clock-container" style="grid-template-columns: repeat({clocks?.length} 1fr);">
    {#each clocks as clock, index (clock.id)}
        <FullDisplay model={clock} models={clocks}/>
    {/each}
</div>

<Navbar/>
<FeedbackQRCode/>

<!-- {#if audioEngineInstance}
<MuteButton audioEngine={audioEngineInstance}/>
{/if} -->

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
</style>
