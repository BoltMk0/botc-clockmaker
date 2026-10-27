<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import ChalkboardButton from "$lib/components/ChalkboardButton.svelte";
    import MessageText from "$lib/components/MessageText.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // Several messages (from the communications queue) are shown one at a time: a tap goes to the next, and after
    // the last back to the first, until the page is closed.
    // svelte-ignore state_referenced_locally
    let index = $state(data.start);
    const elements = $derived(data.messages[index] ?? []);
    const several = $derived(data.messages.length > 1);

    // Back to this message from the chalkboard
    const returnTo = $derived.by(() => {
        const params = new URLSearchParams(page.url.searchParams);
        params.set('i', String(index));
        return `${page.url.pathname}?${params}`;
    });

    function next(e: MouseEvent) {
        if (!several || (e.target as Element).closest('button')) return;
        index = (index + 1) % data.messages.length;
    }
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
        background: #121212;
    }

    .message-view.several {
        cursor: pointer;
        user-select: none;
    }

    .position {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        opacity: 0.5;
    }

    .close-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        /* Light, so it shows against the dark page. */
        background: rgba(255, 255, 255, 0.15);
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
        white-space: pre-line;
    }

    p.header {
        font-size: 3em;
    }

    .alignment {
        font-size: 4em;
        font-weight: bold;
        letter-spacing: 0.08em;
    }

    .alignment.good {
        color: #558bdf;
    }

    .alignment.evil {
        color: #ca4444;
    }
</style>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="message-view" class:several onclick={next}>
    <ChalkboardButton clockid={data.clockid} {returnTo}/>
    <button class="close-btn" onclick={() => goto(`/admin/${data.clockid}/grim`)} aria-label="Close" title="Back to the grim">✕</button>

    {#each elements as element}
        {#if element.type === 'text'}
            {#if element.value}
                <p class:dumbledore-font={element.style === 'Header'} class:header={element.style === 'Header'}><MessageText text={element.value}/></p>
            {/if}
        {:else if element.type === 'character'}
            <div class="character-row">
                {#each element.value as characterId}
                    {#if data.characters[characterId]}
                        <div class="character-slot">
                            <CharacterToken character={data.characters[characterId]} style="position: relative;" size="min(40vw, 240px)" norules/>
                        </div>
                    {/if}
                {/each}
            </div>
        {:else}
            <div class="alignment dumbledore-font {element.value}">{element.value === 'good' ? 'GOOD' : 'EVIL'}</div>
        {/if}
    {/each}

    {#if several}
        <div class="position">{index + 1} / {data.messages.length}</div>
    {/if}
</div>
