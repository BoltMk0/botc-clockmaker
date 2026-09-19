<script lang="ts">
    import { goto } from "$app/navigation";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    let imageFailed = $state(false);
    const initials = $derived(data.character.name.split(' ').map(word => word[0]?.toUpperCase() ?? '').join(''));
</script>

<style>
    .character-view {
        position: relative;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 2em 1.5em;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.2em;
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

    .character-icon {
        width: min(50vw, 220px);
        height: min(50vw, 220px);
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }

    .character-icon-default {
        width: min(50vw, 220px);
        height: min(50vw, 220px);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 4em;
        background: var(--theme-bg-tertiary);
        flex-shrink: 0;
    }

    h1 {
        margin: 0;
    }

    .description {
        max-width: 32em;
        font-size: 1.2em;
        line-height: 1.4;
        opacity: 0.9;
        white-space: pre-line;
    }
</style>

<div class="character-view">
    <button class="close-btn" onclick={() => goto(`/admin/${data.clockid}/grim`)} aria-label="Close" title="Back to the grim">✕</button>

    {#if !imageFailed}
        <img class="character-icon" src={`/api/characters/${data.character.id}/img`} alt={data.character.name} onerror={() => imageFailed = true} />
    {:else}
        <div class="character-icon-default dumbledore-font">{initials}</div>
    {/if}
    <h1 class="dumbledore-font">{data.character.name}</h1>
    <div class="description">{data.character.rules}</div>
</div>
