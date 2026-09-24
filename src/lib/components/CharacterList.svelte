<script lang="ts">
    import CharacterThumb from '$lib/components/CharacterThumb.svelte';
    import { ALL_CHARACTER_CATEGORIES, CHARACTER_CATEGORY_COLORS, type Character, type CharacterCategory } from '$lib/resources/common/gameData.js';

    let {
        characters,
        searchQuery = '',
        showEmptyCategories = false,
        href,
        onpick,
        isSelected = () => false,
        isDisabled = () => false,
        isFaded = () => false,
        headingSuffix,
        onadd,
        onremove,
        countOf = c => (isSelected(c) ? 1 : 0),
        categoryOrder = ['demon', 'minion', 'outsider', 'townsfolk', 'traveler', 'loric', 'fabled']
    }: {
        /** The categories to show, in order. */
        categoryOrder?: CharacterCategory[];
        characters: Character[];
        searchQuery?: string;
        /** Show category headers with zero characters (only while not searching). */
        showEmptyCategories?: boolean;
        /** Builds a link for each character card; cards are plain blocks when omitted. */
        href?: (character: Character) => string;
        /** Makes cards clickable buttons that call this with the picked character. */
        onpick?: (character: Character) => void;
        isSelected?: (character: Character) => boolean;
        /** Disabled cards can't be picked unless they are already selected. */
        isDisabled?: (character: Character) => boolean;
        /** Faded cards are shown at lower opacity but can still be picked. */
        isFaded?: (character: Character) => boolean;
        /** Optional text appended to a category heading, e.g. a count. */
        headingSuffix?: (category: CharacterCategory) => string;
        /** Multi-pick mode: hovering a card shows a "+1" overlay, and once picked also an "X" overlay to remove one. */
        onadd?: (character: Character) => void;
        onremove?: (character: Character) => void;
        /** How many of a character are picked, in multi-pick mode. */
        countOf?: (character: Character) => number;
    } = $props();

    // Touch devices can't hover, so multi-pick mode works by tapping instead: a tap adds one, and tapping a
    // picked character removes it, and its "..." button opens a popup to set how many.
    let touchMode = $state(false);
    $effect(() => {
        const query = matchMedia('(hover: none)');
        touchMode = query.matches;
        const onChange = (e: MediaQueryListEvent) => touchMode = e.matches;
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    });
    const tapMode = $derived(!!onadd && touchMode);

    let editing = $state<Character | null>(null);
    let draftCount = $state(0);

    function tapCharacter(character: Character) {
        const count = countOf(character);
        if (count > 0) {
            for (let i = 0; i < count; i++) onremove?.(character);
        } else {
            onadd?.(character);
        }
    }

    function editCount(character: Character) {
        editing = character;
        draftCount = countOf(character);
    }

    function applyDraft() {
        if (!editing) return;
        const current = countOf(editing);
        for (let i = current; i < draftCount; i++) onadd?.(editing);
        for (let i = current; i > draftCount; i--) onremove?.(editing);
        editing = null;
    }

    const COLLAPSED_BY_DEFAULT: CharacterCategory[] = ['traveler', 'loric', 'fabled'];

    let openCategories = $state(new Set<CharacterCategory>(ALL_CHARACTER_CATEGORIES.filter(c => !COLLAPSED_BY_DEFAULT.includes(c))));

    const charactersByCategory = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        const matches = characters.filter(c => c.name.toLowerCase().includes(query));
        return categoryOrder.map(category => ({
            category,
            characters: matches.filter(c => c.category === category)
        }));
    });

    function toggleCategory(category: CharacterCategory) {
        const next = new Set(openCategories);
        next.has(category) ? next.delete(category) : next.add(category);
        openCategories = next;
    }
</script>

{#snippet cardBody(character: Character, selected: boolean, count: number)}
    <div class="thumb-wrapper">
        <div class="thumb-inner" class:dimmed={selected}>
            <CharacterThumb {character} size="2.8em"/>
        </div>
        {#if count > 1 && !tapMode}
            <span class="count-badge">×{count}</span>
        {:else if selected}
            <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4,13 10,19 20,6"/>
            </svg>
        {/if}
    </div>
    <div class="character-text">
        <div class="character-name">{character.name}</div>
        {#if character.rules}
            <div class="character-rules">{character.rules}</div>
        {/if}
    </div>
{/snippet}

{#each charactersByCategory as { category, characters: inCategory }}
    {#if inCategory.length > 0 || (showEmptyCategories && !searchQuery.trim())}
        <div class="category-group">
            <button class="category-header no-button-style" onclick={() => toggleCategory(category)}>
                <span class="chevron" class:open={openCategories.has(category)}>&rsaquo;</span>
                <span class="category-name">{category}</span>
                {#if headingSuffix}
                    <span class="category-count">{headingSuffix(category)}</span>
                {:else}
                    <span class="category-count">{inCategory.length}</span>
                {/if}
            </button>
            {#if openCategories.has(category)}
                <div class="character-grid">
                    {#each inCategory as character (character.id)}
                        {@const count = onadd ? countOf(character) : 0}
                        {@const selected = onadd ? count > 0 : isSelected(character)}
                        {@const disabled = !selected && isDisabled(character)}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <svelte:element
                            this={href ? 'a' : (onpick || tapMode) ? 'button' : 'div'}
                            class="character-card"
                            class:tap={tapMode}
                            title={character.rules || undefined}
                            class:interactive={!!href || !!onpick || tapMode}
                            class:multi={!!onadd && !tapMode}
                            class:selected
                            class:disabled
                            class:faded={isFaded(character)}
                            href={href?.(character)}
                            disabled={onpick ? disabled : undefined}
                            onclick={onpick ? () => onpick(character) : tapMode ? () => tapCharacter(character) : undefined}
                            style="--category-color: {CHARACTER_CATEGORY_COLORS[category]};"
                        >
                            {@render cardBody(character, selected, count)}
                            {#if tapMode && selected}
                                <span
                                    class="more-button"
                                    role="button"
                                    tabindex="0"
                                    aria-label="Set number of {character.name}"
                                    onclick={(e) => { e.stopPropagation(); editCount(character); }}
                                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); editCount(character); } }}
                                >×{count}</span>
                            {/if}
                            {#if onadd && !tapMode}
                                {#if selected}
                                    <button class="overlay remove" onclick={() => onremove?.(character)} aria-label="Remove one {character.name}">✕</button>
                                    <button class="overlay add" onclick={() => onadd(character)} aria-label="Add another {character.name}">+1</button>
                                {:else}
                                    <button class="overlay add full" onclick={() => onadd(character)} aria-label="Add {character.name}">+1</button>
                                {/if}
                            {/if}
                        </svelte:element>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
{/each}

{#if editing}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="popup-backdrop" onclick={() => editing = null}>
        <div class="popup" role="dialog" aria-label="Set number of {editing.name}" onclick={(e) => e.stopPropagation()}>
            <div class="popup-title">
                <CharacterThumb character={editing} size="2.8em"/>
                <strong>{editing.name}</strong>
            </div>
            <div class="stepper">
                <button class="button-style" onclick={() => draftCount = Math.max(0, draftCount - 1)} aria-label="One fewer">−</button>
                <span class="stepper-value">{draftCount}</span>
                <button class="button-style" onclick={() => draftCount++} aria-label="One more">+</button>
            </div>
            {#if draftCount === 0}
                <div class="popup-note">Saving 0 removes this character.</div>
            {/if}
            <div class="popup-actions">
                <button class="button-style" onclick={() => editing = null}>Cancel</button>
                <button class="button-style highlight" onclick={applyDraft}>Save</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .popup-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.6);
    }
    .popup {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1em;
        padding: 1.2em 1.5em;
        border-radius: 1em;
        background: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        min-width: 16em;
    }
    .popup-title {
        display: flex;
        align-items: center;
        gap: 0.8em;
    }
    .stepper {
        display: flex;
        align-items: center;
        gap: 1em;
    }
    .stepper button {
        width: 3em;
        height: 3em;
        font-size: 1.2em;
    }
    .stepper-value {
        min-width: 2ch;
        text-align: center;
        font-size: 1.8em;
        font-weight: bold;
    }
    .popup-note {
        font-size: 0.85em;
        opacity: 0.7;
    }
    .popup-actions {
        display: flex;
        gap: 1em;
        align-self: stretch;
        justify-content: space-between;
    }

    .category-group {
        margin-bottom: 0.5em;
    }
    .category-header {
        position: sticky;
        top: 0;
        z-index: 5;
        background-color: var(--theme-bg);
        display: flex;
        align-items: center;
        gap: 0.6em;
        width: 100%;
        padding: 0.6em 0;
        text-align: left;
        font-size: 1.1em;
        text-transform: capitalize;
        cursor: pointer;
    }
    .chevron {
        display: inline-block;
        transition: transform 0.15s ease;
        font-size: 1.3em;
        line-height: 1;
    }
    .chevron.open {
        transform: rotate(90deg);
    }
    .category-count {
        opacity: 0.6;
        font-size: 0.8em;
        font-weight: normal;
    }

    .character-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.6em;
        padding-bottom: 1em;
    }

    .character-card {
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 0.8em;
        border-radius: 8px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid transparent;
        border-left: 4px solid var(--category-color);
        text-decoration: none;
        cursor: default;
        transition: border-color 0.15s ease;
        font: inherit;
        text-align: left;
        width: 100%;
        box-sizing: border-box;
    }
    .character-card.interactive {
        cursor: pointer;
    }
    .character-card.interactive:hover:not(.disabled) {
        border-top-color: currentColor;
        border-right-color: currentColor;
        border-bottom-color: currentColor;
    }
    .character-card.selected {
        border-top-color: #16a34a;
        border-right-color: #16a34a;
        border-bottom-color: #16a34a;
    }
    .character-card.disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .character-card.faded {
        opacity: 0.4;
    }
    .character-card.tap {
        position: relative;
    }
    .more-button {
        position: absolute;
        top: 0.3em;
        right: 0.3em;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 2.2em;
        height: 1.6em;
        padding: 0 0.6em;
        box-sizing: border-box;
        border-radius: 999px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font-weight: bold;
        font-size: 0.9em;
        cursor: pointer;
    }
    .thumb-wrapper {
        position: relative;
        flex-shrink: 0;
        display: flex;
    }
    .character-card.multi {
        position: relative;
        overflow: hidden;
    }
    .overlay {
        position: absolute;
        top: 0;
        bottom: 0;
        border: none;
        padding: 0;
        margin: 0;
        font: inherit;
        font-size: 1.3em;
        font-weight: bold;
        color: white;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.12s ease;
    }
    .character-card.multi:hover .overlay,
    .character-card.multi:focus-within .overlay {
        opacity: 1;
    }
    .overlay.add {
        right: 0;
        width: 25%;
        background: rgba(22, 163, 74, 0.85);
    }
    .overlay.add.full {
        left: 0;
        width: 100%;
    }
    .overlay.remove {
        left: 0;
        width: 75%;
        background: rgba(220, 38, 38, 0.8);
    }
    .count-badge {
        position: absolute;
        right: -0.3em;
        bottom: -0.3em;
        background: #16a34a;
        color: white;
        font-size: 0.75em;
        font-weight: bold;
        border-radius: 999px;
        padding: 0 0.4em;
        pointer-events: none;
    }
    .thumb-inner.dimmed {
        opacity: 0.4;
    }
    .tick {
        position: absolute;
        inset: 15%;
        width: 70%;
        height: 70%;
        pointer-events: none;
        filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8));
    }
    .character-text {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15em;
    }
    .character-rules {
        font-size: 0.8em;
        font-style: italic;
        opacity: 0.7;
        line-height: 1.25;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
    }
    .character-name {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
