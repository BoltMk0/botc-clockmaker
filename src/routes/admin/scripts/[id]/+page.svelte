<script lang="ts">
    import { CHARACTER_CATEGORIES, type Character, type ScriptCharacter } from "$lib/common/database/types.js";
    import { writable } from "svelte/store";
    export let data;

    const characterMap = new Map<number, ScriptCharacter>(data.characters.map((c: any) => [c.id, c]));
    const charactersByCategory: Record<string, Character[]> = {};
    for (const category of CHARACTER_CATEGORIES) {
        charactersByCategory[category] = data.characters.filter((c: any) => c.category === category);
    }
    
    const characterFilterByCategory = writable(new Map(CHARACTER_CATEGORIES.map(category => [category, ""])));

    $: inUseCharacterIds = new Set(data.script.characters.map((c: any) => c.id));

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
    ul, li {
        margin: 0;
        padding: 0.1em;
        list-style: none;
    }

    .character-list-item button {
        width: 100%;
        padding: 0.5em;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border: none;
        border-radius: 0.5em;
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
</style>

<div style="width: 100%; height: 100%;">
    <div style="width: 100%; height: 100%; display: grid; grid-template-rows: auto 1fr; gap: 1em; overflow: hidden; padding: 1em; box-sizing: border-box;" class="scripts-main">
        <div>
            <input type="text" placeholder="Script Name" bind:value={data.script.name} style="font-size: larger; padding: 0.5em;"/>
            <button on:click={()=>save}>Save</button>
        </div>
        <div style="width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 1em; overflow: hidden;">
            {#each CHARACTER_CATEGORIES as category}
                <div class="character-category-column-main">
                    <div class="character-category-column-header">
                        <div>{captialiseString(category)}</div>
                        <input type="text" placeholder="Filter..." on:input={(e) => characterFilterByCategory.update(map => { map.set(category, (e.target as HTMLInputElement).value); return map; })}/>
                    </div>
                    <div class="character-category-column-content">
                        {#each charactersByCategory[category].filter(c => c.name.toLowerCase().includes($characterFilterByCategory.get(category)!.toLowerCase())) as character}
                            <div class="character-list-item">
                                <button class:in-use={inUseCharacterIds.has(character.id)} on:click={() => onAddCharacter(character.id)}>
                                    {character.name}
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
            <div class="character-category-column-main">
                <div class="character-category-column-header">
                    <div>In Script</div>
                </div>
                <div class="character-category-column-content">
                    {#each CHARACTER_CATEGORIES as category}
                        <div style="opacity: 0.6;">{captialiseString(category)} ({data.script.characters.filter(c=>c.category===category).length})</div>
                        {#each data.script.characters.filter(c=>c.category===category) as character}
                            <div class="character-list-item">
                                <button class:in-use={true} on:click={() => onAddCharacter(character.id)}>
                                    {character.name}
                                </button>
                            </div>
                        {/each}
                    {/each}
                </div>
            </div>
        </div>
    </div>
</div>