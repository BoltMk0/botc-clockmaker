<script lang="ts">
    import { ICON_VIEWBOX, chevronLeftIcon } from "$lib/icons/material.js";
    import { goto } from '$app/navigation';
    import PhaseStatsView from '$lib/components/remote/PhaseStatsView.svelte';
    import { snapshotViewProps } from '$lib/resources/common/presetPlays';
    import type { PageData } from './$types';

    // A logged game's timing stats, as the analysis showed them when the game ended, on their own page (opened from its
    // grim snapshot), as the live game's analysis is
    let { data }: { data: PageData } = $props();

    const title = $derived(snapshotViewProps(data.play).title);

    function onkeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') goto(data.backUrl);
    }
</script>

<svelte:head>
    <title>Timing · {title}</title>
</svelte:head>

<svelte:window {onkeydown}/>

<!-- Scrolls itself, as the other long pages (e.g. Play) do, rather than the layout around it -->
<div class="stats-page">
    <!-- As the analysis page's back link -->
    <a class="back-link" href={data.backUrl}>
        <svg width={28} height={28} viewBox={ICON_VIEWBOX} fill="currentColor"><path d={chevronLeftIcon}/></svg>
        Grim
    </a>
    <div class="content">
        <h2 class="title">{title}</h2>
        <PhaseStatsView log={data.phaseLog} ended/>
    </div>
</div>

<style>
    .stats-page {
        position: relative;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        color: var(--theme-on-bg);
    }

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

    .content {
        padding: 20px 16px;
        box-sizing: border-box;
        font-size: large;
    }

    .title {
        text-align: center;
        /* Clear of the back link above it */
        margin: 1.6em 0 0.5em;
        font-size: 1.1em;
        font-weight: normal;
        opacity: 0.8;
    }
</style>
