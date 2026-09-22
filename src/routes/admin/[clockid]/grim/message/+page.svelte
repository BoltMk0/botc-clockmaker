<script lang="ts">
    import { goto } from "$app/navigation";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<style>
    .message-view {
        position: relative;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 2em 1em;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1em;
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

    .character-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 1em;
    }

    .character-slot {
        position: relative;
        width: min(40vw, 240px);
        height: min(40vw, 240px);
    }

    p {
        margin: 0;
        font-size: 1.5em;
    }

    p.title {
        font-size: 3em;
    }
</style>

<div class="message-view">
    <button class="close-btn" onclick={() => goto(`/admin/${data.clockid}/grim`)} aria-label="Close" title="Back to the grim">✕</button>

    {#each data.fields as field, i}
        {#if field.type === 'text'}
            {#if field.value}
                <p class="dumbledore-font" class:title={i === 0}>{field.value}</p>
            {/if}
        {:else}
            <div class="character-row">
                {#each field.value as characterId}
                    {#if characterId && data.characters[characterId]}
                        <div class="character-slot">
                            <CharacterToken character={data.characters[characterId]} style="position: relative;" size="min(40vw, 240px)" norules/>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    {/each}
</div>
