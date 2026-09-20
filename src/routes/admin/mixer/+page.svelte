<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import AudioMixer from '$lib/audio/client/components/AudioMixer.svelte';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import type { PageData } from './$types';
    import MuteButton from '$lib/components/MuteButton.svelte';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import { AmbienceEngine } from '$lib/audio/client/AmbienceEngine.svelte';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte';
    import { SpotifyPlayer } from '$lib/audio/client/SpotifyPlayer.svelte';

    let { data }: { data: PageData } = $props();

    let clocks: Clocktower[]|null = $state(null);
    let audioEngine: AudioEngine|null = $state(null);
    let spotify: SpotifyPlayer|null = $state(null);

    onMount(() => {
        if(browser){
            clocks = data.instances.map(model=>new Clocktower(model));

            audioEngine = new AudioEngine(clocks, data.ambienceEngineModel);
            spotify = new SpotifyPlayer();

            // Browsers only let an AudioContext run following a genuine user gesture,
            // so resume it on the first interaction with the page.
            const resumeAudio = () => audioEngine?.resume();
            document.addEventListener('pointerdown', resumeAudio);

            return ()=>{
                document.removeEventListener('pointerdown', resumeAudio);
                clocks?.forEach(c=>c.close());
                audioEngine?.close();
                spotify?.close();
            }
        }
    });

</script>


<TopNavbar/>
{#if clocks && audioEngine}
<div class="mixer-page">
    <AudioMixer {audioEngine} ambienceResources={data.ambienceResources} spotify={spotify ?? undefined}/>
</div>
<MuteButton {audioEngine}/>
{/if}

<style>
    .mixer-page {
        padding-top: 60px; /* clear the absolutely-positioned TopNavbar */
    }
</style>
