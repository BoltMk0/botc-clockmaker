<script lang="ts">
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    let { builder, reversed = false }: { builder: PresetBuilder; reversed?: boolean } = $props();

    const rows = $derived([
        ['Townsfolk', 'townsfolk'],
        ['Outsiders', 'outsiders'],
        ['Minions', 'minions'],
        ['Demons', 'demons']
    ] as const);
</script>

<style>
    .counts {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 0.5em 1em;
    }

    .count {
        white-space: nowrap;
    }

    .fraction {
        font-size: 1.5em;
        font-weight: 600;
        margin-right: 0.2em;
    }
</style>

<div class="counts">
    {#each (reversed ? rows.toReversed() : rows) as [label, key]}
        <span class="count"><span class="fraction">{builder.currentCounts[key]}/{builder.expectedCounts[key]}</span> {label}</span>
    {/each}
</div>
