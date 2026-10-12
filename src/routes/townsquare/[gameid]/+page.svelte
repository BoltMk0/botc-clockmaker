<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { invalidateAll } from '$app/navigation';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import SideMenu from '$lib/components/SideMenu.svelte';
    import type { PageData } from './$types';
    import { browser } from '$app/environment';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte';
    import { SpotifyPlayer } from '$lib/audio/client/SpotifyPlayer.svelte';
    import { MusicPlayer } from '$lib/audio/client/MusicPlayer.svelte';
    import SiteQRCode from '$lib/components/SiteQRCode.svelte';
    import NowPlayingToast from '$lib/audio/client/components/NowPlayingToast.svelte';
    import { appSettings } from '$lib/model/client/appSettings.svelte.js';
    import type { QrCode } from '$lib/resources/server/qrCodes';
    import { QR_POSITIONS, scriptQrCode } from '$lib/resources/common/qrCodes';

    let { data }: { data: PageData } = $props();

    let model: Clocktower|null = $state(null);
    let audioEngine: AudioEngine|null = $state(null);
    let spotify: SpotifyPlayer|null = $state(null);
    let music: MusicPlayer|null = $state(null);
    let qrCodes: QrCode[] = $state([]);
    // The game's script, for the script QR. Starts from the page load and is polled while the QR is shown here,
    // so it follows the grimoire being set up or ended. The 3D display polls the grim itself (see ClocktowerScene).
    // svelte-ignore state_referenced_locally
    let script = $state<{ id: string; name: string } | null>(data.script);
    const showDomScriptQr = $derived(appSettings.scriptQrPosition !== null && appSettings.displayMode !== 'clocktower3d');
    $effect(() => {
        if(!showDomScriptQr) return;
        let cancelled = false;
        async function poll() {
            try {
                const res = await fetch(`/admin/${data.model.clock.clockId}/grim/state`);
                if(cancelled) return;
                const scriptId: string | null = res.ok ? (await res.json()).scriptId ?? null : null;
                if(scriptId === script?.id || cancelled) return;
                if(!scriptId) { script = null; return; }
                const fetched = await fetch(`/api/scripts/${scriptId}`).then(r => r.ok ? r.json() : null);
                if(!cancelled) script = fetched ? { id: fetched.id, name: fetched.name } : null;
            } catch {
                // Ignore transient fetch failures; we'll just try again next tick.
            }
        }
        poll();
        const interval = setInterval(poll, 5000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    });

    // The script QR joins the feedback codes so codes that share a position stack in one panel.
    const shownQrCodes = $derived([
        ...(appSettings.showQRCodes ? qrCodes : []),
        ...(script && appSettings.scriptQrPosition ? [scriptQrCode(script, appSettings.scriptQrPosition)] : []),
    ]);

    // When the audio engine is turned off in the menu, nothing plays here (or loads) and the mixer only acts as a remote.
    let audioSetUpFor: boolean|null = null; // Whether the audio was last set up enabled; null before it first is
    let audioGeneration = 0;

    async function setUpAudio(clock: Clocktower, enabled: boolean, refresh: boolean){
        const generation = ++audioGeneration;
        tearDownAudio();
        // The mixer's shared state may have moved on since the page loaded
        if(refresh) await invalidateAll();
        if(generation !== audioGeneration) return; // Toggled again while refreshing
        const remoteOnly = !enabled;
        audioEngine = new AudioEngine([clock], data.ambienceEngineModel, data.stingEngineModel, { silent: remoteOnly });
        spotify = new SpotifyPlayer({ remoteOnly });
        music = new MusicPlayer({ remoteOnly, output: audioEngine.input });
    }

    function tearDownAudio(){
        music?.close(); // Before the engine: it plays through the engine's audio context
        audioEngine?.close();
        spotify?.close();
        music = null;
        audioEngine = null;
        spotify = null;
    }

    $effect(() => {
        const enabled = appSettings.audioEngineEnabled;
        if(!model || enabled === audioSetUpFor) return;
        const refresh = audioSetUpFor !== null;
        audioSetUpFor = enabled;
        const clock = model;
        untrack(() => setUpAudio(clock, enabled, refresh));
    });

    onMount(() => {
        if(!browser) return;
        model = new Clocktower(data.model);

        // Browsers only let an AudioContext run following a genuine user gesture,
        // so resume it on the first interaction with the page.
        const resumeAudio = () => audioEngine?.resume();
        document.addEventListener('pointerdown', resumeAudio);

        fetch('/api/qrCodes').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
            qrCodes = d;
        }).catch(() => {});
        return ()=>{
            document.removeEventListener('pointerdown', resumeAudio);
            audioGeneration++; // Drops a set up still waiting on its refresh
            tearDownAudio();
            model?.close();
        }
    });


</script>

{#if model}
<FullDisplay model={model}/>
{/if}

<SideMenu townSquare clock={model} {audioEngine} ambienceResources={data.ambienceResources} {spotify} spotifyPresets={data.spotifyPresets} {music} musicPresets={data.musicPresets}/>
<NowPlayingToast {spotify} {music}/>

{#if shownQrCodes.length > 0 && appSettings.displayMode !== 'clocktower3d'}
{#each QR_POSITIONS as pos}
    {@const group = shownQrCodes.filter(c => c.position === pos)}
    {#if group.length > 0}
    <div class="qr-codes-panel {pos}">
        {#each group as code}
            <SiteQRCode path={code.url} title={code.title} size={8 * appSettings.qrSizeScale}/>
        {/each}
    </div>
    {/if}
{/each}
{/if}

<style>
    .qr-codes-panel {
        position: absolute;
        z-index: 10;
        display: flex;
        flex-direction: row;
        gap: 0.75rem;
    }

    .qr-codes-panel.left,
    .qr-codes-panel.right {
        flex-direction: column;
        top: 50%;
        transform: translateY(-50%);
    }

    .qr-codes-panel.top,
    .qr-codes-panel.bottom {
        left: 50%;
        transform: translateX(-50%);
    }

    .qr-codes-panel.top-left,
    .qr-codes-panel.top,
    .qr-codes-panel.top-right {
        top: 1rem;
    }

    .qr-codes-panel.bottom-left,
    .qr-codes-panel.bottom,
    .qr-codes-panel.bottom-right {
        bottom: 1rem;
    }

    .qr-codes-panel.top-left,
    .qr-codes-panel.left,
    .qr-codes-panel.bottom-left {
        left: 1rem;
    }

    .qr-codes-panel.top-right,
    .qr-codes-panel.right,
    .qr-codes-panel.bottom-right {
        right: 1rem;
    }
</style>

