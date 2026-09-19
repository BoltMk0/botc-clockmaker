<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import CharacterThumb from '$lib/components/CharacterThumb.svelte';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';
    import { ALL_CHARACTER_CATEGORIES, type Character, type CharacterCategory } from '$lib/resources/common/gameData.js';

    let { data }: { data: { characters: Character[] } } = $props();

    let newCharacterOverlayIsVisible = $state(false);
    let searchQuery = $state('');
    let openCategories = $state(new Set<CharacterCategory>(ALL_CHARACTER_CATEGORIES));

    const charactersByCategory = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        const matches = data.characters.filter(c => c.name.toLowerCase().includes(query));
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

<div class="characters-page">
    <div class="toolbar">
        <div class="toolbar-heading">
            <h2>Characters</h2>
            <p>{data.characters.length} characters. Select one to view or edit it.</p>
        </div>
        <div class="toolbar-actions">
            <input placeholder="Search..." bind:value={searchQuery} />
            <CustomOverlay title="Create New Character" buttonTitle="+" bind:visible={newCharacterOverlayIsVisible}>
                <form action="?/createCharacter" method="POST" use:enhance={() => {
                    return async ({ result }) => {
                        if (result.type === 'success') {
                            const newCharacter = result.data as Character;
                            newCharacterOverlayIsVisible = false;
                            goto(`/settings/characters/${newCharacter.id}`);
                        }
                    };
                }}>
                    <input type="text" name="name" placeholder="Character Name (Required)" required style="width: 100%; margin-bottom: 1em;"/>
                    <select name="category" style="width: 100%; margin-bottom: 1em;" required>
                        <option value="" disabled selected>Character Category (Required)</option>
                        {#each ALL_CHARACTER_CATEGORIES as group}
                            <option value={group}>{group}</option>
                        {/each}
                    </select>
                    <button type="submit">Submit</button>
                </form>
            </CustomOverlay>
            <a class="button-style" href="/settings/characters/scraper">Wiki Scraper</a>
        </div>
    </div>

    <div class="body">
        {#each charactersByCategory as { category, characters }}
            {#if characters.length > 0 || !searchQuery.trim()}
                <div class="category-group">
                    <button class="category-header no-button-style" onclick={() => toggleCategory(category)}>
                        <span class="chevron" class:open={openCategories.has(category)}>&rsaquo;</span>
                        <span class="category-name">{category}</span>
                        <span class="category-count">{characters.length}</span>
                    </button>
                    {#if openCategories.has(category)}
                        <div class="character-grid">
                            {#each characters as character (character.id)}
                                <a class="character-card" href="/settings/characters/{character.id}">
                                    <CharacterThumb {character} size="2.8em"/>
                                    <span class="character-name">{character.name}</span>
                                </a>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        {/each}
    </div>
</div>

<style>
    .characters-page {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100%;
        width: 100%;
        overflow: hidden;
        background-color: var(--theme-bg);
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 1.5em;
        padding: 1.5em 2em;
        border-bottom: 1px solid var(--border-color);
    }
    .toolbar-heading h2 {
        margin: 0 0 0.25em 0;
    }
    .toolbar-heading p {
        margin: 0;
        opacity: 0.75;
        font-size: 0.9em;
    }
    .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 0.8em;
    }

    .body {
        overflow-y: auto;
        padding: 1em 2em 2em 2em;
    }

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
        text-decoration: none;
        cursor: pointer;
        transition: border-color 0.15s ease;
    }
    .character-card:hover {
        border-color: currentColor;
    }
    .character-name {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
