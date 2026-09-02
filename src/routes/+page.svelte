<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte.js';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte.js';
    import SiteQRCode from '$lib/components/SiteQRCode.svelte';
    import { appSettings } from '$lib/model/client/appSettings.svelte.js';
    import type { QrCode } from '$lib/resources/server/qrCodes';

    let {
        data
    } = $props();

    const clocks = $derived(browser ? data.instances.map(i=>new Clocktower(i)): undefined);
    let audioEngine: AudioEngine|null = $state(null);
    let qrCodes: QrCode[] = $state([]);

    onMount(() => {
        if(browser && clocks){
            audioEngine = new AudioEngine(clocks)
        }

        // Browsers only let an AudioContext run following a genuine user gesture,
        // so resume it on the first interaction with the page.
        const resumeAudio = () => audioEngine?.resume();
        document.addEventListener('pointerdown', resumeAudio);

        fetch('/api/qrCodes').then(r => r.ok ? r.json() : Promise.reject()).then(data => {
            qrCodes = data;
        }).catch(() => {});

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

{#if appSettings.showQRCodes && qrCodes.length > 0}
<div class="qr-codes-panel left">
    {#each qrCodes.filter((_, i) => i % 2 === 0) as code}
        <SiteQRCode path={code.url} title={code.title}/>
    {/each}
</div>
<div class="qr-codes-panel right">
    {#each qrCodes.filter((_, i) => i % 2 === 1) as code}
        <SiteQRCode path={code.url} title={code.title}/>
    {/each}
</div>
{/if}
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

    .qr-codes-panel {
        position: absolute;
        bottom: 1rem;
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .qr-codes-panel.left {
        left: 1rem;
    }

    .qr-codes-panel.right {
        right: 1rem;
    }
</style>
