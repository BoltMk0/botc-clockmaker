<script lang="ts">
    import { onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import SideMenu from '$lib/components/SideMenu.svelte';
    import type { PageData } from './$types';
    import { browser } from '$app/environment';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import { AudioEngine } from '$lib/audio/client/AudioEngine.svelte';
    import SiteQRCode from '$lib/components/SiteQRCode.svelte';
    import { appSettings } from '$lib/model/client/appSettings.svelte.js';
    import type { QrCode } from '$lib/resources/server/qrCodes';
    import { QR_POSITIONS } from '$lib/resources/common/qrCodes';

    let { data }: { data: PageData } = $props();

    let model: Clocktower|null = $state(null);
    let audioEngine: AudioEngine|null = $state(null);
    let qrCodes: QrCode[] = $state([]);
    onMount(() => {
        if(!browser) return;
        model = new Clocktower(data.model);
        audioEngine = new AudioEngine([model]);

        // Browsers only let an AudioContext run following a genuine user gesture,
        // so resume it on the first interaction with the page.
        const resumeAudio = () => audioEngine?.resume();
        document.addEventListener('pointerdown', resumeAudio);

        fetch('/api/qrCodes').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
            qrCodes = d;
        }).catch(() => {});
        return ()=>{
            document.removeEventListener('pointerdown', resumeAudio);
            audioEngine?.close();
            model?.close();
        }
    });


</script>

{#if model}
<FullDisplay model={model}/>
{/if}

<SideMenu townSquare {audioEngine}/>

{#if appSettings.showQRCodes && qrCodes.length > 0}
{#each QR_POSITIONS as pos}
    {@const group = qrCodes.filter(c => c.position === pos)}
    {#if group.length > 0}
    <div class="qr-codes-panel {pos}">
        {#each group as code}
            <SiteQRCode path={code.url} title={code.title}/>
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

