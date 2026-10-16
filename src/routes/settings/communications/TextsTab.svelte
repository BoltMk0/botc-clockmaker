<script lang="ts">
    import { TEXT_STYLES, type TextOption } from "$lib/common/message";
    import { onMount } from "svelte";

    let options: TextOption[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(options) !== savedSnapshot);

    onMount(() => {
        fetch('/api/textOptions').then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to fetch');
        }).then(data => {
            options = data;
            savedSnapshot = JSON.stringify(data);
        }).catch(() => {
            alert('Failed to fetch text options!');
        });
    });

    function save() {
        // A blank option would be an empty button in the grim.
        options = options.filter(o => o.text.trim());
        const snapshot = JSON.stringify(options);
        fetch('/api/textOptions', {
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
        const [option] = options.splice(index, 1);
        options.splice(index + by, 0, option);
    }
</script>

<div class="center-content main">
<div class="panel">
<div class="panel-header">
    <h2>Texts</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">The text the grim's communications builder offers, in this order, in all games. A Header is shown large, as a title; Text is shown smaller.</p>

<div class="option-list">
    {#each options as option, i}
        <div class="option-row">
            <select bind:value={option.style} aria-label="Style">
                {#each TEXT_STYLES as style}
                    <option value={style}>{style}</option>
                {/each}
            </select>
            <textarea class="option-text" class:dumbledore-font={option.style === 'Header'} class:header={option.style === 'Header'} rows="1" bind:value={option.text} placeholder="Text"></textarea>
            <button title="Move up" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
            <button title="Move down" aria-label="Move down" disabled={i === options.length - 1} onclick={() => move(i, 1)}>↓</button>
            <button title="Delete" aria-label="Delete" onclick={() => options.splice(i, 1)}>✕</button>
        </div>
    {:else}
        <div class="empty">No text options yet.</div>
    {/each}
    <button class="add-option" onclick={() => options.push({ text: '', style: 'Text' })}>+ Add text</button>
</div>
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

    .option-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .empty {
        opacity: 0.6;
        font-style: italic;
        padding: 0.5rem 0;
    }

    .option-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .option-text {
        flex: 1;
        min-width: 0;
        resize: vertical;
        field-sizing: content;
        font-size: 1rem;
    }

    .option-text.header {
        font-size: 1.5rem;
    }

    button.add-option {
        padding: 0.6em;
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add-option:hover {
        border-color: var(--theme-highlight);
    }

    select, textarea, button {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    select:focus, textarea:focus {
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
</style>
