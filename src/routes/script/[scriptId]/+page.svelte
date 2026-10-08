<script lang="ts">
    import { page } from '$app/state';
    import { tick } from 'svelte';
    import CharacterThumb from '$lib/components/CharacterThumb.svelte';
    import SiteQRCode from '$lib/components/SiteQRCode.svelte';
    import { CHARACTER_CATEGORY_COLORS, type Character, type CharacterCategory } from '$lib/resources/common/gameData';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    const SECTIONS: { category: CharacterCategory; title: string }[] = [
        { category: 'townsfolk', title: 'Townsfolk' },
        { category: 'outsider', title: 'Outsiders' },
        { category: 'minion', title: 'Minions' },
        { category: 'demon', title: 'Demons' },
    ];

    const sections = $derived(SECTIONS.map(section => ({
        ...section,
        characters: data.script.characters
            .filter(c => c.category === section.category)
            .sort((a, b) => a.name.localeCompare(b.name)),
    })));

    // Characters the viewer has tapped to highlight. Kept in this browser only, per script, so a refresh keeps them.
    const storageKey = $derived(`script-viewer-highlighted:${data.script.id}`);
    let highlightedIds = $state(new Set<string>());

    $effect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
            highlightedIds = new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
        } catch {
            highlightedIds = new Set();
        }
    });

    let scroller = $state<HTMLElement>();

    // The character's card in its own category section, which stays put whether or not it's highlighted.
    function sectionCard(character: Character): HTMLElement | null {
        return scroller?.querySelector(`[data-section-card="${CSS.escape(character.id)}"]`) ?? null;
    }

    // Highlighting grows or shrinks the Highlighted section at the top, which would push everything below it up
    // or down. Scroll by the same amount so the character's card stays where it was on screen.
    async function toggleHighlight(character: Character) {
        const topBefore = sectionCard(character)?.getBoundingClientRect().top;
        const next = new Set(highlightedIds);
        next.has(character.id) ? next.delete(character.id) : next.add(character.id);
        highlightedIds = next;
        try {
            localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
            // Storage can be unavailable (e.g. private browsing); highlights then last until the page is left.
        }
        await tick();
        const topAfter = sectionCard(character)?.getBoundingClientRect().top;
        if (scroller && topBefore !== undefined && topAfter !== undefined) {
            scroller.scrollTop += topAfter - topBefore;
        }
    }

    // In the same order as the sections below.
    const highlighted = $derived(sections.flatMap(s => s.characters).filter(c => highlightedIds.has(c.id)));

    let showQr = $state(false);

    // The back-to-top button only shows once the page has been scrolled a little way.
    let scrolledDown = $state(false);
</script>

{#snippet characterCard(character: Character, inHighlighted: boolean)}
    <li style="--category-color: {CHARACTER_CATEGORY_COLORS[character.category]};" data-section-card={inHighlighted ? undefined : character.id}>
        <button class="character-card no-button-style" class:highlighted={highlightedIds.has(character.id)} aria-pressed={highlightedIds.has(character.id)} onclick={() => toggleHighlight(character)}>
            <CharacterThumb {character} size="3.2em"/>
            <div class="character-text">
                <div class="character-name">{character.name}</div>
                {#if character.rules}
                    <div class="character-rules">{character.rules}</div>
                {/if}
            </div>
        </button>
    </li>
{/snippet}

<svelte:head>
    <title>{data.script.name}</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') showQr = false; }}/>

<div class="script-viewer" style="--script-hue: {data.script.hue};" bind:this={scroller} onscroll={() => scrolledDown = (scroller?.scrollTop ?? 0) > 200}>
    <header>
        {#if data.backUrl}
            <a class="back-button" href={data.backUrl} aria-label="Back">
                <svg width={28} height={28} viewBox="0 0 24 24">
                    <path d="M15 5l-7 7 7 7" />
                </svg>
            </a>
        {/if}
        <h1>{data.script.name}</h1>
        <button class="share-button button-style" onclick={() => showQr = true} aria-label="Share with a QR code">
            <svg width={22} height={22} viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>
            </svg>
            Share
        </button>
        <button class="to-top" class:visible={scrolledDown} tabindex={scrolledDown ? 0 : -1} aria-hidden={!scrolledDown} onclick={() => scroller?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top">
            <svg width={22} height={22} viewBox="0 0 24 24">
                <path d="M6 15l6-6 6 6" />
            </svg>
        </button>
    </header>

    <main>
        {#if sections.every(s => s.characters.length === 0)}
            <p class="empty">This script has no characters yet.</p>
        {/if}
        {#if highlighted.length > 0}
            <section style="--category-color: var(--theme-highlight);">
                <h2>Highlighted <span class="count">{highlighted.length}</span></h2>
                <ul>
                    {#each highlighted as character (character.id)}
                        {@render characterCard(character, true)}
                    {/each}
                </ul>
            </section>
        {/if}
        {#each sections as { category, title, characters } (category)}
            {#if characters.length > 0}
                <section style="--category-color: {CHARACTER_CATEGORY_COLORS[category]};">
                    <h2>{title} <span class="count">{characters.length}</span></h2>
                    <ul>
                        {#each characters as character (character.id)}
                            {@render characterCard(character, false)}
                        {/each}
                    </ul>
                </section>
            {/if}
        {/each}
    </main>
</div>

{#if showQr}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="qr-backdrop" onclick={() => showQr = false}>
        <!-- The shared link leaves out backUrl: people scanning it get the plain viewer. -->
        <SiteQRCode path={page.url.pathname} title={data.script.name} size={16} dark="#000" light="#fff"/>
        <div class="qr-hint">Tap anywhere to close</div>
    </div>
{/if}

<style>
    .script-viewer {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        /* Highlighting keeps the page still itself; the browser's own adjustment would double it. */
        overflow-anchor: none;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
    }

    header {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.6em 1em;
        background-color: var(--theme-bg);
        border-bottom: 3px solid var(--script-hue);
    }

    h1 {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        font-size: 1.4em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .back-button {
        display: flex;
        color: inherit;
        opacity: 0.85;
    }
    .back-button:hover {
        opacity: 1;
    }

    svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    /* Hangs just below the sticky header, centred, over the list. */
    .to-top {
        position: absolute;
        top: calc(100% + 1.4em);
        left: 50%;
        width: 3.4em;
        height: 3.4em;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        border-radius: 50%;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg);
        box-shadow: 0 3px 10px var(--theme-shadow);
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, -0.5em);
        transition: opacity 0.2s, transform 0.2s;
    }
    .to-top.visible {
        opacity: 0.92;
        pointer-events: auto;
        transform: translate(-50%, 0);
    }
    .to-top svg {
        stroke-width: 3;
    }

    .share-button {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 0.4em;
    }
    .share-button svg {
        stroke-width: 2;
    }

    main {
        max-width: 60em;
        margin: 0 auto;
        padding: 0.5em 1em 2em;
        box-sizing: border-box;
    }

    h2 {
        margin: 1em 0 0.5em;
        padding-left: 0.5em;
        border-left: 4px solid var(--category-color);
        font-size: 1.15em;
    }
    .count {
        opacity: 0.6;
        font-size: 0.8em;
        font-weight: normal;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(18em, 1fr));
        gap: 0.6em;
    }

    .character-card {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 0.8em;
        border-radius: 8px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 2px solid transparent;
        border-left: 4px solid var(--category-color);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .character-card.highlighted {
        border-color: var(--theme-highlight);
        border-left-color: var(--category-color);
        background-color: color-mix(in srgb, var(--theme-highlight) 18%, var(--theme-bg-secondary));
    }

    .character-text {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.2em;
    }
    .character-name {
        font-weight: 600;
    }
    .character-rules {
        font-size: 0.85em;
        line-height: 1.3;
        opacity: 0.85;
    }

    .empty {
        text-align: center;
        opacity: 0.7;
    }

    .qr-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1em;
        background: rgba(0, 0, 0, 0.8);
    }
    .qr-hint {
        opacity: 0.7;
        font-size: 0.9em;
    }
</style>
