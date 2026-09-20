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
        headingSuffix
    }: {
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
        /** Optional text appended to a category heading, e.g. a count. */
        headingSuffix?: (category: CharacterCategory) => string;
    } = $props();

    let openCategories = $state(new Set<CharacterCategory>(ALL_CHARACTER_CATEGORIES));

    const charactersByCategory = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        const matches = characters.filter(c => c.name.toLowerCase().includes(query));
        return ALL_CHARACTER_CATEGORIES.map(category => ({
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

{#snippet cardBody(character: Character, selected: boolean)}
    <div class="thumb-wrapper">
        <div class="thumb-inner" class:dimmed={selected}>
            <CharacterThumb {character} size="2.8em"/>
        </div>
        {#if selected}
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
                <span class="category-count">{inCategory.length}</span>
                {#if headingSuffix}<span class="category-count">{headingSuffix(category)}</span>{/if}
            </button>
            {#if openCategories.has(category)}
                <div class="character-grid">
                    {#each inCategory as character (character.id)}
                        {@const selected = isSelected(character)}
                        {@const disabled = !selected && isDisabled(character)}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <svelte:element
                            this={href ? 'a' : onpick ? 'button' : 'div'}
                            class="character-card"
                            title={character.rules || undefined}
                            class:interactive={!!href || !!onpick}
                            class:selected
                            class:disabled
                            href={href?.(character)}
                            disabled={onpick ? disabled : undefined}
                            onclick={onpick ? () => onpick(character) : undefined}
                            style="--category-color: {CHARACTER_CATEGORY_COLORS[category]};"
                        >
                            {@render cardBody(character, selected)}
                        </svelte:element>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
{/each}

<style>
    .category-group {
        margin-bottom: 0.5em;
    }
    .category-header {
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
    .thumb-wrapper {
        position: relative;
        flex-shrink: 0;
        display: flex;
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
