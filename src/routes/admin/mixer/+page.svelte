<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/state';
    import AudioMixer from '$lib/audio/client/components/AudioMixer.svelte';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import type { PageData } from './$types';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import { AmbienceEngine } from '$lib/audio/client/AmbienceEngine.svelte';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte';
    import { SpotifyPlayer } from '$lib/audio/client/SpotifyPlayer.svelte';

    let { data }: { data: PageData } = $props();

    let clocks: Clocktower[]|null = $state(null);
    let audioEngine: AudioEngine|null = $state(null);
    let spotify: SpotifyPlayer|null = $state(null);
    /** ?remote_only: this client only controls the shared mixer; nothing plays on it. */
    let remoteOnly = $state(false);

    onMount(() => {
        if(browser){
            clocks = data.instances.map(model=>new Clocktower(model));

            const param = page.url.searchParams.get('remote_only');
            remoteOnly = param !== null && param !== '0' && param !== 'false';

            audioEngine = new AudioEngine(clocks, data.ambienceEngineModel, data.stingEngineModel, {silent: remoteOnly});
            spotify = new SpotifyPlayer({remoteOnly});

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
    {#if remoteOnly}
    <div class="remote-only-note">Remote only: no sound plays on this device.</div>
    {/if}
    <AudioMixer {audioEngine} ambienceResources={data.ambienceResources} spotify={spotify ?? undefined} spotifyPresets={data.spotifyPresets}/>
</div>
{/if}

<style>
    .remote-only-note {
        text-align: center;
        font-size: 0.85em;
        opacity: 0.6;
        margin-bottom: 8px;
    }

    .mixer-page {
        padding-top: 60px; /* clear the absolutely-positioned TopNavbar */
        width: 100%;
        box-sizing: border-box;
        /* The mixer is wider than a phone. The root layout only allows vertical touch panning (pan-y), so this
           container has to be its own horizontal scroller that allows it. */
        overflow-x: auto;
        touch-action: pan-x pan-y;
    }
</style>
