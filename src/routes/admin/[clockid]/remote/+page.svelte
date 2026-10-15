<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import ClockSetter from '$lib/components/ClockSetter.svelte';
    import ShareLink from '$lib/components/remote/ShareLink.svelte';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import type { PageData } from './$types';

    // A standalone clock remote: just the timer controls for one game, e.g. for a phone the storyteller keeps in hand.
    let { data }: { data: PageData } = $props();

    let model: Clocktower|null = $state(null);

    onMount(() => {
        if(!browser) return;
        model = new Clocktower(data.model);
        return () => {
            model?.close();
        }
    });

    // This page, for another device: without the back link, which is about where this device came from
    const shareUrl = $derived(new URL(page.url.pathname, page.url.origin).href);

    // The mixer as a remote control only (no sound plays on this device), with a way back to this page
    function openMixer(){
        goto(`/admin/mixer?remote_only=1&back_uri=${encodeURIComponent(location.pathname + location.search)}`);
    }
</script>

<svelte:head>
    <title>{data.teamName} Remote</title>
</svelte:head>

<a class="back-link" href={data.backUrl ?? `/townsquare/${data.model.clock.clockId}`} target="_self">
    <svg width={28} height={28} viewBox="0 0 24 24" style="fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M15 5l-7 7 7 7" />
    </svg>
    {data.backUrl ? 'Back' : 'Town Square'}
</a>

<ShareLink url={shareUrl} title="Open this remote on another device" style="position: absolute; top: 8px; right: 10px;"/>

<div class="remote-page">
    <h2 class="team-name">{data.teamName}</h2>
    {#if model}
    <ClockSetter {model} timerOptions={data.timerOptions} musicPresets={data.musicPresets} spotifyPresets={data.spotifyPresets} onmixer={openMixer}/>
    {/if}
</div>

<style>
    .back-link {
        position: absolute;
        top: 12px;
        left: 14px;
        display: flex;
        align-items: center;
        gap: 0.2em;
        font-size: large;
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
    }

    .back-link:hover {
        opacity: 1;
    }

    .remote-page {
        padding: 20px 16px;
        box-sizing: border-box;
        font-size: large;
    }

    .team-name {
        text-align: center;
        margin: 0 0 0.5em;
        font-weight: normal;
        opacity: 0.8;
    }
</style>
