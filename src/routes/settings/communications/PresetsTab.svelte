<script lang="ts">
    import type { MessagePreset, TextOption } from "$lib/common/message";
    import { ALL_CHARACTER_CATEGORIES, type Character, type CharacterCategory } from "$lib/resources/common/gameData";
    import { characterImageUrl } from "$lib/resources/common/characterImages";
    import MessageBuilder, { type CharacterSection, type MessageBuilderView } from "$lib/components/MessageBuilder.svelte";
    import MessageText from "$lib/components/MessageText.svelte";
    import { onMount } from "svelte";

    let presets: MessagePreset[] = $state([]);
    let textOptions: TextOption[] = $state([]);
    let characters: Character[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(presets) !== savedSnapshot);

    const charactersById = $derived(Object.fromEntries(characters.map(c => [c.id, c])));

    const CATEGORY_TITLES: Record<CharacterCategory, string> = {
        townsfolk: 'Townsfolk',
        outsider: 'Outsiders',
        minion: 'Minions',
        demon: 'Demons',
        traveler: 'Travellers',
        loric: 'Loric',
        fabled: 'Fabled',
    };

    // With no script here, the builder's character picker offers every character, by category.
    const sections = $derived<CharacterSection[]>(ALL_CHARACTER_CATEGORIES
        .map(category => ({ key: category, title: CATEGORY_TITLES[category], characters: characters.filter(c => c.category === category) }))
        .filter(section => section.characters.length > 0));

    onMount(() => {
        fetch('/api/characters').then(r => r.json()).then((data: Character[]) => {
            characters = data.sort((a, b) => a.name.localeCompare(b.name));
        }).catch(() => {
            alert('Failed to fetch characters!');
        });

        fetch('/api/textOptions').then(r => r.json()).then((data: TextOption[]) => {
            textOptions = data;
        }).catch(() => {
            alert('Failed to fetch text options!');
        });

        fetch('/api/messagePresets').then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to fetch');
        }).then(data => {
            presets = data;
            savedSnapshot = JSON.stringify(data);
        }).catch(() => {
            alert('Failed to fetch message presets!');
        });
    });

    function save() {
        const snapshot = JSON.stringify(presets);
        fetch('/api/messagePresets', {
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

    function move(index: number, by: number) {
        const [preset] = presets.splice(index, 1);
        presets.splice(index + by, 0, preset);
    }

    // The preset open in the builder, and which of the builder's screens is showing.
    let editing = $state<number | null>(null);
    let builderView = $state<MessageBuilderView>('builder');
    let builder = $state<MessageBuilder>();

    function edit(index: number) {
        builderView = 'builder';
        editing = index;
    }

    function addPreset() {
        presets.push({ name: '', elements: [] });
        edit(presets.length - 1);
    }

    function back() {
        if (!builder?.back()) editing = null;
    }
</script>

<div class="center-content main">
<div class="panel">
<div class="panel-header">
    <h2>Presets</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Messages listed in the Preset tab of the grim's communications, in this order, in all games, to show in one tap. Each is built like a custom message.</p>

<div class="preset-list">
    {#each presets as preset, i}
        <div class="preset-card">
            <div class="preset-header">
                <input class="preset-name" type="text" bind:value={preset.name} placeholder="Name" aria-label="Name" />
                <button onclick={() => edit(i)}>Edit</button>
                <button title="Move up" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
                <button title="Move down" aria-label="Move down" disabled={i === presets.length - 1} onclick={() => move(i, 1)}>↓</button>
                <button title="Delete" aria-label="Delete" onclick={() => presets.splice(i, 1)}>✕</button>
            </div>
            <div class="preset-preview">
                {#each preset.elements as element}
                    {#if element.type === 'text'}
                        <div class="preview-text" class:dumbledore-font={element.style === 'Header'} class:header={element.style === 'Header'}><MessageText text={element.value}/></div>
                    {:else if element.type === 'character'}
                        <div class="preview-tokens">
                            {#each element.value as characterId}
                                <img src={characterImageUrl(characterId, 128)} alt={charactersById[characterId]?.name ?? ''} title={charactersById[characterId]?.name ?? ''} />
                            {/each}
                        </div>
                    {:else}
                        <div class="preview-alignment dumbledore-font {element.value}">{element.value === 'good' ? 'GOOD' : 'EVIL'}</div>
                    {/if}
                {:else}
                    <div class="empty">Empty - press Edit to build it.</div>
                {/each}
            </div>
        </div>
    {:else}
        <div class="empty">No presets yet.</div>
    {/each}
    <button class="add-preset" onclick={addPreset}>+ Add preset</button>
</div>
</div>
</div>

{#if editing !== null && presets[editing]}
    {@const preset = presets[editing]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="builder-overlay" role="dialog" tabindex="-1" onclick={() => editing = null}>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="builder-frame" onclick={(e) => e.stopPropagation()}>
            <!-- Outside the panel, so it stays put while the panel scrolls -->
            <button class="builder-back" onclick={back}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>
                Back
            </button>
            <div class="builder-panel">
                {#if builderView === 'builder'}
                    <input class="builder-name" type="text" bind:value={preset.name} placeholder="Name" aria-label="Name" />
                {/if}
                <MessageBuilder
                    bind:this={builder}
                    bind:elements={preset.elements}
                    bind:view={builderView}
                    bind:textOptions
                    {sections}
                    characters={charactersById}
                    tokenSize={56}
                    imageSize={128}
                />
                {#if builderView === 'builder'}
                    <button class="done" onclick={() => editing = null}>Done</button>
                {/if}
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

    .preset-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .empty {
        opacity: 0.6;
        font-style: italic;
        padding: 0.5rem 0;
    }

    .preset-card {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .preset-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .preset-name {
        flex: 1;
        min-width: 0;
        font-weight: 600;
    }

    .preset-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        text-align: center;
    }

    .preview-text {
        white-space: pre-line;
    }

    .preview-text.header {
        font-size: 1.4rem;
    }

    .preview-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4rem;
    }

    .preview-tokens img {
        width: 3em;
        height: 3em;
        border-radius: 50%;
        object-fit: cover;
    }

    .preview-alignment {
        font-size: 1.4rem;
        font-weight: bold;
        letter-spacing: 0.08em;
    }

    .preview-alignment.good {
        color: #558bdf;
    }

    .preview-alignment.evil {
        color: #ca4444;
    }

    button.add-preset {
        padding: 0.6em;
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add-preset:hover {
        border-color: var(--theme-highlight);
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

    button.save, button.done {
        padding: 0.5em 1.2em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    .builder-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .builder-frame {
        position: relative;
        width: min(100%, 36rem);
        height: min(100%, 92vh);
    }

    .builder-back {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.1em;
        padding: 0.45em 0.9em 0.45em 0.5em;
        border: none;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        font-size: 1em;
    }

    .builder-back svg {
        width: 1.3em;
        height: 1.3em;
        fill: currentColor;
    }

    .builder-panel {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        /* The builder's sticky picker button covers the 1.2em at the bottom. */
        padding: 3.5em 1.2em 1.2em;
        border-radius: 12px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.7em;
    }

    .builder-name {
        width: 100%;
        box-sizing: border-box;
        padding: 0.6em;
        font-size: 1.1em;
        text-align: center;
    }

    button.done {
        width: 100%;
        flex-shrink: 0;
        margin-top: 1.2em;
        padding: 16px;
    }

    /* Full screen on a phone, like the grim's communications */
    @media (max-width: 768px) {
        .builder-frame {
            width: 100%;
            height: 100%;
        }

        .builder-panel {
            border-radius: 0;
        }
    }
</style>
