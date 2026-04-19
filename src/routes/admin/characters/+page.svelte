<script lang="ts">
    import { deleteReminderToken, fetchReminderTokensForCharacter, updateReminderToken } from '$lib/client/database/reminder_tokens.js';
    import { CHARACTER_CATEGORIES, type ReminderToken } from '$lib/common/database/types.js';
    import ReminderTokenView from '$lib/components/ReminderTokenView.svelte';
    import { writable, type Writable } from 'svelte/store';

    export let data;



    $: dataCopy = JSON.parse(JSON.stringify(data));

    let selectedCharacterId: number | null = null;
    let selectedReminderTokenId: number | null = null;
    let searchQuery = '';
    let imageInput: HTMLInputElement | null = null;


    function selectCharacter(characterId: number) {
        selectedCharacterId = characterId;
        selectedReminderTokenId = null;
    }

    $: selectedCharacter = data.characters.find((char) => char.id === selectedCharacterId) || null;
    $: selectedReminderToken = $selectedCharacterTokens.find(token => token.id === selectedReminderTokenId) || null;
    let selectedCharacterTokens: Writable<ReminderToken[]> = writable([]);
    $: if (selectedCharacterId !== null) {
        fetchReminderTokensForCharacter(selectedCharacterId).then(tokens => {
            selectedCharacterTokens.set(tokens);
        });
    }

    let pendingImageFile: File | null = null;
    let previewUrl: string | null = null;
    let uploading = false;

    // Reset preview when switching characters
    $: if (selectedCharacterId !== null) {
        clearPreview();
    }

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
            body: JSON.stringify({ character_id: selectedCharacterId, text: '' }),
        }).then(res => {
            if (!res.ok) throw new Error(`Failed to create token: ${res.statusText}`);
            return res.json();
        }).then(responseData => {
            console.log('Created token:', responseData);
            // Optionally, you could also refresh the token list here to show the new token immediately
            fetchReminderTokensForCharacter(selectedCharacterId!).then(tokens => {
                selectedCharacterTokens.set(tokens);

                selectedReminderTokenId = responseData.id;
            });
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
                    selectedCharacterTokens.set(tokens);
                });
            }
        }).finally(()=>{
            selectedReminderTokenId = null;
        });
    }

    function onReminderTokenViewBackButtonClicked(){
        if(selectedReminderToken){
            updateReminderToken(selectedReminderToken.id, { text: selectedReminderToken.text }).then(()=>{
                return fetchReminderTokensForCharacter(selectedCharacterId!)
            }).then(tokens => {
                selectedCharacterTokens.set(tokens);
                selectedReminderTokenId = null;
            }).finally(() => {
                selectedReminderTokenId = null;
            });
        } else {
            selectedReminderTokenId = null;
        };
    }

    let imgCacheBust = Date.now();
    let hasImage = true;

    // Reset hasImage when switching characters
    $: if (selectedCharacterId) hasImage = true;

</script>

<style>
    .character-list-main {
        height: 100%;
        width: 100%;
        padding: 2em;
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

    li.selected {
        background-color: #555;
    }

    li {
        list-style: none;
        cursor: pointer;
        padding: 0.2em 0.6em;
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

<div class="character-list-main">
    <div class="character-list-grid">
        <div style="height: 100%; overflow: hidden; display: grid; grid-template-rows: auto 1fr; gap: 1em;">
            <h2 style="padding: 0; margin: 0;">Characters</h2>
            <div class="character-list">
                <input placeholder="Search..." bind:value={searchQuery} />
                <ul>
                    {#each data.characters.filter(char => char.name.toLowerCase().includes(searchQuery.toLowerCase())) as character (character.id)}
                        <li on:click={() => selectCharacter(character.id)} class:selected={selectedCharacterId === character.id}>
                            {character.name}
                        </li>
                    {/each}
                </ul>
            </div>

        </div>
        <div class="character-info">
            {#if selectedCharacter}
                {#if selectedReminderToken}
                    
                <button on:click={onReminderTokenViewBackButtonClicked}>Back</button>

                <div class="reminder-token-editor-container">
                    <ReminderTokenView data={selectedReminderToken} size="200px" />
                    <textarea style="width: 100%; max-width: 400px;" bind:value={selectedReminderToken.text}></textarea>
                    <button on:click={()=>onDeleteReminderToken(selectedReminderTokenId)}>Delete Token</button>
                </div>

                {:else}
                <div style="display: flex; justify-content: start; align-items: center; gap: 1em; margin-bottom: 1em;">
                    
                <button type="button" class="no-button-style" on:click={() => imageInput?.click()} style="">
                {#if previewUrl || hasImage}
                    <img
                        src={previewUrl || `/api/characters/${selectedCharacter.id}/img?v=${imgCacheBust}`}
                        alt={selectedCharacter.name}
                        style="width: 110px; display: block; margin-bottom: 0.5em; aspect-ratio: 1 / 1; object-fit: cover; border: 1px solid #ccc; border-radius: 50%;"
                        on:error={() => hasImage = false}
                    />
                {:else}
                    <span style="width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5em; border: 1px dashed #ccc; border-radius: 50%; color: #999;">No image</span>
                {/if}
                </button>

                <h1 style="margin: 0; padding: 0;">{selectedCharacter.name}</h1>
                </div>

                <input hidden bind:this={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" on:change={onFileSelected} />
                {#if pendingImageFile}
                    <button type="button" on:click={uploadImage} disabled={uploading}>
                        {uploading ? 'Uploading…' : 'Upload Image'}
                    </button>
                    <button type="button" on:click={clearPreview}>Cancel</button>
                {/if}

                <form>
                    <table style="width: 100%;">
                        <tbody>
                            <tr>
                                <th>ID:</th>
                                <td><input style="width: 100%;" type="text" placeholder="Character ID" value={selectedCharacter.id} readonly /></td>
                            </tr>
                            <tr>
                                <th>Name</th>
                                <td><input style="width: 100%;" type="text" placeholder="Character Name" bind:value={selectedCharacter.name} /></td>
                            </tr>
                            <tr>
                                <th>Group</th>
                                <td>
                                    <select style="width: 100%;" bind:value={selectedCharacter.category}>
                                        <option value="">(None)</option>
                                        {#each CHARACTER_CATEGORIES as group}
                                            <option value={group}>{group}</option>
                                        {/each}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th>Text</th>
                                <td><textarea style="width: 100%; height: 5em;" placeholder="Rules Text" bind:value={selectedCharacter.rules}></textarea></td>
                            </tr>

                            <tr>
                                <th></th>
                                <td>
                                    <button style="width: 100%;">Save Changes</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </form>

                <h3>Reminder Tokens</h3>
                <div class="reminder-token-container">
                    {#each $selectedCharacterTokens as token(token.id)}
                        <button class="no-button-style" on:click={() => selectedReminderTokenId = token.id} style="position: relative;">
                        <ReminderTokenView data={token} size="80px" />
                        </button>
                    {/each}
                    <button id="add-reminder-token-button" on:click={createNewReminderToken} >+</button>
                </div>
                {/if}
            {:else}
                <p>Select a character to view details</p>
            {/if}
        </div>
    </div>
</div>