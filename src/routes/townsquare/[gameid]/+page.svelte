<script lang="ts">
    import { onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { PageData } from './$types';
    import { browser } from '$app/environment';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import SiteQRCode from '$lib/components/SiteQRCode.svelte';
    import { appSettings } from '$lib/model/client/appSettings.svelte.js';
    import type { QrCode } from '$lib/resources/server/qrCodes';

    let { data }: { data: PageData } = $props();

    let model: Clocktower|null = $state(null);
    let qrCodes: QrCode[] = $state([]);
    onMount(() => {
        if(!browser) return;
        model = new Clocktower(data.model);
        fetch('/api/qrCodes').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
            qrCodes = d;
        }).catch(() => {});
        return ()=>{
            model?.close();
        }
    });


</script>

{#if model}
<FullDisplay model={model}/>
{/if}

<Navbar townSquare/>

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

<style>
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

