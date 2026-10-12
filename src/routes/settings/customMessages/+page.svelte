<script lang="ts">
    import type { CustomMessage, MessageField } from "$lib/common/customMessage";
    import type { Character } from "$lib/resources/common/gameData";
    import { onMount } from "svelte";
    import { characterImageUrl } from "$lib/resources/common/characterImages";

    let messages: CustomMessage[] = $state([]);
    let characters: Character[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(messages) !== savedSnapshot);

    const charactersById = $derived(new Map(characters.map(c => [c.id, c])));

    onMount(() => {
        fetch('/api/characters').then(r => r.json()).then((data: Character[]) => {
            characters = data.sort((a, b) => a.name.localeCompare(b.name));
        }).catch(() => {
            alert('Failed to fetch characters!');
        });

        fetch('/api/customMessages').then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to fetch');
        }).then(data => {
            messages = data;
            savedSnapshot = JSON.stringify(data);
        }).catch(() => {
            alert('Failed to fetch custom messages!');
        });
    });

    function save() {
        const snapshot = JSON.stringify(messages);
        fetch('/api/customMessages', {
            method: 'POST',
            body: snapshot,
            headers: { 'Content-Type': 'application/json' }
        }).then(res => {
            if (res.ok) {
                savedSnapshot = snapshot;
                alert('Saved!');
            } else {
                res.json().then(t => {
                    alert(`Failed to save (${res.status})\n${t.message}`);
                }).catch(() => {
                    alert("Failed to save");
                });
            }
        });
    }

    // Which message is currently choosing a field type to add (null when none).
    let addFieldFor = $state<number | null>(null);

    function addField(mi: number, type: MessageField['type']) {
        messages[mi].fields.push(type === 'text' ? { type: 'text', value: '' } : { type: 'character', value: [] });
        addFieldFor = null;
    }

    // The token row/slot currently open in the character-picker overlay.
    let picker = $state<{ mi: number, fi: number, ti: number } | null>(null);

    function pickCharacter(characterId: string | null) {
        if (!picker) return;
        const field = messages[picker.mi].fields[picker.fi];
        if (field.type === 'character') field.value[picker.ti] = characterId;
        picker = null;
    }
</script>

<div class="center-content main">
<div class="panel">
<div class="panel-header">
    <h2>Grim messages</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Messages listed in the grim's communications menu, in all games. A character field can hold a blank token (shown as "?") for the storyteller to fill in with a specific character when they use the message.</p>

<div class="message-list">
    {#each messages as message, mi}
        <div class="message-card">
            <div class="message-card-header">
                <span class="message-index">Message {mi + 1}</span>
                <button class="delete-message" onclick={() => messages.splice(mi, 1)}>Delete message</button>
            </div>
            <div class="field-stack">
                {#each message.fields as field, fi}
                    <div class="field-row">
                        {#if field.type === 'text'}
                            <input class="field-text" type="text" bind:value={field.value} placeholder="Text" />
                        {:else}
                            <div class="token-row">
                                {#each field.value as characterId, ti}
                                    {@const character = characterId ? charactersById.get(characterId) : undefined}
                                    <button
                                        class="token-chip"
                                        class:blank={!characterId}
                                        title={character?.name ?? 'Blank - fill in when used'}
                                        onclick={() => picker = { mi, fi, ti }}
                                    >
                                        {#if characterId}
                                            <img src={characterImageUrl(characterId, 128)} alt={character?.name ?? ''} />
                                        {:else}
                                            <span class="mark">?</span>
                                        {/if}
                                    </button>
                                {/each}
                                <button class="token-chip add-token" title="Add a token" onclick={() => field.value.push(null)}>
                                    <span class="mark">+</span>
                                </button>
                            </div>
                        {/if}
                        <button class="remove-field" title="Remove field" onclick={() => message.fields.splice(fi, 1)}>✕</button>
                    </div>
                {/each}

                {#if addFieldFor === mi}
                    <div class="add-field-choice">
                        <span>Add a…</span>
                        <button onclick={() => addField(mi, 'text')}>Text</button>
                        <button onclick={() => addField(mi, 'character')}>Character</button>
                        <button onclick={() => addFieldFor = null}>Cancel</button>
                    </div>
                {:else}
                    <button class="add-field" onclick={() => addFieldFor = mi}>+ Add field</button>
                {/if}
            </div>
        </div>
    {:else}
        <div class="empty">No messages yet.</div>
    {/each}
    <button class="add-message" onclick={() => messages.push({ fields: [] })}>+ Add Message</button>
</div>
</div>
</div>

{#if picker}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="picker-overlay" role="dialog" tabindex="-1" onclick={() => picker = null}>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="picker-panel" onclick={(e) => e.stopPropagation()}>
            <div class="picker-header">
                <h3>Choose a character</h3>
                <button class="picker-close" onclick={() => picker = null} aria-label="Close">✕</button>
            </div>
            <div class="picker-grid">
                <button class="token-chip large blank" title="Empty" onclick={() => pickCharacter(null)}>
                    <span class="mark">?</span>
                </button>
                {#each characters as character (character.id)}
                    <button class="token-chip large" title={character.name} onclick={() => pickCharacter(character.id)}>
                        <img src={characterImageUrl(character.id, 128)} alt={character.name} />
                    </button>
                {/each}
            </div>
        </div>
    </div>
{/if}

<style>

    .main {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        align-items: flex-start;
    }

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
        width: 100%;
        max-width: 44rem;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .message-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .empty {
        opacity: 0.6;
        font-style: italic;
        padding: 0.5rem 0;
    }

    .message-card {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .message-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .message-index {
        font-weight: 600;
        opacity: 0.8;
    }

    .field-stack {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .field-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .field-text {
        flex: 1;
    }

    .token-row {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
    }

    .token-chip {
        flex-shrink: 0;
        width: 3em;
        height: 3em;
        border-radius: 50%;
        padding: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--theme-slider-trim);
        background-color: var(--theme-bg-secondary);
    }

    .token-chip.large {
        width: 4em;
        height: 4em;
    }

    .token-chip img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .token-chip .mark {
        font-size: 1.3em;
        font-weight: bold;
        opacity: 0.8;
    }

    .token-chip.blank .mark {
        font-size: 1.5em;
    }

    .token-chip.add-token {
        border-style: dashed;
        background-color: transparent;
    }

    .token-chip.add-token:hover {
        border-color: var(--theme-highlight);
    }

    .remove-field {
        flex-shrink: 0;
        padding: 0.3em 0.5em;
    }

    .add-field-choice {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    button.add-field, button.add-message {
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add-field:hover, button.add-message:hover {
        border-color: var(--theme-highlight);
    }

    button.add-message {
        padding: 0.6em;
    }

    input, button {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input:focus {
        outline: 2px solid var(--theme-highlight);
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button.save {
        padding: 0.5em 1.2em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    .picker-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1.5rem;
        box-sizing: border-box;
    }

    .picker-panel {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border-radius: 12px;
        padding: 1.25rem;
        max-width: 32rem;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-sizing: border-box;
    }

    .picker-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
    }

    .picker-header h3 {
        margin: 0;
    }

    .picker-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
    }
</style>
