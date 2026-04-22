<script lang="ts">
    import { enhance } from '$app/forms';
    import { page } from '$app/state';
    import { deleteReminderToken, fetchReminderTokensForCharacter, updateReminderToken } from '$lib/database/client/reminder_tokens.js';
    import { CHARACTER_CATEGORIES, type Character, type ReminderToken } from '$lib/database/common/types.js';
    import HSlider from '$lib/components/AudioMixerComponents/HSlider.svelte';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import ReminderTokenView from '$lib/components/ReminderTokenView.svelte';

    let {data}: {
        data: {
            characters: Character[]
        }
    } = $props();

    let newCharacterOverlayIsVisible = $state(false);

    let characters = $derived(data.characters);

    let selectedCharacterId = $state<number|null>(page.url.searchParams.has('characterId') ? parseInt(page.url.searchParams.get('characterId')!) : null);
    let selectedReminderTokenId = $state<number|null>(null);
    let searchQuery = $state<string>('');

    // svelte-ignore non_reactive_update
    let imageInput: HTMLInputElement;


    function selectCharacter(characterId: number) {
        selectedCharacterId = characterId;
        selectedReminderTokenId = null;
        // Update URL query parameter without reloading the page
        const url = new URL(window.location.href);
        url.searchParams.set('characterId', characterId.toString());
        history.pushState(null, '', url.toString());
    }

    let selectedCharacterTokens = $state<ReminderToken[]>([]);

    const selectedCharacter = $derived(characters.find((char) => char.id === selectedCharacterId) || null);
    const selectedReminderToken = $derived(selectedCharacterTokens.find(token => token.id === selectedReminderTokenId) || null);
    $effect(()=>{if (selectedCharacterId !== null && selectedCharacterId !== null) {
        fetchReminderTokensForCharacter(selectedCharacterId).then(tokens => {
            selectedCharacterTokens = tokens;
        });
    }});

    let pendingImageFile = $state<File | null>(null);
    let previewUrl = $state<string|null>(null);
    let uploading = $state(false);

    // Reset preview when switching characters
    $effect(()=>{if (selectedCharacterId !== null) {
        clearPreview();
    }});

    function clearPreview() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        pendingImageFile = null;
    }

    function onFileSelected(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        pendingImageFile = file;
        previewUrl = URL.createObjectURL(file);
    }

    async function uploadImage() {
        if (!pendingImageFile || !selectedCharacter) return;
        uploading = true;
        try {
            const res = await fetch(`/api/characters/${selectedCharacter.id}/img`, {
                method: 'PUT',
                headers: { 'Content-Type': pendingImageFile.type },
                body: pendingImageFile,
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
            clearPreview();
            // Bust browser cache for the default image
            imgCacheBust = Date.now();
        } catch (err) {
            console.error(err);
            alert('Image upload failed.');
        } finally {
            uploading = false;
        }
    }

    function createNewReminderToken(){
        if(!selectedCharacterId) return;
        console.log('Creating new reminder token for character ID:', selectedCharacterId);
        fetch('/api/reminder_tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ character_id: selectedCharacterId, text: '', textSize: 60 }),
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to create token: ${res.statusText}`);
            return res.json();
        }).then(responseData => {
            console.log('Created token:', responseData);
            if(selectedCharacterId) {
                // Optionally, you could also refresh the token list here to show the new token immediately
                fetchReminderTokensForCharacter(selectedCharacterId).then(tokens => {
                    selectedCharacterTokens = tokens;

                    selectedReminderTokenId = responseData.id;
                });
            }
        }).catch(err => {
            console.error(err);
            alert('Failed to create reminder token.');
        });
    }

    function onDeleteReminderToken(tokenId: number|null) {
        if(!tokenId || !selectedCharacterId) return;
        if(!confirm("This action cannot be undone. Are you sure you want to delete this reminder token?")) return;
        deleteReminderToken(tokenId).then(()=>{
            // Refresh token list after deletion
            if (selectedCharacterId) {
                fetchReminderTokensForCharacter(selectedCharacterId).then(tokens => {
                    selectedCharacterTokens = tokens;
                });
            }
        }).finally(()=>{
            selectedReminderTokenId = null;
        });
    }

    function onReminderTokenViewBackButtonClicked(){
        if(selectedReminderToken){
            updateReminderToken(selectedReminderToken.id, { text: selectedReminderToken.text, textSize: selectedReminderToken.textSize }).then(()=>{
                return fetchReminderTokensForCharacter(selectedCharacterId!)
            }).then(tokens => {
                selectedCharacterTokens = tokens;
                selectedReminderTokenId = null;
            }).finally(() => {
                selectedReminderTokenId = null;
            });
        } else {
            selectedReminderTokenId = null;
        };
    }

    function deleteCharacter(characterId: number) {
        if (!confirm('Are you sure you want to delete this character? This action cannot be undone.')) return;
        fetch(`/api/characters/${characterId}`, { method: 'DELETE' }).then(response => {
            if (!response.ok) {
                alert('Failed to delete character');
            } else {
                // Remove deleted character from local state
                characters = characters.filter(char => char.id !== characterId);
                if (selectedCharacterId === characterId) {
                    selectedCharacterId = null;
                }
            }
        }).catch(er => {
            alert(`Failed to delete character: ${er}`);
        });
    }

    let imgCacheBust = $state<number>(Date.now());
    let hasImage = $state<boolean>(true);

    // Reset hasImage when switching characters
    $effect(() => {
        if (selectedCharacterId) hasImage = true;
    });

</script>

<style>
    .character-list-main {
        height: 100%;
        width: 100%;
        padding: 2em;
        padding-top: 4em;
        box-sizing: border-box;
        overflow: hidden;
    }

    .character-list {
        overflow-y: auto;
        height: 100%;
        background-color: var(--theme-bg-secondary);
        padding: 1em;
        box-sizing: border-box;
    }

    li > button {
        width: 100%;
        cursor: pointer;
        padding: 0.2em 0.6em;
        box-sizing: border-box;
    }

    li > button.selected {
        background-color: #555;
    }

    li {
        list-style: none;
    }

    ul {
        padding: 0;
        margin: 0;
    }

    .character-list-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 2em;
        height: 100%;
        width: 100%;
        background-color: var(--theme-bg);
        padding: 2em;
        box-sizing: border-box;
    }

    #add-reminder-token-button {
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2em;
        background-color: var(--theme-bg-secondary);
        border: 1px dashed #ccc;
        border-radius: 8px;
        color: #999;
        cursor: pointer;
    }

    .reminder-token-container {
        display: flex;
        gap: 1em;
        flex-wrap: wrap;
    }
    
    .reminder-token-editor-container {
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 1em;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

</style>

<Navbar/>

<div class="character-list-main">
    <div class="character-list-grid">
        <div style="height: 100%; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; gap: 1em;">
            <div class="in-a-row">
                <h2 style="padding: 0; margin: 0;">Characters</h2>
                <CustomOverlay title="Create New Character" buttonTitle="+" bind:visible={newCharacterOverlayIsVisible}>
                    <form action="?/createCharacter" method="POST" use:enhance={()=>{
                        return async ({result}) => {
                            if(result.type === 'success'){
                                const newCharacter = result.data as Character;
                                characters = [...characters, newCharacter].sort((a, b) => a.name.localeCompare(b.name));
                                selectCharacter(newCharacter.id);
                                newCharacterOverlayIsVisible = false;
                            }
                        }
                    }}>
                        <input type="text" name="name" placeholder="Character Name (Required)" required style="width: 100%; margin-bottom: 1em;"/>
                        <select name="category" style="width: 100%; margin-bottom: 1em;" required>
                            <option value="" disabled selected>Character Category (Required)</option>
                            {#each CHARACTER_CATEGORIES as group}
                                <option value={group}>{group}</option>
                            {/each}
                        </select>
                        <button type="submit">Submit</button>
                    </form>
                </CustomOverlay>
            </div>
            <div class="character-list">
                <input placeholder="Search..." bind:value={searchQuery} />
                <ul>
                    {#each characters.filter(char => char.name.toLowerCase().includes(searchQuery.toLowerCase())) as character (character.id)}
                        <li>
                            <button class="no-button-style" onclick={() => selectCharacter(character.id)} class:selected={selectedCharacterId === character.id}>
                                {character.name}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
                <a class="button-style" style="width: 100%;" href="characters/scrape">Image Scraper</a>

        </div>
        <div class="character-info">
            {#if selectedCharacter}
                {#if selectedReminderToken}
                    

                <div class="reminder-token-editor-container">
                    <div style="display: grid; grid-template-columns: auto auto; align-items: end; gap: 10px;">
                        <ReminderTokenView data={selectedReminderToken} size="200px" />
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <ReminderTokenView data={selectedReminderToken} size="50px" />
                            <ReminderTokenView data={selectedReminderToken} size="100px" />
                        </div>
                    </div>

                    <table class="info-grid">
                        <tbody>
                            <tr>
                                <th>Text</th>
                                <td>
                                    <textarea style="width: 100%; height: 8em;" bind:value={selectedReminderToken.text}></textarea>
                                </td>
                            </tr>
                            <tr>
                                <th>Text Size</th>
                                <td>
                                    <div style="text-align: center;">{selectedReminderToken.textSize}%</div>
                                    <HSlider bind:value={selectedReminderToken.textSize} min={10} max={100} step={1} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="in-a-row">
                        <button onclick={()=>onDeleteReminderToken(selectedReminderTokenId)}>Delete Token</button>
                        <button onclick={onReminderTokenViewBackButtonClicked}>Save Changes</button>
                    </div>
                </div>


                {:else}
                <div class="in-a-row">
                        
                    <button type="button" class="no-button-style" onclick={() => imageInput?.click()} style="">
                    {#if previewUrl || hasImage}
                        <img
                            src={previewUrl || `/api/characters/${selectedCharacter.id}/img?v=${imgCacheBust}`}
                            alt={selectedCharacter.name}
                            style="width: 110px; display: block; margin-bottom: 0.5em; aspect-ratio: 1 / 1; object-fit: cover; border: 1px solid #ccc; border-radius: 50%;"
                            onerror={() => hasImage = false}
                        />
                    {:else}
                        <span style="width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5em; border: 1px dashed #ccc; border-radius: 50%; color: #999;">No image</span>
                    {/if}
                    </button>

                    <div class="in-a-column" style="align-items: start;">
                        <h1 style="margin: 0; padding: 0;">{selectedCharacter.name}</h1>

                        <div class="in-a-row center-content">
                            <button class="button-style highlight" type="submit" form="update-character-form">Save Changes</button>
                            <button class="button-style error" onclick={() => deleteCharacter(selectedCharacter.id)}>Delete</button>
                        </div>
                    </div>
                </div>

                <input hidden bind:this={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={onFileSelected} />
                {#if pendingImageFile}
                    <button type="button" onclick={uploadImage} disabled={uploading}>
                        {uploading ? 'Uploading…' : 'Upload Image'}
                    </button>
                    <button type="button" onclick={clearPreview}>Cancel</button>
                {/if}

                <form id="update-character-form" action="?/updateCharacter" method="POST" use:enhance={()=>{
                    return async ({result}) => {
                        switch(result.type){
                            case 'success': {
                                const updatedCharacter = result.data as Character;
                                characters = characters.map(char => char.id === updatedCharacter.id ? updatedCharacter : char).sort((a, b) => a.name.localeCompare(b.name));
                                alert('Character updated successfully');
                                break;
                            }
                            case 'error': {
                                alert(`Error when updating character: ${result.error.message}`);
                                break;
                            }
                            case 'failure': {
                                alert(`Failed to update character: ${result.data?.error || "Unknown error"}`);
                                break;
                            }
                        }
                    }
                }}>
                    <table class="info-grid">
                        <tbody>
                            <tr>
                                <th>ID:</th>
                                <td><input name="id" style="width: 100%;" type="number" placeholder="Character ID" value={selectedCharacter.id} readonly /></td>
                            </tr>
                            <tr>
                                <th>Name</th>
                                <td><input name="name" style="width: 100%;" type="text" placeholder="Character Name" bind:value={selectedCharacter.name} /></td>
                            </tr>
                            <tr>
                                <th>Group</th>
                                <td>
                                    <select name="category" style="width: 100%;" bind:value={selectedCharacter.category}>
                                        <option value="">(None)</option>
                                        {#each CHARACTER_CATEGORIES as group}
                                            <option value={group}>{group}</option>
                                        {/each}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th>Text</th>
                                <td><textarea name="rules" style="width: 100%; height: 5em;" placeholder="Rules Text" bind:value={selectedCharacter.rules}></textarea></td>
                            </tr>
                            <tr>
                                <th>Other</th>
                                <td>
                                    <div class="in-a-row">
                                        <label for="wakes_first_night">Wakes First Night</label>
                                        <input type="checkbox" id="wakes_first_night" name="wakes_first_night" bind:checked={selectedCharacter.wakes_first_night} />

                                        <label for="wakes_other_nights">Wakes Other Nights</label>
                                        <input type="checkbox" id="wakes_other_nights" name="wakes_other_nights" bind:checked={selectedCharacter.wakes_other_nights} />


                                        <label for="counts_as_player">Counts as Player</label>
                                        <input type="checkbox" id="counts_as_player" name="counts_as_player" checked={selectedCharacter.player_count > 0} onchange={(e)=>selectedCharacter.player_count = (e.target as HTMLInputElement).checked ? 1 : 0}/>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </form>

                <h3>Reminder Tokens</h3>
                <div class="reminder-token-container">
                    {#each selectedCharacterTokens as token(token.id)}
                        <button class="no-button-style" onclick={() => selectedReminderTokenId = token.id} style="position: relative;">
                        <ReminderTokenView data={token} size="80px" />
                        </button>
                    {/each}
                    <button id="add-reminder-token-button" onclick={createNewReminderToken} >+</button>
                </div>

                {/if}

            {:else}
                <p>Select a character to view details</p>
            {/if}
        </div>
    </div>
</div>