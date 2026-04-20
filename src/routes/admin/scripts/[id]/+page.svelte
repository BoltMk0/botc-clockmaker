<script lang="ts">
    import { CHARACTER_CATEGORIES, type Character, type ScriptCharacter } from "$lib/common/database/types.js";
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";
    import Navbar from "$lib/components/Navbar.svelte";
    export let data;

    const characterMap = new Map<number, ScriptCharacter>(data.characters.map((c: any) => [c.id, c]));

    const FILTER_OPTIONS = ['all', ...CHARACTER_CATEGORIES, 'traveler'] as const;
    type FilterOption = typeof FILTER_OPTIONS[number];

    let searchQuery = "";
    let categoryFilter: FilterOption = 'all';

    $: inUseCharacterIds = new Set(data.script.characters.map((c: any) => c.id));
    $: filteredCharacters = (data.characters as Character[])
        .filter(c => categoryFilter === 'all' || c.category === categoryFilter)
        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    function captialiseString(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function onAddCharacter(characterId: number) {
        if(data.script.characters.some((c: any) => c.id === characterId)){
            // Character already in use, remove it
            data.script.characters = data.script.characters.filter((c: any) => c.id !== characterId);
        } else {
            // Character not in use, add it  
            const char = characterMap.get(characterId);
            if(!char) {
                alert(`Character with id ${characterId} not found`);
                return;
            }
            data.script.characters.push(char);
        }
        data = data;
    }

    function save() {
        fetch(`?/saveScript`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data.script)
        }).then(response => {
            if (!response.ok) {
                alert('Failed to save script');
            } else {
                alert('Script saved successfully');
            }
        }).catch(er => {
            alert(`Failed to save script: ${er}`);
        });
    }

</script>
    
<style>
    .character-list-item button {
        width: 100%;
        padding: 0.5em;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border: none;
        border-radius: 0.5em;
        display: flex;
        align-items: center;
        gap: 0.6em;
        text-align: left;
    }

    .character-row-body {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15em;
    }
    .character-row-name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .character-row-rules {
        font-size: 0.8em;
        opacity: 0.7;
        line-height: 1.25;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
    }

    .character-list-item button.in-use {
        background-color: var(--theme-highlight);
        color: var(--theme-on-primary);
    }

    .character-category-column-main {
        height: 100%;
        overflow: hidden;
        display: grid;
        grid-template-rows: auto 1fr;
    }
    .character-category-column-content {
        overflow-y: scroll;
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }

    .filter-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75em;
        padding-bottom: 0.5em;
    }
    .filter-bar input[type="text"] {
        flex: 1 1 12em;
        min-width: 8em;
        padding: 0.4em 0.6em;
    }
    .radio-group {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }
    .radio-group label {
        display: inline-flex;
        align-items: center;
        gap: 0.25em;
        cursor: pointer;
        user-select: none;
    }

    .category-badge {
        font-size: 0.75em;
        padding: 0.1em 0.6em;
        border-radius: 0.75em;
        opacity: 0.8;
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .category-townsfolk { background-color: #4a90d9; color: #fff; }
    .category-outsider  { background-color: #6fa9dc; color: #fff; }
    .category-minion    { background-color: #d96a4a; color: #fff; }
    .category-demon     { background-color: #b63737; color: #fff; }
    .category-traveler  { background-color: #7a6fb6; color: #fff; }
</style>

<Navbar/>
<div style="width: 100%; height: 100%;">
    <div style="width: 100%; height: 100%; display: grid; grid-template-rows: auto 1fr; gap: 1em; overflow: hidden; padding: 1em; box-sizing: border-box;" class="scripts-main">
        <div style="margin-left: 50px;">
            <input type="text" placeholder="Script Name" bind:value={data.script.name} style="font-size: larger; padding: 0.5em;"/>
            <button on:click={save}>Save</button>
        </div>
        <div style="width: 100%; height: 100%; display: grid; grid-template-columns: 2fr 1fr; gap: 1em; overflow: hidden;">
            <div class="character-category-column-main">
                <div class="character-category-column-header filter-bar">
                    <input type="text" placeholder="Search characters..." bind:value={searchQuery}/>
                    <div class="radio-group">
                        {#each FILTER_OPTIONS as opt}
                            <label>
                                <input type="radio" bind:group={categoryFilter} value={opt}/>
                                {opt === 'all' ? 'All' : captialiseString(opt)}
                            </label>
                        {/each}
                    </div>
                </div>
                <div class="character-category-column-content">
                    {#each filteredCharacters as character (character.id)}
                        <div class="character-list-item">
                            <button class:in-use={inUseCharacterIds.has(character.id)} on:click={() => onAddCharacter(character.id)}>
                                <CharacterThumb {character}/>
                                <div class="character-row-body">
                                    <div class="character-row-name">{character.name}</div>
                                    <div class="character-row-rules">{character.rules}</div>
                                </div>
                                <span class="category-badge category-{character.category}">{captialiseString(character.category)}</span>
                            </button>
                        </div>
                    {/each}
                </div>
            </div>
            <div class="character-category-column-main">
                <div class="character-category-column-header">
                    <div>In Script</div>
                </div>
                <div class="character-category-column-content">
                    {#each [...CHARACTER_CATEGORIES, 'traveler'] as category}
                        {@const inCat = data.script.characters.filter((c: ScriptCharacter) => c.category === category)}
                        {#if inCat.length > 0}
                            <div style="opacity: 0.6;">{captialiseString(category)} ({inCat.length})</div>
                            {#each inCat as character}
                                <div class="character-list-item">
                                    <button class:in-use={true} on:click={() => onAddCharacter(character.id)}>
                                        <CharacterThumb {character}/>
                                        <div class="character-row-body">
                                            <div class="character-row-name">{character.name}</div>
                                            <div class="character-row-rules">{character.rules}</div>
                                        </div>
                                    </button>
                                </div>
                            {/each}
                        {/if}
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>