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
</style>
