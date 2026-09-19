<script lang="ts">
    import { goto } from "$app/navigation";
    import { CHARACTER_CATEGORIES, type Character, type PresetFull } from "$lib/resources/common/gameData.js";
    import { getPlayerCount } from "$lib/common/util";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import { enhance } from "$app/forms";

    interface Props {
        data: {
            preset: PresetFull | null;
            error?: string;
        }
    }

    let {data}: Props = $props();

    // Set token size variable here
    const tokenSize = $state('150px');

    // svelte-ignore state_referenced_locally
    let preset = $state(data.preset);

    const unused_characters = $derived(preset ? preset.script.characters : []);
    const used_characters = $derived(preset ? preset.script.characters.filter(c => preset.character_ids.includes(c.id) && !preset.bluff_ids.includes(c.id)) : []);

    const bluffs = $derived(preset ? preset.bluff_ids.map(id => preset.script.characters.find(c => c.id === id)).filter(Boolean) : []);

    const currentTownsfolkCount = $derived(used_characters.filter(c => c.category === 'townsfolk').length);
    const currentOutsiderCount = $derived(used_characters.filter(c => c.category === 'outsider').length);
    const currentMinionCount = $derived(used_characters.filter(c => c.category === 'minion').length);
    const currentDemonCount = $derived(used_characters.filter(c => c.category === 'demon').length);

    let expectedPlayerCount = $state(7);
    const expectedCharacterCounts = $derived(getPlayerCount(Number(expectedPlayerCount)));

    function removeAll(){
        if(!preset) return;
        preset.character_ids = [];
    }

    function addCharacter(characterId: string){
        if(!preset) return;
        // Remove from bluffs if present
        preset.bluff_ids = preset.bluff_ids.filter(id => id !== characterId);
        // Add to in-play if not present
        if(!preset.character_ids.includes(characterId)){
            preset.character_ids.push(characterId);
        }
    }

    function removeCharacter(characterId: string){
        if(!preset) return;
        preset.character_ids = preset.character_ids.filter((id: string) => id !== characterId);
    }

    function addBluff(character: Character) {
        if (!preset) return;
        if (bluffs.length >= 3) return;
        if (!preset.bluff_ids.find(id => id === character.id)) {
            // Remove from in-play if present
            preset.character_ids = preset.character_ids.filter((id: string) => id !== character.id);
            // Add to bluffs
            preset.bluff_ids.push(character.id);
        }
    }
    function removeBluff(characterId: string) {
        if (!preset) return;
        preset.bluff_ids = preset.bluff_ids.filter(id => id !== characterId);
    }
</script>


<style>
.preset-editor-main {
    touch-action: none;
}
.preset-editor-layout {
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

.preset-editor-left {
    height: 100%;
    background: var(--theme-bg-secondary);
    padding: 1em;
    border-radius: 1em;
    box-sizing: border-box;
}
.preset-editor-right {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 1em;
    height: 100%;
    overflow: hidden;
}
.preset-editor-section {
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

.preset-editor-main {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
    width: 100%;
}

.preset-editor-header {
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


{#if !preset}
    <h1>Preset not found</h1>
    {#if data.error}
        <p>{data.error}</p>
    {/if}
{:else}
<div class="preset-editor-main">
    <div class="preset-editor-header padded">
        <div class="in-a-row">
            <a href="/settings/scripts/{preset.script.id}" class="button-style" style="height: 100%;">← Back</a>
            <div>
                <input type="text" bind:value={preset.name} placeholder="Preset name" style="font-size: 1.2em;" class="input-style"/>
                <div style="opacity: 0.6;">{preset.script.name}</div>
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
        <form action="?/save" method="POST" use:enhance={()=>{
            return async ({result}) => {
                switch(result.type){
                    case 'success':
                        goto(`/settings/scripts/${preset.script.id}`);
                        break;
                    case 'redirect':
                        break;
                    case 'failure':
                        alert(`Failed to save preset: ${result.data?.error || 'Unknown error'}`);
                        break;
                    case 'error':
                        alert(`Failed to save preset: ${result.error}`);
                        break;
                }
            }
        }}>
            <input type="hidden" name="name" value={preset.name}/>
            <input type="hidden" name="characterIds" value={preset.character_ids.join(',')}/>
            <input type="hidden" name="bluffIds" value={preset.bluff_ids.join(',')}/>
            <button type="submit" class="button-style highlight">Save</button>
        </form>
    </div>
    <div class="preset-editor-layout" style="--token-size: {tokenSize}">
        <!-- LEFT: Available Characters -->
        <div class="preset-editor-left scrollable">
            <h2>Available Characters</h2>
            <div class="token-list">
            {#each CHARACTER_CATEGORIES as category, i}
                    {#each unused_characters.filter(c => c.category === category) as character (character.id)}
                        {#if preset.character_ids.includes(character.id) || preset.bluff_ids.includes(character.id)}
                            <div class="token-wrapper" style="opacity: 0.4; filter: grayscale(0.4); pointer-events: none;">
                                <CharacterToken {character} size={tokenSize} />
                            </div>
                        {:else}
                            <div class="token-wrapper">
                                <CharacterToken {character} size={tokenSize} />
                                <button class="token-action" type="button" title="Add to preset" onclick={() => addCharacter(character.id)} onpointerdown={e => e.stopPropagation()}>+</button>
                                <button class="token-action" type="button" title="Add as bluff" style="top:36px;" onclick={() => addBluff(character)} disabled={bluffs.length >= 3 || preset.bluff_ids.find(id => id === character.id) !== undefined} onpointerdown={e => e.stopPropagation()}>B</button>
                            </div>
                        {/if}
                    {/each}
            {/each}
            </div>
        </div>

        <!-- RIGHT: In-Play and Bluffs -->
        <div class="preset-editor-right">
            <div class="preset-editor-section scrollable">
                <div class="in-a-row" style="justify-content: space-between;">
                    <h2>In-Play Characters</h2>
                    <button class="button-style error" type="button" onclick={removeAll} onpointerdown={e => e.stopPropagation()}>Remove All</button>
                </div>

                <div class="token-list">
                {#each CHARACTER_CATEGORIES as category}
                        {#each used_characters.filter(c => c.category === category) as character (character.id)}
                            <div class="token-wrapper">
                                <CharacterToken {character} size={tokenSize} />
                                <button class="token-action" type="button" title="Remove from preset" onclick={() => removeCharacter(character.id)} onpointerdown={e => e.stopPropagation()}>-</button>
                            </div>
                        {/each}
                {/each}
                </div>
            </div>
            <div class="preset-editor-section bluffs">
                <h2>Bluffs ({bluffs.length}/3)</h2>
                <div class="token-list">
                    {#each preset.bluff_ids as bluffId}
                    {@const character = preset.script.characters.find(c => c.id === bluffId)}
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
</div>
{/if}
