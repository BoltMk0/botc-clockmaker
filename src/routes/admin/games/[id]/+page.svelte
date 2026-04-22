<script lang="ts">
    import { goto } from "$app/navigation";
    import { CHARACTER_CATEGORIES, type Character, type GameFull } from "$lib/database/common/types.js";
    import { getPlayerCount } from "$lib/common/util";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import { writable } from "svelte/store";
    import { enhance } from "$app/forms";

    interface Props {
        data: {
            game: GameFull | null;
            error?: string;
        }
    }

    let {data}: Props = $props();

    // Set token size variable here
    const tokenSize = $state('150px');

    // svelte-ignore state_referenced_locally
    let game = $state(data.game);

    const unused_characters = $derived(game ? game.script.characters : []);
    const used_characters = $derived(game ? game.script.characters.filter(c => game.character_ids.includes(c.id) && !game.bluff_ids.includes(c.id)) : []);

    const bluffs = $derived(game ? game.bluff_ids.map(id => game.script.characters.find(c => c.id === id)).filter(Boolean) : []);

    const currentTownsfolkCount = $derived(used_characters.filter(c => c.category === 'townsfolk').length);
    const currentOutsiderCount = $derived(used_characters.filter(c => c.category === 'outsider').length);
    const currentMinionCount = $derived(used_characters.filter(c => c.category === 'minion').length);
    const currentDemonCount = $derived(used_characters.filter(c => c.category === 'demon').length);

    // $: expectedPlayerCount = used_characters.map(c=>c.player_count).reduce((a,b)=>a+b,0);
    let expectedPlayerCount = $state(7);
    const expectedCharacterCounts = $derived(getPlayerCount(Number(expectedPlayerCount)));  

    function removeAll(){
        if(!data.game) return;
        data.game.character_ids = [];
        data.game = data.game; // trigger update
    }


    function addCharacter(characterId: number){
        if(!game) return;
        // Remove from bluffs if present
        game.bluff_ids = game.bluff_ids.filter(id => id !== characterId);
        // Add to in-game if not present
        if(!game.character_ids.includes(characterId)){
            game.character_ids.push(characterId);
        }
    }

    function removeCharacter(characterId: number){
        if(!game) return;
        game.character_ids = game.character_ids.filter((id: number) => id !== characterId);
    }

    function addBluff(character: Character) {
        if (!game) return;
        if (bluffs.length >= 3) return;
        if (!game.bluff_ids.find(id => id === character.id)) {
            // Remove from in-game if present
            game.character_ids = game.character_ids.filter((id: number) => id !== character.id);
            // Add to bluffs
            game.bluff_ids.push(character.id);
        }
    }
    function removeBluff(characterId: number) {
        if (!game) return;
        game.bluff_ids = game.bluff_ids.filter(id => id !== characterId);
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

.character-counts-table td, .character-counts-table th {
    padding: 0.1em 0.4em;
    text-align: center;
}

h2 {
    margin: 0;
    font-size: 1em;
}
</style>


{#if !game}
    <h1>Game not found</h1>
    {#if data.error}
        <p>{data.error}</p>
    {/if}
{:else}
<div class="admin-game-main">
    <div class="admin-game-header padded">
        <div class="in-a-row">
            <a href="/admin/games" class="button-style" style="height: 100%;">← Back</a>
            <div>
                <h1 style="margin: 0;">{game.script.name}</h1>
                <div style="opacity: 0.6;">Created: {new Date(game.created).toLocaleString()}</div>
                <div style="opacity: 0.6;">Last Played: {game.last_played ? new Date(game.last_played).toLocaleString() : "Never"}</div>
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
                            <select bind:value={expectedPlayerCount}>
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
        <form action="?/saveCharacters" method="POST" use:enhance={()=>{
            return async ({result}) => {
                switch(result.type){
                    case 'success':
                        goto('/admin/games');
                        break;
                    case 'redirect':
                        // Do nothing, the browser will handle the redirect
                        break;
                    case 'failure':
                        alert(`Failed to save characters: ${result.data?.error || 'Unknown error'}`);
                        break;
                    case 'error':
                        alert(`Failed to save characters: ${result.error}`);
                        break;
                }
            }
        }}>
            <input type="hidden" name="characterIds" value={game.character_ids.join(',')}/>
            <input type="hidden" name="bluffIds" value={game.bluff_ids.join(',')}/>
            <button type="submit" class="button-style highlight">Save</button>
        </form>
    </div>
    <div class="admin-game-layout" style="--token-size: {tokenSize}">
        <!-- LEFT: Available Characters -->
        <div class="admin-game-left scrollable">
            <h2>Available Characters</h2>
            <div class="token-list">
            {#each CHARACTER_CATEGORIES as category, i}
                    {#each unused_characters.filter(c => c.category === category) as character (character.id)}
                        {#if game.character_ids.includes(character.id) || game.bluff_ids.includes(character.id)}
                            <div class="token-wrapper" style="opacity: 0.4; filter: grayscale(0.4); pointer-events: none;">
                                <CharacterToken {character} size={tokenSize} />
                            </div>
                        {:else}
                            <div class="token-wrapper">
                                <CharacterToken {character} size={tokenSize} />
                                <button class="token-action" type="button" title="Add to game" onclick={() => addCharacter(character.id)} onpointerdown={e => e.stopPropagation()}>+</button>
                                <button class="token-action" type="button" title="Add as bluff" style="top:36px;" onclick={() => addBluff(character)} disabled={bluffs.length >= 3 || game.bluff_ids.find(id => id === character.id) !== undefined} onpointerdown={e => e.stopPropagation()}>B</button>
                            </div>
                        {/if}
                    {/each}
            {/each}
            </div>
        </div>

        <!-- RIGHT: In-Game and Bluffs -->
        <div class="admin-game-right">
            <div class="admin-game-section scrollable">
                <div class="in-a-row" style="justify-content: space-between;">
                    <h2>In-Game Characters</h2>
                    <button class="button-style error" type="button" onclick={removeAll} onpointerdown={e => e.stopPropagation()}>Remove All</button>
                </div>

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
                    {#each game.bluff_ids as bluffId}
                    {@const character = game.script.characters.find(c => c.id === bluffId)}
                    {#if character}
                        <div class="token-wrapper">
                            <CharacterToken {character} size={tokenSize} />
                            <button class="token-action" type="button" title="Remove bluff" onclick={() => removeBluff(character.id)} onpointerdown={e => e.stopPropagation()}>-</button>
                        </div>
                    {/if}
                    {/each}
                </div>
            </div>
        </div>
    </div>
    <!-- pointerDragging removed: touch/tablet drag now scrolls as normal -->
</div>
{/if}