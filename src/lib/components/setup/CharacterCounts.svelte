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

<div>
    {#each (reversed ? rows.toReversed() : rows) as [label, key], i}
        {#if i > 0}, {/if}{builder.expectedCounts[key]} {label}
    {/each}
</div>
