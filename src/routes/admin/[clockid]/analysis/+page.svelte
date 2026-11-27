<script lang="ts">
    import { ICON_VIEWBOX, chevronLeftIcon } from "$lib/icons/material.js";
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import PhaseStatsView from '$lib/components/remote/PhaseStatsView.svelte';
    import { Clocktower } from '$lib/model/client/Clocktower.svelte';
    import type { PageData } from './$types';

    // The game's analysis, on its own page (opened from the remote): kept up to date as the game goes on
    let { data }: { data: PageData } = $props();

    let model: Clocktower|null = $state(null);

    onMount(() => {
        if(!browser) return;
        model = new Clocktower(data.model);
        return () => model?.close();
    });
</script>

<svelte:head>
    <title>{data.teamName} Analysis</title>
</svelte:head>

<!-- Scrolls itself, as the other long pages (e.g. Play) do, rather than the layout around it -->
<div class="analysis-page">
    <!-- As the remote page's back link -->
    <a class="back-link" href={data.backUrl} target="_self">
        <svg width={28} height={28} viewBox={ICON_VIEWBOX} fill="currentColor"><path d={chevronLeftIcon}/></svg>
        Remote
    </a>
    <div class="content">
        <h2 class="team-name">{data.teamName} · Analysis</h2>
        {#if model}
        <PhaseStatsView log={model.phaseLog}/>
        {/if}
    </div>
</div>

<style>
    .analysis-page {
        position: relative;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
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

    .team-name {
        text-align: center;
        /* Clear of the back link above it */
        margin: 1.6em 0 0.5em;
        font-weight: normal;
        opacity: 0.8;
    }
</style>
