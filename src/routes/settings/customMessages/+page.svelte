<script lang="ts">
    import type { CustomMessage } from "$lib/common/customMessage";
    import type { Character } from "$lib/resources/common/gameData";
    import { onMount } from "svelte";

    let messages: CustomMessage[] = $state([]);
    let characters: Character[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(messages) !== savedSnapshot);

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
</script>

<div class="center-content main">
<div class="panel">
<div class="panel-header">
    <h2>Grim messages</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Messages listed in the grim's communications menu, in all games.</p>
<div class="table-container">
<table>
    <tbody>
        <tr>
            <th>Title</th>
            <th>Token after title</th>
            <th>Subtitle (optional)</th>
            <th>Token after subtitle</th>
            <th></th>
        </tr>
        {#each messages as message, i}
            <tr>
                <td><input bind:value={message.title} type="text" placeholder="Title"/></td>
                <td>
                    <select bind:value={message.characterId}>
                        <option value={undefined}>None</option>
                        {#each characters as character (character.id)}
                            <option value={character.id}>{character.name}</option>
                        {/each}
                    </select>
                </td>
                <td><input bind:value={message.subtitle} type="text" placeholder="Subtitle"/></td>
                <td>
                    <select bind:value={message.subtitleCharacterId}>
                        <option value={undefined}>None</option>
                        {#each characters as character (character.id)}
                            <option value={character.id}>{character.name}</option>
                        {/each}
                    </select>
                </td>
                <td><button onclick={() => messages.splice(i, 1)}>Delete</button></td>
            </tr>
        {/each}
        <tr>
            <td colspan="5">
                <div style="display: flex;">
                <button style="flex: 1;" class="add" onclick={() => messages.push({ title: '', subtitle: '' })}>Add Message</button>
                </div>
            </td>
        </tr>
    </tbody>
</table>
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

    .table-container {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
        overflow-x: auto;
    }

    table {
        width: 100%;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border-collapse: collapse;
    }

    th {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        padding: 0.4em 0.6em;
    }

    td {
        padding: 0.3em 0.5em;
        border-top: 1px solid var(--theme-bg-tertiary);
    }

    tr:nth-child(even) td {
        background-color: var(--theme-bg-secondary);
    }

    input, button, select {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input:focus, select:focus {
        outline: 2px solid var(--theme-highlight);
    }

    input[type="checkbox"] {
        accent-color: var(--theme-highlight);
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button.add {
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add:hover {
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
