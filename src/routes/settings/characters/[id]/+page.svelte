<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import { untrack } from 'svelte';
    import { createReminderToken, deleteReminderToken, fetchReminderTokensForCharacter, updateReminderToken } from '$lib/resources/client/reminderTokens.js';
    import { ALL_CHARACTER_CATEGORIES, type Character, type ReminderToken } from '$lib/resources/common/gameData.js';
    import HSlider from '$lib/audio/client/components/HSlider.svelte';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';
    import ReminderTokenView from '$lib/components/ReminderTokenView.svelte';

    let {data}: {
        data: {
            character: Character
        }
    } = $props();

    // Local editable copy, re-synced when navigating to another character
    let selectedCharacter = $state<Character>(untrack(() => ({ ...data.character })));
    const selectedCharacterId = $derived(selectedCharacter.id);
    let selectedReminderTokenId = $state<string|null>(null);

    // svelte-ignore non_reactive_update
    let imageInput: HTMLInputElement;

    let selectedCharacterTokens = $state<ReminderToken[]>([]);

    const selectedReminderToken = $derived(selectedCharacterTokens.find(token => token.id === selectedReminderTokenId) || null);
    $effect(()=>{
        fetchReminderTokensForCharacter(selectedCharacterId).then(tokens => {
            selectedCharacterTokens = tokens;
        });
    });

    let pendingImageFile = $state<File | null>(null);
    let previewUrl = $state<string|null>(null);
    let uploading = $state(false);

    // Reset preview when switching characters
    $effect(()=>{
        selectedCharacterId;
        untrack(clearPreview);
    });

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
        createReminderToken(selectedCharacterId).then(responseData => {
            console.log('Created token:', responseData);
            if(selectedCharacterId) {
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

    function onDeleteReminderToken(tokenId: string|null) {
        if(!tokenId || !selectedCharacterId) return;
        if(!confirm("This action cannot be undone. Are you sure you want to delete this reminder token?")) return;
        deleteReminderToken(selectedCharacterId, tokenId).then(()=>{
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
        if(selectedReminderToken && selectedCharacterId){
            updateReminderToken(selectedCharacterId, selectedReminderToken.id, { text: selectedReminderToken.text, textSize: selectedReminderToken.textSize }).then(()=>{
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

    function deleteCharacter(characterId: string) {
        if (!confirm('Are you sure you want to delete this character? This action cannot be undone.')) return;
        fetch(`/api/characters/${characterId}`, { method: 'DELETE' }).then(response => {
            if (!response.ok) {
                alert('Failed to delete character');
            } else {
                goto('/settings/characters');
            }
        }).catch(er => {
            alert(`Failed to delete character: ${er}`);
        });
    }

    let imgCacheBust = $state<number>(Date.now());
    let hasImage = $state<boolean>(true);

    // Reset hasImage when switching characters
    $effect(() => {
        selectedCharacterId;
        hasImage = true;
    });

</script>

<style>
    .character-list-main {
        height: 100%;
        width: 100%;
        overflow: hidden;
    }

    .character-list-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 2em;
        height: 100%;
        width: 100%;
        overflow-y: auto;
        background-color: var(--theme-bg);
        padding: 2em;
        box-sizing: border-box;
    }

    .character-info {
        min-width: 0;
    }

    .back-link {
        display: inline-block;
        margin-bottom: 1.5em;
    }

    /* Themed form controls */
    .character-info :is(input[type="text"], input[type="number"], textarea, select) {
        box-sizing: border-box;
        padding: 0.5rem 0.6rem;
        border: 1px solid transparent;
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    .character-info :is(input, textarea)::placeholder {
        color: inherit;
        opacity: 0.55;
    }

    .character-info :is(input[type="text"], input[type="number"], textarea, select):focus {
        outline: none;
        border-color: var(--theme-highlight);
    }

    .character-info input[readonly] {
        background-color: var(--theme-bg);
        color: var(--theme-on-bg-secondary);
    }

    .character-info textarea {
        resize: vertical;
    }

    .character-info input[type="checkbox"] {
        accent-color: var(--theme-highlight);
        width: 1.2em;
        height: 1.2em;
        margin: 0;
    }

    /* Header: image, name and actions */
    .character-header {
        display: flex;
        align-items: center;
        gap: 1em;
        margin-bottom: 1em;
    }

    .character-header-text {
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 0.5em;
        min-width: 0;
    }

    .character-header h1 {
        margin: 0;
        padding: 0;
        overflow-wrap: anywhere;
    }

    .character-image {
        width: 110px;
        aspect-ratio: 1 / 1;
        display: block;
        object-fit: cover;
        border: 1px solid #ccc;
        border-radius: 50%;
    }

    .character-image.empty {
        height: 110px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-style: dashed;
        color: #999;
    }

    .button-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5em;
    }

    .upload-row {
        margin-bottom: 1em;
    }

    /* Wrapping groups of label + control, e.g. checkboxes and night order */
    .field-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6em 1.4em;
    }

    .field-group label {
        display: inline-flex;
        align-items: center;
        gap: 0.5em;
        white-space: nowrap;
    }

    .field-group input[type="number"] {
        width: 6em;
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
        gap: 1em;
        justify-content: center;
        align-items: center;
        width: 100%;
    }

    .reminder-token-previews {
        display: grid;
        grid-template-columns: auto auto;
        align-items: end;
        gap: 10px;
    }

    .reminder-token-previews-small {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    @media (max-width: 600px) {
        .character-list-grid {
            padding: 1em;
        }

        .character-image {
            width: 80px;
        }

        .character-image.empty {
            height: 80px;
        }

        .character-header h1 {
            font-size: 1.6rem;
        }

        /* Stack each label above its field */
        .character-info table.info-grid,
        .character-info table.info-grid tbody,
        .character-info table.info-grid tr,
        .character-info table.info-grid th,
        .character-info table.info-grid td {
            display: block;
            width: 100%;
            box-sizing: border-box;
        }

        .character-info table.info-grid tr {
            border: 1px solid #ddd4;
            border-bottom: none;
        }

        .character-info table.info-grid tr:last-child {
            border-bottom: 1px solid #ddd4;
        }

        .character-info table.info-grid th,
        .character-info table.info-grid td {
            border: none;
        }

        .character-info table.info-grid th {
            text-align: start;
            padding-bottom: 0;
            opacity: 0.8;
        }

        .reminder-token-editor-container .button-row {
            justify-content: center;
        }
    }
</style>

<div class="character-list-main">
    <div class="character-list-grid">
        <div class="character-info">
            <a class="button-style back-link" href="/settings/characters">&lsaquo; All Characters</a>
            {#if selectedReminderToken}
                <div class="reminder-token-editor-container">
                    <div class="reminder-token-previews">
                        <ReminderTokenView data={selectedReminderToken} characterId={selectedCharacterId} size="min(200px, 50vw)" />
                        <div class="reminder-token-previews-small">
                            <ReminderTokenView data={selectedReminderToken} characterId={selectedCharacterId} size="min(50px, 12.5vw)" />
                            <ReminderTokenView data={selectedReminderToken} characterId={selectedCharacterId} size="min(100px, 25vw)" />
                        </div>
                    </div>

                    <table class="info-grid">
                        <tbody>
                            <tr>
                                <th>Text</th>
                                <td>
                                    <textarea style="height: 8em;" bind:value={selectedReminderToken.text}></textarea>
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
                    <div class="button-row">
                        <button class="button-style error" onclick={()=>onDeleteReminderToken(selectedReminderTokenId)}>Delete Token</button>
                        <button class="button-style highlight" onclick={onReminderTokenViewBackButtonClicked}>Save Changes</button>
                    </div>
                </div>
            {:else}
                <div class="character-header">
                    <button type="button" class="no-button-style" onclick={() => imageInput?.click()} aria-label="Change image">
                    {#if previewUrl || hasImage}
                        <img
                            class="character-image"
                            src={previewUrl || `/api/characters/${selectedCharacter.id}/img?v=${imgCacheBust}`}
                            alt={selectedCharacter.name}
                            onerror={() => hasImage = false}
                        />
                    {:else}
                        <span class="character-image empty">No image</span>
                    {/if}
                    </button>

                    <div class="character-header-text">
                        <h1>{selectedCharacter.name}</h1>

                        <div class="button-row">
                            <button class="button-style highlight" type="submit" form="update-character-form">Save Changes</button>
                            <button class="button-style error" onclick={() => deleteCharacter(selectedCharacter.id)}>Delete</button>
                        </div>
                    </div>
                </div>

                <input hidden bind:this={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={onFileSelected} />
                {#if pendingImageFile}
                    <div class="button-row upload-row">
                        <button type="button" class="button-style highlight" onclick={uploadImage} disabled={uploading}>
                            {uploading ? 'Uploading…' : 'Upload Image'}
                        </button>
                        <button type="button" class="button-style" onclick={clearPreview}>Cancel</button>
                    </div>
                {/if}

                <form id="update-character-form" action="?/updateCharacter" method="POST" use:enhance={()=>{
                    return async ({result}) => {
                        switch(result.type){
                            case 'success': {
                                const updatedCharacter = result.data as Character;
                                selectedCharacter = { ...selectedCharacter, ...updatedCharacter };
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
                                <th>ID</th>
                                <td><input name="id" type="text" placeholder="Character ID" value={selectedCharacter.id} readonly /></td>
                            </tr>
                            <tr>
                                <th>Name</th>
                                <td><input name="name" type="text" placeholder="Character Name" bind:value={selectedCharacter.name} /></td>
                            </tr>
                            <tr>
                                <th>Group</th>
                                <td>
                                    <select name="category" bind:value={selectedCharacter.category}>
                                        <option value="">(None)</option>
                                        {#each ALL_CHARACTER_CATEGORIES as group}
                                            <option value={group}>{group}</option>
                                        {/each}
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th>Text</th>
                                <td><textarea name="rules" style="height: 5em;" placeholder="Rules Text" bind:value={selectedCharacter.rules}></textarea></td>
                            </tr>
                            <tr>
                                <th>Other</th>
                                <td>
                                    <div class="field-group">
                                        <label>
                                            <input type="checkbox" name="wakes_first_night" bind:checked={selectedCharacter.wakes_first_night} />
                                            Wakes First Night
                                        </label>
                                        <label>
                                            <input type="checkbox" name="wakes_other_nights" bind:checked={selectedCharacter.wakes_other_nights} />
                                            Wakes Other Nights
                                        </label>
                                        <label>
                                            <input type="checkbox" name="counts_as_player" checked={selectedCharacter.player_count > 0} onchange={(e)=>selectedCharacter.player_count = (e.target as HTMLInputElement).checked ? 1 : 0}/>
                                            Counts as Player
                                        </label>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th>Default Night Order</th>
                                <td>
                                    <div class="field-group">
                                        <label>
                                            First Night
                                            <input type="number" name="defaultFirstNightOrder" value={selectedCharacter.defaultFirstNightOrder ?? ''} />
                                        </label>
                                        <label>
                                            Other Nights
                                            <input type="number" name="defaultOtherNightOrder" value={selectedCharacter.defaultOtherNightOrder ?? ''} />
                                        </label>
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
                        <ReminderTokenView data={token} characterId={selectedCharacterId} size="80px" />
                        </button>
                    {/each}
                    <button id="add-reminder-token-button" onclick={createNewReminderToken} >+</button>
                </div>
            {/if}
        </div>
    </div>
</div>
