<script lang="ts">
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    let { builder }: { builder: PresetBuilder } = $props();
</script>

<style>
    .sorter {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
    }
    .sorter-group {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
    }
    .sorter-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4em;
        min-height: 80px;
        padding: 0.5em;
        border-radius: 0.8em;
        background: var(--theme-bg);
    }
    .sorter-token {
        position: relative;
        width: 80px;
        height: 80px;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
    }
    .status {
        font-size: 0.9em;
    }
    .status.bad {
        color: #f59e0b;
    }
    .empty {
        align-self: center;
        opacity: 0.5;
        font-style: italic;
    }
</style>

<div class="sorter">
    <div>
        There {builder.surplusCount === 1 ? 'is' : 'are'} {builder.surplusCount} more token{builder.surplusCount === 1 ? '' : 's'} than players.
        Click tokens to move them between the bag and the grim.
    </div>
    <div class="sorter-group">
        <strong>In the bag ({builder.bagCharacterIds.length}/{builder.playerCount})</strong>
        <div class="sorter-tokens">
            {#each builder.bagCharacterIds as id, i (id + i)}
                {@const character = builder.charById.get(id)}
                {#if character}
                    <button class="sorter-token" title="Move {character.name} to the grim" onclick={() => builder.moveToGrim(id)}>
                        <CharacterToken {character} size="80px" norules style="position: relative;" />
                    </button>
                {/if}
            {/each}
        </div>
    </div>
    <div class="sorter-group">
        <strong>On the grim ({builder.grimCharacterIds.length}/{builder.surplusCount})</strong>
        <div class="sorter-tokens">
            {#each builder.grimCharacterIds as id, i (id + i)}
                {@const character = builder.charById.get(id)}
                {#if character}
                    <button class="sorter-token" title="Move {character.name} to the bag" onclick={() => builder.moveToBag(id)}>
                        <CharacterToken {character} size="80px" norules style="position: relative;" />
                    </button>
                {/if}
            {:else}
                <span class="empty">No tokens on the grim</span>
            {/each}
        </div>
    </div>
    {#if !builder.isSorted}
        <div class="status bad">
            ⚠ The bag needs exactly {builder.playerCount} token{builder.playerCount === 1 ? '' : 's'}
            ({builder.bagCharacterIds.length > (builder.playerCount ?? 0) ? 'move some to the grim' : 'move some back to the bag'}).
        </div>
    {/if}
</div>
