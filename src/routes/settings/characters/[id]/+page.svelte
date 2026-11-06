<script lang="ts">
    import { deserialize } from '$app/forms';
    import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
    import { onMount, untrack } from 'svelte';
    import { createReminderToken, deleteReminderToken, fetchReminderTokensForCharacter, updateReminderToken } from '$lib/resources/client/reminderTokens.js';
    import { ALL_CHARACTER_CATEGORIES, type Character, type ReminderToken } from '$lib/resources/common/gameData.js';
    import type { MessagePreset, TextOption } from '$lib/common/message';
    import MessagePresetList, { sectionsByCategory } from '$lib/components/MessagePresetList.svelte';
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

    async function uploadImage(): Promise<boolean> {
        if (!pendingImageFile || !selectedCharacter) return true;
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
            return true;
        } catch (err) {
            console.error(err);
            alert('Image upload failed.');
            return false;
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

                    openReminderToken(responseData.id);
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

    // What the open reminder token was when opened (or last saved), to tell whether it's been changed and to reset it
    let savedReminderTokenJson = $state<string | null>(null);
    const reminderTokenJson = (token: ReminderToken) => JSON.stringify({ text: token.text, textSize: token.textSize });

    function openReminderToken(tokenId: string) {
        selectedReminderTokenId = tokenId;
        const token = selectedCharacterTokens.find(t => t.id === tokenId);
        savedReminderTokenJson = token ? reminderTokenJson(token) : null;
    }

    const reminderTokenChanged = $derived(!!selectedReminderToken && reminderTokenJson(selectedReminderToken) !== savedReminderTokenJson);

    function resetReminderToken() {
        if (!selectedReminderToken || !savedReminderTokenJson) return;
        Object.assign(selectedReminderToken, JSON.parse(savedReminderTokenJson));
    }

    // Saves the open reminder token, if it's been changed; whether it's saved
    async function saveReminderToken(): Promise<boolean> {
        const token = selectedReminderToken;
        if (!token || !reminderTokenChanged) return true;
        try {
            await updateReminderToken(selectedCharacterId, token.id, { text: token.text, textSize: token.textSize });
            savedReminderTokenJson = reminderTokenJson(token);
            return true;
        } catch (err) {
            console.error(err);
            alert(`Failed to save the reminder token: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }

    // The reminder token editor's back button: saves the token and goes back to the character
    async function closeReminderToken() {
        if (saving) return;
        saving = true;
        try {
            if (!await saveReminderToken()) return;
            selectedCharacterTokens = await fetchReminderTokensForCharacter(selectedCharacterId);
            selectedReminderTokenId = null;
        } finally {
            saving = false;
        }
    }

    // The character's fields this page edits, as saved by the updateCharacter action
    function characterFields(c: Character) {
        return {
            name: c.name, category: c.category, rules: c.rules, setup: c.setup,
            firstNightOrder: c.firstNightOrder ?? null, otherNightOrder: c.otherNightOrder ?? null,
            firstNightReminder: c.firstNightReminder, otherNightReminder: c.otherNightReminder,
            firstNightMessagePresets: c.firstNightMessagePresets, otherNightMessagePresets: c.otherNightMessagePresets,
            globalMessagePresets: c.globalMessagePresets,
        };
    }
    const characterFieldsJson = (c: Character) => JSON.stringify(characterFields(c));
    // What the character was when the page opened (or it was last saved), to tell whether it's been changed and to reset it
    let savedCharacterJson = $state(untrack(() => characterFieldsJson(selectedCharacter)));
    const characterChanged = $derived(characterFieldsJson(selectedCharacter) !== savedCharacterJson);

    function resetCharacter() {
        if (!confirm('Discard your changes to this character?')) return;
        Object.assign(selectedCharacter, JSON.parse(savedCharacterJson));
        clearPreview();
    }

    // Saves the character, if it's been changed; whether it's saved
    async function saveCharacter(): Promise<boolean> {
        const c = selectedCharacter;
        if (!characterChanged) return true;
        const formData = new FormData();
        formData.set('id', c.id);
        formData.set('name', c.name ?? '');
        formData.set('category', c.category ?? '');
        formData.set('rules', c.rules ?? '');
        formData.set('setup', c.setup ?? '');
        formData.set('firstNightOrder', c.firstNightOrder == null ? '' : String(c.firstNightOrder));
        formData.set('otherNightOrder', c.otherNightOrder == null ? '' : String(c.otherNightOrder));
        formData.set('firstNightReminder', c.firstNightReminder ?? '');
        formData.set('otherNightReminder', c.otherNightReminder ?? '');
        formData.set('firstNightMessagePresets', JSON.stringify(c.firstNightMessagePresets));
        formData.set('otherNightMessagePresets', JSON.stringify(c.otherNightMessagePresets));
        formData.set('globalMessagePresets', JSON.stringify(c.globalMessagePresets));
        try {
            const res = await fetch('?/updateCharacter', {
                method: 'POST',
                headers: { 'x-sveltekit-action': 'true' },
                body: formData,
            });
            const result = deserialize(await res.text());
            switch (result.type) {
                case 'success': {
                    const { success: _, ...updatedCharacter } = (result.data ?? {}) as Character & { success?: boolean };
                    selectedCharacter = { ...selectedCharacter, ...updatedCharacter };
                    savedCharacterJson = characterFieldsJson(selectedCharacter);
                    return true;
                }
                case 'failure':
                    alert(`Failed to save the character: ${result.data?.error || 'Unknown error'}`);
                    return false;
                case 'error':
                    alert(`Error when saving the character: ${result.error?.message ?? 'Unknown error'}`);
                    return false;
                default:
                    alert('Failed to save the character.');
                    return false;
            }
        } catch (err) {
            alert(`Failed to save the character: ${err instanceof Error ? err.message : err}`);
            return false;
        }
    }

    const hasUnsavedChanges = () => characterChanged || reminderTokenChanged || !!pendingImageFile;

    // Everything changed on the page is saved on leaving it (by the back button, the settings menu or the browser's back)
    let saving = $state(false);
    let leaving = false;
    beforeNavigate((nav) => {
        if (leaving) return;
        // Closing the tab or leaving the site can't wait for a save: have the browser ask instead
        if (nav.willUnload || !nav.to) {
            if (hasUnsavedChanges()) nav.cancel();
            return;
        }
        if (saving) { nav.cancel(); return; }
        if (!hasUnsavedChanges()) return;
        nav.cancel();
        const to = nav.to.url;
        const delta = nav.type === 'popstate' ? nav.delta : undefined;
        saving = true;
        (async () => {
            const saved = await saveReminderToken() && await saveCharacter() && await uploadImage();
            return saved || confirm('Your changes could not all be saved. Leave anyway?');
        })().then(leave => {
            if (!leave) return;
            leaving = true;
            if (delta) history.go(delta);
            else goto(to);
        }).finally(() => saving = false);
    });
    afterNavigate(() => { leaving = false; });

    function deleteCharacter(characterId: string) {
        if (!confirm('Are you sure you want to delete this character? This action cannot be undone.')) return;
        fetch(`/api/characters/${characterId}`, { method: 'DELETE' }).then(response => {
            if (!response.ok) {
                alert('Failed to delete character');
            } else {
                leaving = true;
                goto('/settings/characters');
            }
        }).catch(er => {
            alert(`Failed to delete character: ${er}`);
        });
    }

    // For building the character's message presets: every character to show, and the lines of text to pick from.
    let allCharacters = $state<Character[]>([]);
    let textOptions = $state<TextOption[]>([]);
    const allCharactersById = $derived(Object.fromEntries(allCharacters.map(c => [c.id, c])));
    const presetSections = $derived(sectionsByCategory(allCharacters));
    onMount(() => {
        fetch('/api/characters').then(r => r.json()).then((list: Character[]) => {
            allCharacters = list.sort((a, b) => a.name.localeCompare(b.name));
        }).catch(() => alert('Failed to fetch characters!'));
        fetch('/api/textOptions').then(r => r.json()).then((list: TextOption[]) => {
            textOptions = list;
        }).catch(() => alert('Failed to fetch text options!'));
    });
    const newMessagePreset = (): MessagePreset => ({ name: '', elements: [] });
    // The character's reminder tokens, for presets that find a character by one.
    const presetReminderTokens = $derived(selectedCharacterTokens.map(t => ({ ...t, characterId: selectedCharacterId })));

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

    .character-info :is(input, textarea)[readonly] {
        background-color: var(--theme-bg);
        color: var(--theme-on-bg-secondary);
    }

    .character-info textarea {
        resize: vertical;
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

    /* Wrapping groups of label + control, e.g. the night order */
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
        width: 8em;
    }

    .clear-order-button {
        padding: 0.2em 0.6em;
    }

    /* A night's reminder and communications while the character doesn't wake then: kept, but greyed out and locked */
    .character-info table.info-grid tr.inactive {
        opacity: 0.45;
    }

    /* Locks a night's communications without changing how they look */
    fieldset.presets-fieldset {
        margin: 0;
        padding: 0;
        border: none;
        min-width: 0;
    }

    .presets-description {
        margin: 0 0 0.6em;
        font-size: 0.9em;
        font-style: italic;
        opacity: 0.8;
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
            <!-- Changes are saved on going back -->
            {#if selectedReminderToken}
                <button type="button" class="button-style back-link" onclick={closeReminderToken} disabled={saving}>&lsaquo; {selectedCharacter.name || 'Character'}</button>
            {:else}
                <a class="button-style back-link" href="/settings/characters">{saving ? 'Saving…' : '‹ All Characters'}</a>
            {/if}
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
                        <button class="button-style" onclick={resetReminderToken} disabled={!reminderTokenChanged}>Reset Changes</button>
                        <button class="button-style error" onclick={()=>onDeleteReminderToken(selectedReminderTokenId)}>Delete Token</button>
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
                            <button class="button-style" onclick={resetCharacter} disabled={!characterChanged && !pendingImageFile}>Reset Changes</button>
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

                <form id="update-character-form" onsubmit={(e) => e.preventDefault()}>
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
                                <th>Setup</th>
                                <td><input name="setup" type="text" placeholder="e.g. +2 Outsiders (leave empty if it doesn't change setup)" bind:value={selectedCharacter.setup} /></td>
                            </tr>
                            <tr>
                                <th>Night Order</th>
                                <td>
                                    <!-- Empty means the character doesn't wake that night -->
                                    <div class="field-group">
                                        <label>
                                            First Night
                                            <input type="number" name="firstNightOrder" placeholder="Doesn't wake" bind:value={selectedCharacter.firstNightOrder} />
                                            <button type="button" class="button-style clear-order-button" title="Doesn't wake on the first night" disabled={selectedCharacter.firstNightOrder == null} onclick={() => selectedCharacter.firstNightOrder = null}>✕</button>
                                        </label>
                                        <label>
                                            Other Nights
                                            <input type="number" name="otherNightOrder" placeholder="Doesn't wake" bind:value={selectedCharacter.otherNightOrder} />
                                            <button type="button" class="button-style clear-order-button" title="Doesn't wake on other nights" disabled={selectedCharacter.otherNightOrder == null} onclick={() => selectedCharacter.otherNightOrder = null}>✕</button>
                                        </label>
                                    </div>
                                </td>
                            </tr>
                            <!-- A night's reminder is greyed out and locked (but kept) while the character doesn't wake then.
                                 Read-only rather than disabled, so it can still be selected and copied. -->
                            <tr class:inactive={selectedCharacter.firstNightOrder == null}>
                                <th>First Night Reminder</th>
                                <td><textarea name="firstNightReminder" style="height: 4em;" placeholder="What the storyteller does on the first night (leave empty to show the ability)" readonly={selectedCharacter.firstNightOrder == null} bind:value={selectedCharacter.firstNightReminder}></textarea></td>
                            </tr>
                            <tr class:inactive={selectedCharacter.otherNightOrder == null}>
                                <th>Other Nights Reminder</th>
                                <td><textarea name="otherNightReminder" style="height: 4em;" placeholder="What the storyteller does on other nights (leave empty to show the ability)" readonly={selectedCharacter.otherNightOrder == null} bind:value={selectedCharacter.otherNightReminder}></textarea></td>
                            </tr>
                        </tbody>
                    </table>
                </form>


                <h3>Reminder Tokens</h3>
                <div class="reminder-token-container">
                    {#each selectedCharacterTokens as token(token.id)}
                        <button class="no-button-style" onclick={() => openReminderToken(token.id)} style="position: relative;">
                        <ReminderTokenView data={token} characterId={selectedCharacterId} size="80px" />
                        </button>
                    {/each}
                    <button id="add-reminder-token-button" onclick={createNewReminderToken} >+</button>
                </div>

                <h3>Communications</h3>
                <p class="presets-description">Messages to show the player, offered from their token in the grim and from the night order: a night's while the character wakes that night, and the global ones always. A blank is filled in each time it's shown, and a Reminder element shows the character of the player beside that reminder on the grim (or is a blank if the reminder isn't there, or is there more than once).</p>
                <!-- Saved with the rest of the character. A night's are greyed out and locked (but kept) while the
                     character doesn't wake then. -->
                <table class="info-grid">
                    <tbody>
                        <tr class:inactive={selectedCharacter.firstNightOrder == null}>
                            <th>First Night</th>
                            <td>
                                <fieldset class="presets-fieldset" disabled={selectedCharacter.firstNightOrder == null}>
                                    <MessagePresetList bind:presets={selectedCharacter.firstNightMessagePresets} bind:textOptions sections={presetSections} characters={allCharactersById} newPreset={newMessagePreset} reminderTokens={presetReminderTokens} autoFill
                                        addLabel={selectedCharacter.firstNightOrder == null ? "This character doesn't wake on the first night" : undefined} />
                                </fieldset>
                            </td>
                        </tr>
                        <tr class:inactive={selectedCharacter.otherNightOrder == null}>
                            <th>Other Nights</th>
                            <td>
                                <fieldset class="presets-fieldset" disabled={selectedCharacter.otherNightOrder == null}>
                                    <MessagePresetList bind:presets={selectedCharacter.otherNightMessagePresets} bind:textOptions sections={presetSections} characters={allCharactersById} newPreset={newMessagePreset} reminderTokens={presetReminderTokens} autoFill
                                        addLabel={selectedCharacter.otherNightOrder == null ? "This character doesn't wake on other nights" : undefined} />
                                </fieldset>
                            </td>
                        </tr>
                        <tr>
                            <th>Global</th>
                            <td><MessagePresetList bind:presets={selectedCharacter.globalMessagePresets} bind:textOptions sections={presetSections} characters={allCharactersById} newPreset={newMessagePreset} reminderTokens={presetReminderTokens} autoFill /></td>
                        </tr>
                    </tbody>
                </table>
            {/if}
        </div>
    </div>
</div>
