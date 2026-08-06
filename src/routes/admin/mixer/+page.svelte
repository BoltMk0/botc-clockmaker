<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import AudioMixer from '$lib/audio/client/components/AudioMixer.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { PageData } from './$types';
    import MuteButton from '$lib/components/MuteButton.svelte';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import { AmbienceEngine } from '$lib/audio/client/AmbienceEngine.svelte';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte';

    let { data }: { data: PageData } = $props();

    let clocks: Clocktower[]|null = $state(null);
    let audioEngine: AudioEngine|null = $state(null);
    
    onMount(() => {
        if(browser){
            clocks = data.instances.map(model=>new Clocktower(model));

            audioEngine = new AudioEngine(clocks, data.ambienceEngineModel);

            // Browsers only let an AudioContext run following a genuine user gesture,
            // so resume it on the first interaction with the page.
            const resumeAudio = () => audioEngine?.resume();
            document.addEventListener('pointerdown', resumeAudio);

            return ()=>{
                document.removeEventListener('pointerdown', resumeAudio);
                clocks?.forEach(c=>c.close());
                audioEngine?.close();
            }
        }
    });

</script>


<Navbar/>
{#if clocks && audioEngine}
<AudioMixer {audioEngine} ambienceResources={data.ambienceResources}/>
<MuteButton {audioEngine}/>
{/if}