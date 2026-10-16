<script lang="ts" module>
    export type MessageBuilderView = 'builder' | 'text' | 'customText' | 'character';
    export type CharacterSection = { key: string; title: string; characters: Character[] };
</script>

<script lang="ts">
    import { TEXT_STYLES, type MessageElement, type TextOption } from "$lib/common/message";
    import type { Character } from "$lib/resources/common/gameData";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import MessageText from "$lib/components/MessageText.svelte";

    // Builds a message to show a player from text, character and alignment elements - in the grim's communications,
    // and for the message presets in settings. The host shows what goes round it (a title, the Show or Save button,
    // and a Back button that calls back()) while the view is 'builder'; the other views add or change an element.
    let {
        elements = $bindable(),
        view = $bindable('builder'),
        textOptions = $bindable(),
        sections,
        characters,
        faded = () => false,
        tokenSize,
        imageSize = 256,
    }: {
        elements: MessageElement[];
        view?: MessageBuilderView;
        textOptions: TextOption[];
        // The characters to pick from, section by section.
        sections: CharacterSection[];
        // Every character an element might show, by id.
        characters: Record<string, Character>;
        // Characters shown faded in the picker (in the grim, those on the board).
        faded?: (characterId: string) => boolean;
        tokenSize: number;
        imageSize?: number;
    } = $props();

    // What the "Add element" box shows: itself, the element types, or the two alignments.
    let addElementStep = $state<'closed' | 'type' | 'alignment'>('closed');

    /** Goes back a step: true if it did, false if already at the builder (for the host to close it). */
    export function back(): boolean {
        if (view === 'builder') return false;
        if (view === 'customText') {
            view = 'text';
        } else {
            addElementStep = 'closed';
            view = 'builder';
        }
        return true;
    }

    function addElement(element: MessageElement) {
        elements.push(element);
        addElementStep = 'closed';
        view = 'builder';
    }

    function toggleAlignment(elementIndex: number) {
        const element = elements[elementIndex];
        if (element.type === 'alignment') element.value = element.value === 'good' ? 'evil' : 'good';
    }

    // The custom text being written, and whether to keep it as a text option for next time.
    let customText = $state<TextOption>({ text: '', style: 'Header' });
    let saveCustomText = $state(false);

    function openCustomText() {
        customText = { text: '', style: 'Header' };
        saveCustomText = false;
        view = 'customText';
    }

    async function addCustomText() {
        const option: TextOption = { text: customText.text.trim(), style: customText.style };
        if (!option.text) return;
        addElement({ type: 'text', value: option.text, style: option.style });
        if (saveCustomText) await saveTextOption(option);
    }

    // Adds to the saved text options as they are now, so as not to undo changes made elsewhere since they were loaded.
    async function saveTextOption(option: TextOption) {
        try {
            const current = await fetch('/api/textOptions').then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json() as Promise<TextOption[]>;
            });
            if (current.some(o => o.text === option.text && o.style === option.style)) {
                textOptions = current;
                return;
            }
            const updated = [...current, option];
            const res = await fetch('/api/textOptions', {
                method: 'POST',
                body: JSON.stringify(updated),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error(`${res.status}`);
            textOptions = updated;
        } catch {
            alert('Failed to save the text option');
        }
    }

    // The characters picked so far for a character element, and the element they replace (null to add a new one).
    let pickedCharacterIds = $state<string[]>([]);
    let editingElementIndex = $state<number | null>(null);

    function openCharacterPicker(elementIndex: number | null) {
        const element = elementIndex === null ? null : elements[elementIndex];
        pickedCharacterIds = element?.type === 'character' ? [...element.value] : [];
        editingElementIndex = elementIndex;
        view = 'character';
    }

    function togglePickedCharacter(characterId: string) {
        if (pickedCharacterIds.includes(characterId)) pickedCharacterIds = pickedCharacterIds.filter(id => id !== characterId);
        else pickedCharacterIds = [...pickedCharacterIds, characterId];
    }

    function finishCharacterPicker() {
        const element: MessageElement = { type: 'character', value: pickedCharacterIds };
        if (editingElementIndex === null) {
            addElement(element);
        } else {
            elements[editingElementIndex] = element;
            view = 'builder';
        }
    }
</script>

<div class="message-builder">
    {#if view === 'builder'}
        <div class="message-elements">
            {#each elements as element, elementIndex}
                <div class="message-element">
                    {#if element.type === 'text'}
                        <div class="element-body text-preview" class:dumbledore-font={element.style === 'Header'} class:header={element.style === 'Header'}><MessageText text={element.value}/></div>
                    {:else if element.type === 'character'}
                        <button class="no-button-style element-body element-tokens" title="Change characters" onclick={() => openCharacterPicker(elementIndex)}>
                            {#each element.value as characterId (characterId)}
                                {@const character = characters[characterId]}
                                {#if character}
                                    <div style="position: relative; width: {tokenSize}px; height: {tokenSize}px;">
                                        <CharacterToken {character} style="position: relative;" size="{tokenSize}px" {imageSize} norules/>
                                    </div>
                                {/if}
                            {/each}
                        </button>
                    {:else}
                        <button class="no-button-style element-body alignment-preview dumbledore-font {element.value}" title="Switch alignment" onclick={() => toggleAlignment(elementIndex)}>
                            {element.value === 'good' ? 'GOOD' : 'EVIL'}
                        </button>
                    {/if}
                    <button class="no-button-style remove-element" title="Remove" aria-label="Remove" onclick={() => elements.splice(elementIndex, 1)}>✕</button>
                </div>
            {/each}

            {#if addElementStep === 'type'}
                <div class="add-element choices">
                    <button class="no-button-style element-type" onclick={() => view = 'text'}>Text</button>
                    <button class="no-button-style element-type" disabled={sections.length === 0} onclick={() => openCharacterPicker(null)}>Character</button>
                    <button class="no-button-style element-type" onclick={() => addElementStep = 'alignment'}>Alignment</button>
                    <button class="no-button-style remove-element" title="Cancel" aria-label="Cancel" onclick={() => addElementStep = 'closed'}>✕</button>
                </div>
            {:else if addElementStep === 'alignment'}
                <div class="add-element choices">
                    <button class="button-style alignment-choice good dumbledore-font" onclick={() => addElement({ type: 'alignment', value: 'good' })}>GOOD</button>
                    <button class="button-style alignment-choice evil dumbledore-font" onclick={() => addElement({ type: 'alignment', value: 'evil' })}>EVIL</button>
                    <button class="no-button-style remove-element" title="Back" aria-label="Back" onclick={() => addElementStep = 'type'}>✕</button>
                </div>
            {:else}
                <button class="no-button-style add-element" onclick={() => addElementStep = 'type'}>Add element</button>
            {/if}
        </div>
    {:else if view === 'text'}
        <div class="builder-title dumbledore-font">Add text</div>
        <div class="text-options">
            {#each textOptions as option}
                <button class="button-style text-option" class:dumbledore-font={option.style === 'Header'} class:header={option.style === 'Header'} onclick={() => addElement({ type: 'text', value: option.text, style: option.style })}><MessageText text={option.text}/></button>
            {/each}
        </div>
        <button class="no-button-style add-element" onclick={openCustomText}>Custom...</button>
    {:else if view === 'customText'}
        <div class="builder-title dumbledore-font">Custom text</div>
        <select class="builder-input" bind:value={customText.style} aria-label="Style">
            {#each TEXT_STYLES as style}
                <option value={style}>{style}</option>
            {/each}
        </select>
        <!-- svelte-ignore a11y_autofocus -->
        <textarea class="builder-input" rows="3" placeholder="Text" bind:value={customText.text} autofocus></textarea>
        <div class="custom-text-submit">
            <label><input type="checkbox" bind:checked={saveCustomText} /> Save as a text option</label>
            <button class="button-style highlight" disabled={!customText.text.trim()} onclick={addCustomText}>Add</button>
        </div>
    {:else}
        <div class="builder-title dumbledore-font">Choose characters</div>
        {#each sections as section (section.key)}
            <div class="picker-section">
                <div>{section.title}</div>
                <div class="picker-grid">
                    {#each section.characters as character (character.id)}
                        <button class="no-button-style picker-token" class:picked={pickedCharacterIds.includes(character.id)} class:faded={faded(character.id)} aria-label={character.name} title={character.name} onclick={() => togglePickedCharacter(character.id)}>
                            <CharacterToken {character} style="position: relative;" size="{tokenSize}px" {imageSize} norules/>
                        </button>
                    {/each}
                </div>
            </div>
        {/each}
        <div class="picker-actions">
            <button class="button-style highlight wide" disabled={pickedCharacterIds.length === 0} onclick={finishCharacterPicker}>
                {editingElementIndex === null ? 'Add' : 'Done'} ({pickedCharacterIds.length} chosen)
            </button>
        </div>
    {/if}
</div>

<style>
    .message-builder {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.7em;
        text-align: center;
    }

    .builder-title {
        font-size: 1.6em;
    }

    .button-style {
        padding: 16px 36px;
    }

    .button-style.wide {
        width: 100%;
        flex-shrink: 0;
    }

    .builder-input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.7em;
        font-size: 1.1em;
        font-family: inherit;
        flex-shrink: 0;
    }

    .message-elements,
    .text-options {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.6em;
    }

    .message-element {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.6em;
        border-radius: 0.6em;
        background: var(--theme-bg);
    }

    .element-body {
        flex: 1;
        min-width: 0;
        text-align: center;
    }

    /* Text in its style, as on the message page but smaller */
    .text-preview, .text-option {
        font-size: 1em;
        white-space: pre-line;
        overflow-wrap: anywhere;
    }

    .text-preview.header, .text-option.header {
        font-size: 1.6em;
    }

    .element-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4em;
        cursor: pointer;
    }

    .alignment-preview {
        font-size: 1.8em;
        font-weight: bold;
        letter-spacing: 0.08em;
        cursor: pointer;
    }

    .alignment-preview.good {
        color: #558bdf;
    }

    .alignment-preview.evil {
        color: #ca4444;
    }

    .remove-element {
        flex-shrink: 0;
        width: 1.8em;
        height: 1.8em;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.35);
        color: inherit;
    }

    /* The dashed "Add element" box, and the element types shown in its place */
    button.add-element, button.element-type {
        box-sizing: border-box;
        padding: 2em 1em;
        text-align: center;
        border: 2px dashed currentColor;
        border-radius: 0.6em;
        opacity: 0.7;
    }

    button.add-element {
        width: 100%;
    }

    button.add-element:hover, button.element-type:hover {
        opacity: 1;
    }

    button.element-type:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .add-element.choices {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    .add-element.choices > button.element-type {
        flex: 1;
    }

    /* GOOD and EVIL, as tall as the element types they replace (their font is 1.3x) */
    .add-element.choices > .alignment-choice {
        flex: 1;
        padding: calc(2em / 1.3) 12px;
        border: 2px solid transparent;
        font-size: 1.3em;
        font-weight: bold;
        color: #fff;
    }

    .alignment-choice.good {
        background-color: #2563eb;
    }

    .alignment-choice.evil {
        background-color: #b63737;
    }

    .custom-text-submit {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1em;
    }

    .custom-text-submit label {
        display: flex;
        align-items: center;
        gap: 0.4em;
    }

    .picker-section {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
    }

    .picker-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4em;
    }

    .picker-token {
        position: relative;
        border-radius: 50%;
    }

    .picker-token.faded {
        opacity: 0.4;
    }

    .picker-token.picked {
        outline: 3px solid gold;
        outline-offset: 2px;
    }

    /* Keeps the picker's button in reach below a long list of characters. The host's scrolling panel has 1.2em of
       padding at the bottom, which this covers so nothing scrolls by beneath it. */
    .picker-actions {
        position: sticky;
        bottom: -1.2em;
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.7em;
        padding: 0.7em 0 1.2em;
        background: var(--theme-bg-secondary);
    }
</style>
