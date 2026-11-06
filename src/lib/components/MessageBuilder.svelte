<script lang="ts" module>
    export type MessageBuilderView = 'builder' | 'text' | 'customText' | 'characterRules' | 'character';
    export type CharacterSection = { key: string; title: string; characters: Character[] };
</script>

<script lang="ts">
    import { TEXT_STYLES, type MessageElement, type PresetElement, type TextOption } from "$lib/common/message";
    import { rulesWithSetup, type Character, type ReminderToken } from "$lib/resources/common/gameData";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import MessageText from "$lib/components/MessageText.svelte";
    import TrashIcon from "$lib/components/TrashIcon.svelte";

    // Builds a message to show a player from text, character and alignment elements - in the grim's communications,
    // and for the message presets in settings. The host shows what goes round it (a title, the Show or Save button,
    // and a Back button that calls back()) while the view is 'builder'; the other views add or change an element.
    // A preset can have blanks: with `blanks` 'add', Blank is a fourth element type, and with 'fill' each blank offers
    // the other three types in its place, to fill it in before the message is shown.
    let {
        elements = $bindable(),
        view = $bindable('builder'),
        textOptions = $bindable(),
        sections,
        characters,
        faded = () => false,
        reminders = () => [],
        openSections = [],
        reminderTokens = [],
        playerAlignment = false,
        tokenSize,
        imageSize = 256,
        blanks = 'none',
    }: {
        elements: PresetElement[];
        view?: MessageBuilderView;
        textOptions: TextOption[];
        // The characters to pick from, section by section.
        sections: CharacterSection[];
        // Every character an element might show, by id.
        characters: Record<string, Character>;
        // Characters shown faded in the picker (in the grim, those not on the board, so the ones in play stand out).
        faded?: (characterId: string) => boolean;
        // Reminder tokens shown over the top-left of a character in the picker (in the grim, those beside them).
        reminders?: (characterId: string) => (ReminderToken & { characterId: string })[];
        // Folding sections (by key) to open each time a character picker opens (in the grim, the travellers while
        // any are in play).
        openSections?: string[];
        // With blanks 'add', the reminder tokens a Reminder element can find the character by (a character's own),
        // offered at the top of the character picker.
        reminderTokens?: (ReminderToken & { characterId: string })[];
        // With blanks 'add', whether Alignment also offers the alignment of the character's player, from their token
        // on the grim (in the character editor).
        playerAlignment?: boolean;
        tokenSize: number;
        imageSize?: number;
        blanks?: 'none' | 'add' | 'fill';
    } = $props();

    // What the "Add element" box shows: itself, the element types, or the two alignments.
    let addElementStep = $state<'closed' | 'type' | 'alignment'>('closed');
    const reminderTokenById = (id: string) => reminderTokens.find(t => t.id === id);
    // The blank being filled in (null when adding a new element), and the blank showing the two alignments, if any.
    let fillingIndex = $state<number | null>(null);
    let alignmentBlankIndex = $state<number | null>(null);

    /** Goes back a step: true if it did, false if already at the builder (for the host to close it). */
    export function back(): boolean {
        if (view === 'builder') return false;
        if (view === 'customText' || view === 'characterRules') {
            view = 'text';
        } else {
            addElementStep = 'closed';
            fillingIndex = null;
            view = 'builder';
        }
        return true;
    }

    // Adds the element, or puts it in place of the blank being filled in.
    function addElement(element: PresetElement) {
        if (fillingIndex !== null) elements[fillingIndex] = element;
        else elements.push(element);
        fillingIndex = null;
        alignmentBlankIndex = null;
        addElementStep = 'closed';
        view = 'builder';
    }

    function openAddElement() {
        fillingIndex = null;
        alignmentBlankIndex = null;
        addElementStep = 'type';
    }

    function fillBlank(elementIndex: number, type: 'text' | 'character' | 'alignment') {
        fillingIndex = elementIndex;
        addElementStep = 'closed';
        alignmentBlankIndex = type === 'alignment' ? elementIndex : null;
        if (type === 'text') view = 'text';
        else if (type === 'character') openCharacterPicker(null);
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

    // Removes the text option from the saved ones as they are now, as saveTextOption adds to them.
    async function deleteTextOption(option: TextOption) {
        const label = option.text.replaceAll('*', '').trim();
        if (!confirm(`Delete the text "${label}"? This can't be undone.`)) return;
        try {
            const current = await fetch('/api/textOptions').then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json() as Promise<TextOption[]>;
            });
            const updated = current.filter(o => !(o.text === option.text && o.style === option.style));
            const res = await fetch('/api/textOptions', {
                method: 'POST',
                body: JSON.stringify(updated),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) throw new Error(`${res.status}`);
            textOptions = updated;
        } catch {
            alert('Failed to delete the text option');
        }
    }

    // Adds a character's ability, as scripts print it, as a line of Text.
    function addCharacterRules(character: Character) {
        addElement({ type: 'text', value: rulesWithSetup(character), style: 'Text' });
    }

    // A reminder shown over a character in the picker, as a fraction of the token's size.
    const REMINDER_SCALE = 0.42;

    // Travellers, loric and fabled are folded away in the character pickers until their header is tapped.
    const FOLDED_SECTION_KEYS = ['traveler', 'loric', 'fabled'];
    let unfolded = $state(new Set<string>());
    const isFoldable = (section: CharacterSection) => FOLDED_SECTION_KEYS.includes(section.key);

    function toggleSection(key: string) {
        const next = new Set(unfolded);
        next.has(key) ? next.delete(key) : next.add(key);
        unfolded = next;
    }

    // Opens a character picker, with the sections the host wants open unfolded.
    function showPicker(pickerView: 'character' | 'characterRules') {
        if (openSections.some(key => !unfolded.has(key))) unfolded = new Set([...unfolded, ...openSections]);
        view = pickerView;
    }

    // The characters picked so far for a character element, and the element they replace (null to add a new one).
    let pickedCharacterIds = $state<string[]>([]);
    let editingElementIndex = $state<number | null>(null);

    function openCharacterPicker(elementIndex: number | null) {
        const element = elementIndex === null ? null : elements[elementIndex];
        pickedCharacterIds = element?.type === 'character' ? [...element.value] : [];
        editingElementIndex = elementIndex;
        showPicker('character');
    }

    function togglePickedCharacter(characterId: string) {
        if (pickedCharacterIds.includes(characterId)) pickedCharacterIds = pickedCharacterIds.filter(id => id !== characterId);
        else pickedCharacterIds = [...pickedCharacterIds, characterId];
    }

    // A Reminder element, from the top of the character picker: in place of the element being changed, or added.
    function pickReminder(reminderTokenId: string) {
        const element: PresetElement = { type: 'reminderCharacter', reminderTokenId };
        if (editingElementIndex === null) {
            addElement(element);
        } else {
            elements[editingElementIndex] = element;
            fillingIndex = null;
            view = 'builder';
        }
    }

    function finishCharacterPicker() {
        const element: MessageElement = { type: 'character', value: pickedCharacterIds };
        if (editingElementIndex === null) {
            addElement(element);
        } else {
            elements[editingElementIndex] = element;
            fillingIndex = null;
            view = 'builder';
        }
    }
</script>

<!-- A character's reminders, overlapping in a row from the top-left corner of their token -->
{#snippet reminderBadges(characterId: string)}
    {@const shown = reminders(characterId)}
    {#if shown.length > 0}
        <div class="picker-reminders" style="--reminder-size: {Math.round(tokenSize * REMINDER_SCALE)}px;">
            {#each shown as reminder, i (i)}
                <ReminderTokenView data={reminder} characterId={reminder.characterId} size="{Math.round(tokenSize * REMINDER_SCALE)}px"/>
            {/each}
        </div>
    {/if}
{/snippet}

{#snippet sectionHeader(section: CharacterSection)}
    {#if isFoldable(section)}
        {@const open = unfolded.has(section.key)}
        {@const picked = view === 'character' ? section.characters.filter(c => pickedCharacterIds.includes(c.id)).length : 0}
        <button type="button" class="no-button-style section-toggle" aria-expanded={open} onclick={() => toggleSection(section.key)}>
            <svg viewBox="0 0 24 24" class:collapsed={!open} aria-hidden="true"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            {section.title}
            {#if picked > 0}<span class="section-count">{picked} chosen</span>{/if}
        </button>
    {:else}
        <div>{section.title}</div>
    {/if}
{/snippet}

<div class="message-builder">
    {#if view === 'builder'}
        <div class="message-elements">
            {#each elements as element, elementIndex}
                <div class="message-element">
                    {#if element.type === 'text'}
                        <div class="element-body text-preview" class:dumbledore-font={element.style === 'Header'} class:header={element.style === 'Header'}><MessageText text={element.value}/></div>
                    {:else if element.type === 'character'}
                        <button type="button" class="no-button-style element-body element-tokens" title="Change characters" onclick={() => openCharacterPicker(elementIndex)}>
                            {#each element.value as characterId (characterId)}
                                {@const character = characters[characterId]}
                                {#if character}
                                    <div style="position: relative; width: {tokenSize}px; height: {tokenSize}px;">
                                        <CharacterToken {character} style="position: relative;" size="{tokenSize}px" {imageSize} norules/>
                                    </div>
                                {/if}
                            {/each}
                        </button>
                    {:else if element.type === 'alignment'}
                        <button type="button" class="no-button-style element-body alignment-preview dumbledore-font {element.value}" title="Switch alignment" onclick={() => toggleAlignment(elementIndex)}>
                            {element.value === 'good' ? 'GOOD' : 'EVIL'}
                        </button>
                    {:else if element.type === 'reminderCharacter'}
                        {@const reminder = reminderTokenById(element.reminderTokenId)}
                        <button type="button" class="no-button-style element-body blank-preview reminder-preview" title="Change" onclick={() => openCharacterPicker(elementIndex)}>
                            {#if reminder}
                                <div class="reminder-preview-token" style="width: {Math.round(tokenSize * 0.8)}px; height: {Math.round(tokenSize * 0.8)}px;">
                                    <ReminderTokenView data={reminder} characterId={reminder.characterId} size="{Math.round(tokenSize * 0.8)}px"/>
                                </div>
                            {/if}
                            <span>The character by {reminder ? (reminder.text.trim() ? `the ${reminder.text.trim()} reminder` : 'the reminder') : 'a deleted reminder'}, or a blank</span>
                        </button>
                    {:else if element.type === 'playerAlignment'}
                        <div class="element-body blank-preview">Their alignment, from their token</div>
                    {:else if blanks === 'fill' && alignmentBlankIndex === elementIndex}
                        <div class="element-body add-element choices">
                            <button type="button" class="button-style alignment-choice good dumbledore-font" onclick={() => addElement({ type: 'alignment', value: 'good' })}>GOOD</button>
                            <button type="button" class="button-style alignment-choice evil dumbledore-font" onclick={() => addElement({ type: 'alignment', value: 'evil' })}>EVIL</button>
                            <button type="button" class="no-button-style remove-element" title="Back" aria-label="Back" onclick={() => alignmentBlankIndex = null}>✕</button>
                        </div>
                    {:else if blanks === 'fill'}
                        <!-- To be filled in before the message is shown -->
                        <div class="element-body add-element choices">
                            <button type="button" class="no-button-style element-type" onclick={() => fillBlank(elementIndex, 'text')}>Text</button>
                            <button type="button" class="no-button-style element-type" disabled={sections.length === 0} onclick={() => fillBlank(elementIndex, 'character')}>Character</button>
                            <button type="button" class="no-button-style element-type" onclick={() => fillBlank(elementIndex, 'alignment')}>Alignment</button>
                        </div>
                    {:else}
                        <div class="element-body blank-preview">Blank</div>
                    {/if}
                    <!-- A blank being filled in has to be filled, so it can't be taken out -->
                    {#if !(blanks === 'fill' && element.type === 'blank')}
                        <button type="button" class="no-button-style remove-element" title="Remove" aria-label="Remove" onclick={() => elements.splice(elementIndex, 1)}>✕</button>
                    {/if}
                </div>
            {/each}

            {#if addElementStep === 'type'}
                <div class="add-element choices">
                    <button type="button" class="no-button-style element-type" onclick={() => view = 'text'}>Text</button>
                    <button type="button" class="no-button-style element-type" disabled={sections.length === 0} onclick={() => openCharacterPicker(null)}>Character</button>
                    <button type="button" class="no-button-style element-type" onclick={() => addElementStep = 'alignment'}>Alignment</button>
                    {#if blanks === 'add'}
                        <button type="button" class="no-button-style element-type" onclick={() => addElement({ type: 'blank' })}>Blank</button>
                    {/if}
                    <button type="button" class="no-button-style remove-element" title="Cancel" aria-label="Cancel" onclick={() => addElementStep = 'closed'}>✕</button>
                </div>
            {:else if addElementStep === 'alignment'}
                <div class="add-element choices">
                    <button type="button" class="button-style alignment-choice good dumbledore-font" onclick={() => addElement({ type: 'alignment', value: 'good' })}>GOOD</button>
                    <button type="button" class="button-style alignment-choice evil dumbledore-font" onclick={() => addElement({ type: 'alignment', value: 'evil' })}>EVIL</button>
                    <button type="button" class="no-button-style remove-element" title="Back" aria-label="Back" onclick={() => addElementStep = 'type'}>✕</button>
                </div>
                {#if blanks === 'add' && playerAlignment}
                    <!-- Good or evil as the character's player's token is, each time it's shown -->
                    <button type="button" class="no-button-style add-element auto-alignment" onclick={() => addElement({ type: 'playerAlignment' })}>
                        <span class="auto-alignment-title">Auto</span>
                        <span class="auto-alignment-description">Good or evil, as their player's token is on the grim (or a blank, if it can't tell which player)</span>
                    </button>
                {/if}
            {:else if blanks !== 'fill'}
                <!-- (Filling in a preset's blanks only fills them: nothing more can be added) -->
                <button type="button" class="no-button-style add-element" onclick={openAddElement}>Add element</button>
            {/if}
        </div>
    {:else if view === 'text'}
        <div class="builder-title dumbledore-font">Add text</div>
        <button type="button" class="no-button-style add-element" onclick={openCustomText}>Custom...</button>
        <div class="text-options">
            {#each textOptions as option}
                <div class="text-option-row">
                    <button type="button" class="button-style text-option" class:dumbledore-font={option.style === 'Header'} class:header={option.style === 'Header'} onclick={() => addElement({ type: 'text', value: option.text, style: option.style })}><MessageText text={option.text}/></button>
                    <button type="button" class="no-button-style text-option-delete" onclick={() => deleteTextOption(option)}
                        aria-label="Delete {option.text.replaceAll('*', '').trim()}" title="Delete text"><TrashIcon size={20}/></button>
                </div>
            {/each}
        </div>
        <button type="button" class="no-button-style add-element" disabled={sections.length === 0} onclick={() => showPicker('characterRules')}>Character's ability...</button>
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
            <button type="button" class="button-style highlight" disabled={!customText.text.trim()} onclick={addCustomText}>Add</button>
        </div>
    {:else if view === 'characterRules'}
        <div class="builder-title dumbledore-font">Choose a character</div>
        {#each sections as section (section.key)}
            <div class="picker-section">
                {@render sectionHeader(section)}
                {#if !isFoldable(section) || unfolded.has(section.key)}
                <div class="picker-grid">
                    {#each section.characters as character (character.id)}
                        <button type="button" class="no-button-style picker-token" class:faded={faded(character.id)} aria-label={character.name} title={character.name} onclick={() => addCharacterRules(character)}>
                            <CharacterToken {character} style="position: relative;" size="{tokenSize}px" {imageSize} norules/>
                            {@render reminderBadges(character.id)}
                        </button>
                    {/each}
                </div>
                {/if}
            </div>
        {/each}
    {:else}
        <div class="builder-title dumbledore-font">Choose characters</div>
        {#if blanks === 'add' && reminderTokens.length > 0}
            <!-- A Reminder element: the character of the player beside the reminder token on the grim (or a blank
                 if it's not on it, or on it more than once), picked on its own in place of characters -->
            {@const editing = editingElementIndex === null ? null : elements[editingElementIndex]}
            <div class="picker-section">
                <div>Autofill from reminder tokens</div>
                <div class="picker-grid">
                    {#each reminderTokens as reminder (reminder.id)}
                        <button type="button" class="no-button-style picker-token reminder-choice"
                            class:picked={editing?.type === 'reminderCharacter' && editing.reminderTokenId === reminder.id}
                            title="The character beside {reminder.text.trim() ? `the ${reminder.text.trim()} reminder` : 'the reminder'} on the grim, or a blank"
                            aria-label={reminder.text.trim() || 'Reminder'} onclick={() => pickReminder(reminder.id)}>
                            <ReminderTokenView data={reminder} characterId={reminder.characterId} size="{tokenSize}px"/>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
        {#each sections as section (section.key)}
            <div class="picker-section">
                {@render sectionHeader(section)}
                {#if !isFoldable(section) || unfolded.has(section.key)}
                <div class="picker-grid">
                    {#each section.characters as character (character.id)}
                        <button type="button" class="no-button-style picker-token" class:picked={pickedCharacterIds.includes(character.id)} class:faded={faded(character.id)} aria-label={character.name} title={character.name} onclick={() => togglePickedCharacter(character.id)}>
                            <CharacterToken {character} style="position: relative;" size="{tokenSize}px" {imageSize} norules/>
                            {@render reminderBadges(character.id)}
                        </button>
                    {/each}
                </div>
                {/if}
            </div>
        {/each}
        <div class="picker-actions">
            <button type="button" class="button-style cancel" onclick={() => back()}>Cancel</button>
            <button type="button" class="button-style highlight" disabled={pickedCharacterIds.length === 0} onclick={finishCharacterPicker}>
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
    /* A text option's button, with its delete button over its end (as the grim's presets) */
    .text-option-row {
        position: relative;
        width: 100%;
    }

    .text-option-row > .text-option {
        width: 100%;
        padding-inline: 2.8em;
    }

    .text-option-delete {
        position: absolute;
        right: 0.5em;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        padding: 0.35em;
        border-radius: 0.4em;
        opacity: 0.6;
        cursor: pointer;
        font-size: 1rem;
    }

    .text-option-delete:hover {
        opacity: 1;
        color: #e05a5a;
    }

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

    /* A blank in a preset being built: filled in each time the preset is shown */
    .blank-preview {
        padding: 1em;
        border: 2px dashed currentColor;
        border-radius: 0.6em;
        opacity: 0.6;
        font-style: italic;
    }

    .reminder-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6em;
    }

    .reminder-preview-token {
        position: relative;
        flex-shrink: 0;
        font-style: normal;
    }

    .reminder-choice {
        position: relative;
        border-radius: 50%;
        opacity: 0.85;
    }

    .reminder-choice:hover {
        opacity: 1;
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

    /* Their alignment: its title, with what it does beneath, smaller */
    button.auto-alignment {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3em;
        padding: 1em;
    }

    .auto-alignment-title {
        font-weight: 600;
    }

    .auto-alignment-description {
        font-size: 0.8em;
    }

    button.add-element:hover, button.element-type:hover {
        opacity: 1;
    }

    button.add-element:disabled, button.element-type:disabled {
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

    /* A folding section's header, as in the game setup's token picker */
    .section-toggle {
        display: flex;
        align-items: center;
        gap: 0.3em;
        width: 100%;
        box-sizing: border-box;
        padding: 0.4em 0.6em;
        border-radius: 0.6em;
        background: var(--theme-bg);
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        touch-action: manipulation;
    }

    .section-toggle svg {
        width: 1.3em;
        height: 1.3em;
        fill: currentColor;
        transition: transform 0.15s;
    }

    .section-toggle svg.collapsed {
        transform: rotate(-90deg);
    }

    .section-count {
        margin-left: auto;
        font-weight: normal;
        opacity: 0.7;
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
        opacity: 0.6;
    }

    .picker-reminders {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        pointer-events: none;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }

    /* Each reminder after the first overlaps the one before by half its width */
    .picker-reminders > :global(:not(:first-child)) {
        margin-left: calc(var(--reminder-size) * -0.5);
    }

    .picker-token.picked {
        outline: 3px solid gold;
        outline-offset: 2px;
    }

    /* Keeps the picker's buttons in reach below a long list of characters, the characters scrolling by behind them */
    .picker-actions {
        position: sticky;
        bottom: 0;
        width: 100%;
        display: flex;
        gap: 0.7em;
        padding-top: 0.7em;
    }

    .picker-actions > button {
        flex: 2;
        flex-shrink: 0;
        padding-inline: 12px;
    }

    .picker-actions > button.cancel {
        flex: 1;
    }
</style>
