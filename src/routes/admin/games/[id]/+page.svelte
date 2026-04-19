<script lang="ts">
    import { goto } from "$app/navigation";
    import { CHARACTER_CATEGORIES, type Character } from "$lib/common/database/types";
    import { getPlayerCount } from "$lib/common/util";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import { writable } from "svelte/store";


    export let data;

    // Set token size variable here
    const tokenSize = '150px';


    // Ensure each character appears in only one area
    $: used_ids = data.game ? new Set(data.game.character_ids) : new Set();
    $: bluff_ids = data.game ? new Set(data.game.script.bluffs.map(b => b.id)) : new Set();
    $: unused_characters = data.game
        ? data.game.script.characters
        : [];
    $: used_characters = data.game
        ? data.game.script.characters.filter(c => used_ids.has(c.id) && !bluff_ids.has(c.id))
        : [];
    $: bluffs = data.game ? data.game.script.bluffs : [];

    $: currentTownsfolkCount = used_characters.filter(c => c.category === 'townsfolk').length;
    $: currentOutsiderCount = used_characters.filter(c => c.category === 'outsider').length;
    $: currentMinionCount = used_characters.filter(c => c.category === 'minion').length;
    $: currentDemonCount = used_characters.filter(c => c.category === 'demon').length;

    // $: expectedPlayerCount = used_characters.map(c=>c.player_count).reduce((a,b)=>a+b,0);
    let expectedPlayerCount = writable(7);
    $: expectedCharacterCounts = getPlayerCount(Number($expectedPlayerCount));

    function removeAll(){
        if(!data.game) return;
        data.game.character_ids = [];
        data.game = data.game; // trigger update
    }


    function addCharacter(characterId: number){
        if(!data.game) return;
        // Remove from bluffs if present
        data.game.script.bluffs = bluffs.filter(b => b.id !== characterId);
        // Add to in-game if not present
        if(!data.game.character_ids.includes(characterId)){
            data.game.character_ids.push(characterId);
        }
        data.game = data.game; // trigger update
    }

    function removeCharacter(characterId: number){
        if(!data.game) return;
        data.game.character_ids = data.game.character_ids.filter((id: number) => id !== characterId);
        data.game = data.game; // trigger update
    }

    function addBluff(character: Character) {
        if (!data.game) return;
        if (bluffs.length >= 3) return;
        if (!bluffs.find(b => b.id === character.id)) {
            // Remove from in-game if present
            data.game.character_ids = data.game.character_ids.filter((id: number) => id !== character.id);
            // Add to bluffs
            bluffs.push(character);
            data.game.script.bluffs = bluffs;
            data.game = data.game; // trigger update
        }
    }
    function removeBluff(characterId: number) {
        if (!data.game) return;
        data.game.script.bluffs = bluffs.filter(b => b.id !== characterId);
        data.game = data.game; // trigger update
    }

    function save(){
        if(!data.game) return;
        fetch(`/api/games/${data.game.id}/characters`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterIds: data.game.character_ids })
        }).then(response => {
            response.json().then((responseData) => {
                if (!response.ok) {
                    alert(`Failed to save characters: ${responseData.error || 'Unknown error'}`);
                    throw new Error(`Failed to save characters: ${responseData.error || 'Unknown error'}`);
                }
                goto('/admin/games');
            }).catch(error => {
                console.error("Error parsing response:", error);
                alert("Failed to save characters: Invalid response from server");
            });
        }).catch(error => {
            console.error("Error saving characters:", error);
        });
    }
</script>


<style>
.admin-game-main {
    touch-action: none;
}
.admin-game-layout {
    display: grid;
    gap: 1em;
    width: 100%;
    height: 100%;
    grid-template-columns: 1fr 1fr;
    box-sizing: border-box;
    overflow: hidden;
    padding: 1em;
}

.scrollable {
    overflow-y: auto;
}

.admin-game-left {
    height: 100%;
    background: var(--theme-bg-secondary);
    padding: 1em;
    border-radius: 1em;
    box-sizing: border-box;
}
.admin-game-right {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 1em;
    height: 100%;
    overflow: hidden;
}
.admin-game-section {
    background: var(--theme-bg-secondary);
    padding: 1em;
    border-radius: 1em;
    box-sizing: border-box;
}

.token-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
}
.token-list .token-wrapper {
    position: relative;
    width: var(--token-size);
    height: var(--token-size);
}
.token-list .token-action {
    position: absolute;
    top: 4px;
    right: 4px;
    background: #fff8;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    font-size: 1.2em;
    cursor: pointer;
    z-index: 2;
}

.admin-game-main {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    width: 100%;
}

.admin-game-header {
    display: flex;
    gap: 0.5em;
    align-items: center;
    justify-content: space-between;
}

.drag-ghost {
    position: fixed;
    pointer-events: none;
    z-index: 1000;
    transform: translate(-50%, -50%);
    opacity: 0.8;
    width: var(--token-size);
    height: var(--token-size);
}

.character-counts-table td, .character-counts-table th {
    padding: 0.1em 0.4em;
    text-align: center;
}

h2 {
    margin: 0;
    font-size: 1em;
}
</style>


{#if !data.game}
    <h1>Game not found</h1>
    {#if data.error}
        <p>{data.error}</p>
    {/if}
{:else}
<div class="admin-game-main">
    <div class="admin-game-header">
        <div style="display: flex; align-items: center; gap: 1em;">
            <a href="/admin/games">← Back to Games</a>
            <div>
                <h1 style="margin: 0;">{data.game.script.name}</h1>
                <div style="opacity: 0.6;">Created: {new Date(data.game.created).toLocaleString()}</div>
                <div style="opacity: 0.6;">Last Played: {data.game.last_played ? new Date(data.game.last_played).toLocaleString() : "Never"}</div>
            </div>
        </div>

        <div>
            <table class="character-counts-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Players</th>
                        <th>T</th>
                        <th>O</th>
                        <th>M</th>
                        <th>D</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 0; opacity: 0.5;">Target</td>
                        <td>
                            <select bind:value={$expectedPlayerCount}>
                                {#each {length: 11} as _, i}
                                    <option value={i + 5}>{i + 5}</option>
                                {/each}
                            </select>
                        </td>
                        <td>{expectedCharacterCounts.townsfolk}</td>
                        <td>{expectedCharacterCounts.outsiders}</td>
                        <td>{expectedCharacterCounts.minions}</td>
                        <td>{expectedCharacterCounts.demons}</td>
                    </tr>
                    <tr>
                        <td style="padding: 0; opacity: 0.5;">Current</td>
                        <td>{used_characters.reduce((acc, c) => acc + (c.player_count ?? 1), 0)}</td>
                        <td>{currentTownsfolkCount}</td>
                        <td>{currentOutsiderCount}</td>
                        <td>{currentMinionCount}</td>
                        <td>{currentDemonCount}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div style="margin-bottom: 1em;">
            <button type="button" onclick={removeAll} onpointerdown={e => e.stopPropagation()}>Remove All</button>
            <button type="button" onclick={save} onpointerdown={e => e.stopPropagation()}>Save</button>
        </div>
    </div>
    <div class="admin-game-layout" style="--token-size: {tokenSize}">
        <!-- LEFT: Available Characters -->
        <div class="admin-game-left scrollable">
            <h2>Available Characters</h2>
            <div class="token-list">
            {#each CHARACTER_CATEGORIES as category, i}
                    {#each unused_characters.filter(c => c.category === category) as character (character.id)}
                        {#if used_ids.has(character.id) || bluff_ids.has(character.id)}
                            <div class="token-wrapper" style="opacity: 0.4; filter: grayscale(0.4); pointer-events: none;">
                                <CharacterToken {character} size={tokenSize} />
                            </div>
                        {:else}
                            <div class="token-wrapper">
                                <CharacterToken {character} size={tokenSize} />
                                <button class="token-action" type="button" title="Add to game" onclick={() => addCharacter(character.id)} onpointerdown={e => e.stopPropagation()}>+</button>
                                <button class="token-action" type="button" title="Add as bluff" style="top:36px;" onclick={() => addBluff(character)} disabled={bluffs.length >= 3 || bluffs.find(b => b.id === character.id) !== undefined} onpointerdown={e => e.stopPropagation()}>B</button>
                            </div>
                        {/if}
                    {/each}
            {/each}
            </div>
        </div>

        <!-- RIGHT: In-Game and Bluffs -->
        <div class="admin-game-right">
            <div class="admin-game-section scrollable">
                <h2>In-Game Characters</h2>

                <div class="token-list">
                {#each CHARACTER_CATEGORIES as category}
                        {#each used_characters.filter(c => c.category === category) as character (character.id)}
                            <div class="token-wrapper">
                                <CharacterToken {character} size={tokenSize} />
                                <button class="token-action" type="button" title="Remove from game" onclick={() => removeCharacter(character.id)} onpointerdown={e => e.stopPropagation()}>-</button>
                            </div>
                        {/each}
                {/each}
                </div>
            </div>
            <div class="admin-game-section bluffs">
                <h2>Bluffs ({bluffs.length}/3)</h2>
                <div class="token-list">
                    {#each bluffs as character (character.id)}
                        <div class="token-wrapper">
                            <CharacterToken {character} size={tokenSize} />
                            <button class="token-action" type="button" title="Remove bluff" onclick={() => removeBluff(character.id)} onpointerdown={e => e.stopPropagation()}>-</button>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    </div>
    <!-- pointerDragging removed: touch/tablet drag now scrolls as normal -->
</div>
{/if}