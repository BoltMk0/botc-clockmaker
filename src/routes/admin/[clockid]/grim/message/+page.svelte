<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const title = $derived(page.url.searchParams.get('title') ?? '');
    const subtitle = $derived(page.url.searchParams.get('subtitle') ?? '');
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

    h1 {
        margin: 0;
        font-size: 3em;
    }

    p {
        margin: 0;
        font-size: 1.5em;
    }
</style>

<div class="message-view">
    <button class="close-btn" onclick={() => goto(`/admin/${data.clockid}/grim`)} aria-label="Close" title="Back to the grim">✕</button>

    <h1 class="dumbledore-font">{title}</h1>
    {#if data.character}
        <div style="position: relative; width: min(40vw, 240px); height: min(40vw, 240px);">
            <CharacterToken character={data.character} style="position: relative;" size="min(40vw, 240px)" norules/>
        </div>
    {/if}
    {#if subtitle}
        <p>{subtitle}</p>
    {/if}
    {#if data.subtitleCharacter}
        <div style="position: relative; width: min(40vw, 240px); height: min(40vw, 240px);">
            <CharacterToken character={data.subtitleCharacter} style="position: relative;" size="min(40vw, 240px)" norules/>
        </div>
    {/if}
</div>
