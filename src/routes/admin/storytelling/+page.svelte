<script lang="ts">
    import Navbar from '$lib/components/Navbar.svelte';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    let { data }: { data: { instances: ClocktowerModel[] } } = $props();
</script>

<Navbar/>

<div class="storytelling">
    <div class="storytelling-header">
        <a class="storytelling-back" href="/">&larr; Back</a>
        <div class="storytelling-title dumbledore-font">Storytelling</div>
    </div>

    <div class="storytelling-section">
        <div class="storytelling-section-title">Game Control</div>
        {#if data.instances.length === 0}
            <div class="storytelling-empty">No games yet - create one from Town Square first.</div>
        {:else}
            <div class="game-list">
                {#each data.instances as instance (instance.clock.clockId)}
                    <a class="game-row" href="/admin/{instance.clock.clockId}">
                        <span>{instance.config.teamName ?? instance.clock.clockId}</span>
                        <span class="game-row-arrow">Remote &rarr;</span>
                    </a>
                {/each}
            </div>
        {/if}
    </div>

    <div class="storytelling-section">
        <div class="storytelling-section-title">Other</div>
        <a class="button-style full-width-row" href="/admin/mixer">Audio Mixer</a>
    </div>
</div>

<style>
    .storytelling {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 90px 2em 2em;
        overflow: auto;
        color: var(--theme-on-bg);
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .storytelling-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75em;
        margin-bottom: 1.5em;
        width: 100%;
        max-width: 400px;
    }

    .storytelling-back {
        align-self: start;
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
        font-size: large;
    }

    .storytelling-back:hover {
        opacity: 1;
    }

    .storytelling-title {
        font-size: 2em;
        opacity: 0.9;
    }

    .storytelling-empty {
        opacity: 0.7;
    }

    .storytelling-section {
        display: flex;
        flex-direction: column;
        gap: 0.6em;
        width: 100%;
        max-width: 400px;
        margin-bottom: 1.5em;
    }

    .storytelling-section-title {
        font-size: large;
        opacity: 0.6;
    }

    .game-list {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        width: 100%;
    }

    .full-width-row {
        width: 100%;
        box-sizing: border-box;
        padding: 0.8em 1em;
        font-size: large;
        text-align: center;
    }

    .game-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1em;
        padding: 0.8em 1em;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg);
        border-radius: 0.5em;
        text-decoration: none;
        font-size: large;
    }

    .game-row:hover {
        background-color: var(--theme-bg-tertiary);
    }

    .game-row-arrow {
        opacity: 0.7;
        font-size: medium;
    }
</style>
