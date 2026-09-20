<script lang="ts">
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    let { builder }: { builder: PresetBuilder } = $props();

    const rows = $derived([
        ['Townsfolk', 'townsfolk'],
        ['Outsiders', 'outsiders'],
        ['Minions', 'minions'],
        ['Demons', 'demons']
    ] as const);
</script>

<div>
    {#each rows as [label, key], i}
        {#if i > 0}, {/if}{builder.expectedCounts[key]} {label}
    {/each}
</div>
