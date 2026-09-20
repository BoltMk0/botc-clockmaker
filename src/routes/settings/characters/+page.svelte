<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import CharacterList from '$lib/components/CharacterList.svelte';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';
    import { ALL_CHARACTER_CATEGORIES, type Character } from '$lib/resources/common/gameData.js';

    let { data }: { data: { characters: Character[] } } = $props();

    let newCharacterOverlayIsVisible = $state(false);
    let searchQuery = $state('');
</script>

<div class="characters-page">
    <div class="toolbar">
        <div class="toolbar-heading">
            <h2>Characters</h2>
            <p>{data.characters.length} characters. Select one to view or edit it.</p>
        </div>
        <input class="search" type="search" placeholder="Search characters..." aria-label="Search characters" bind:value={searchQuery} />
        <div class="toolbar-actions">
            <CustomOverlay title="Create New Character" buttonTitle="Create Character" bind:visible={newCharacterOverlayIsVisible}>
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
        <CharacterList characters={data.characters} {searchQuery} showEmptyCategories href={c => `/settings/characters/${c.id}`}/>
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
        display: grid;
        grid-template-columns: 1fr minmax(14em, 26em) 1fr;
        align-items: center;
        gap: 1.5em;
        padding: 1.5em 2em;
        border-bottom: 1px solid var(--border-color);
    }
    .search {
        width: 100%;
        box-sizing: border-box;
        padding: 0.6em 1.1em;
        font: inherit;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 999px;
    }
    .search::placeholder {
        color: inherit;
        opacity: 0.55;
    }
    .search:focus {
        outline: none;
        border-color: var(--theme-highlight);
    }
    @media (max-width: 800px) {
        .toolbar {
            grid-template-columns: 1fr;
        }
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
        justify-content: flex-end;
        gap: 0.8em;
    }
    .toolbar-actions > :global(button),
    .toolbar-actions > a {
        display: inline-flex;
        align-items: center;
        padding: 0.6em 1.2em;
        font: inherit;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        text-decoration: none;
        cursor: pointer;
        border-radius: 999px;
        transition: filter 0.15s, border-color 0.15s, background-color 0.15s;
    }
    /* Primary: Create Character */
    .toolbar-actions > :global(button) {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border: 1px solid var(--theme-highlight);
        box-shadow: 0 2px 8px var(--theme-shadow);
    }
    .toolbar-actions > :global(button:hover) {
        filter: brightness(1.12);
    }
    /* Secondary: Wiki Scraper */
    .toolbar-actions > a {
        background-color: transparent;
        color: var(--theme-on-bg);
        border: 1px solid var(--theme-bg-tertiary);
    }
    .toolbar-actions > a:hover {
        border-color: var(--theme-highlight);
        background-color: var(--theme-bg-secondary);
    }

    .body {
        overflow-y: auto;
        padding: 1em 2em 2em 2em;
    }
</style>
