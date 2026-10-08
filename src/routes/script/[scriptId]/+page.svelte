<script lang="ts">
    import { page } from '$app/state';
    import CharacterThumb from '$lib/components/CharacterThumb.svelte';
    import SiteQRCode from '$lib/components/SiteQRCode.svelte';
    import { CHARACTER_CATEGORY_COLORS, type CharacterCategory } from '$lib/resources/common/gameData';
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

    let showQr = $state(false);
</script>

<svelte:head>
    <title>{data.script.name}</title>
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') showQr = false; }}/>

<div class="script-viewer" style="--script-hue: {data.script.hue};">
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
    </header>

    <main>
        {#if sections.every(s => s.characters.length === 0)}
            <p class="empty">This script has no characters yet.</p>
        {/if}
        {#each sections as { category, title, characters } (category)}
            {#if characters.length > 0}
                <section style="--category-color: {CHARACTER_CATEGORY_COLORS[category]};">
                    <h2>{title} <span class="count">{characters.length}</span></h2>
                    <ul>
                        {#each characters as character (character.id)}
                            <li>
                                <CharacterThumb {character} size="3.2em"/>
                                <div class="character-text">
                                    <div class="character-name">{character.name}</div>
                                    {#if character.rules}
                                        <div class="character-rules">{character.rules}</div>
                                    {/if}
                                </div>
                            </li>
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

    li {
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 0.8em;
        border-radius: 8px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border-left: 4px solid var(--category-color);
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
        user-select: text;
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
