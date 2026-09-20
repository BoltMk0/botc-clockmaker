<script lang="ts">
    import CharacterThumb from '$lib/components/CharacterThumb.svelte';
    import { ALL_CHARACTER_CATEGORIES, CHARACTER_CATEGORY_COLORS, type Character, type CharacterCategory } from '$lib/resources/common/gameData.js';

    let {
        characters,
        searchQuery = '',
        showEmptyCategories = false,
        href
    }: {
        characters: Character[];
        searchQuery?: string;
        /** Show category headers with zero characters (only while not searching). */
        showEmptyCategories?: boolean;
        /** Builds a link for each character card; cards are plain blocks when omitted. */
        href?: (character: Character) => string;
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

{#each charactersByCategory as { category, characters: inCategory }}
    {#if inCategory.length > 0 || (showEmptyCategories && !searchQuery.trim())}
        <div class="category-group">
            <button class="category-header no-button-style" onclick={() => toggleCategory(category)}>
                <span class="chevron" class:open={openCategories.has(category)}>&rsaquo;</span>
                <span class="category-name">{category}</span>
                <span class="category-count">{inCategory.length}</span>
            </button>
            {#if openCategories.has(category)}
                <div class="character-grid">
                    {#each inCategory as character (character.id)}
                        {#if href}
                            <a class="character-card" href={href(character)} style="--category-color: {CHARACTER_CATEGORY_COLORS[category]};">
                                <CharacterThumb {character} size="2.8em"/>
                                <span class="character-name">{character.name}</span>
                            </a>
                        {:else}
                            <div class="character-card static" style="--category-color: {CHARACTER_CATEGORY_COLORS[category]};">
                                <CharacterThumb {character} size="2.8em"/>
                                <span class="character-name">{character.name}</span>
                            </div>
                        {/if}
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
        cursor: pointer;
        transition: border-color 0.15s ease;
    }
    .character-card:hover {
        border-top-color: currentColor;
        border-right-color: currentColor;
        border-bottom-color: currentColor;
    }
    .character-card.static {
        cursor: default;
    }
    .character-card.static:hover {
        border-top-color: transparent;
        border-right-color: transparent;
        border-bottom-color: transparent;
    }
    .character-name {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
