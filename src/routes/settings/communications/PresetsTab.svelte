<script lang="ts">
    import type { MessagePreset, TextOption } from "$lib/common/message";
    import type { Character } from "$lib/resources/common/gameData";
    import MessagePresetList, { sectionsByCategory } from "$lib/components/MessagePresetList.svelte";
    import { onMount } from "svelte";

    let presets: MessagePreset[] = $state([]);
    let textOptions: TextOption[] = $state([]);
    let characters: Character[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(presets) !== savedSnapshot);

    const charactersById = $derived(Object.fromEntries(characters.map(c => [c.id, c])));
    const sections = $derived(sectionsByCategory(characters));

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
</script>

<div class="center-content main">
<div class="panel">
<div class="panel-header">
    <h2>Presets</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Messages listed in the Preset tab of the grim's communications, in this order, in all games, to show in one tap. Each is built like a custom message.</p>

<MessagePresetList bind:presets bind:textOptions {sections} characters={charactersById} newPreset={() => ({ name: '', elements: [] })} />
</div>
</div>

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

    button {
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
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
</style>
