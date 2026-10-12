<script lang="ts">
    import { goto } from "$app/navigation";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<style>
    .bluffs-view {
        position: relative;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 2em 1em;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2em;
        text-align: center;
        overflow-y: auto;
    }

    .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        font-size: 1.1em;
        line-height: 1;
        cursor: pointer;
        touch-action: manipulation;
    }

    h1 {
        margin: 0;
    }

    .bluff-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 1.5em;
    }
</style>

<div class="bluffs-view">
    <button class="close-btn" onclick={() => goto(`/admin/${data.clockid}/grim`)} aria-label="Close" title="Back to the grim">✕</button>

    <h1 class="dumbledore-font">These roles are not in play</h1>

    <div class="bluff-row">
        {#each data.bluffs as character (character.id)}
            <div style="position: relative; width: min(26vw, 200px); height: min(26vw, 200px);">
                <CharacterToken {character} style="position: relative;" size="min(26vw, 200px)" norules/>
            </div>
        {/each}
    </div>
</div>
