<script lang="ts">
    import type { QrCode } from "$lib/resources/server/qrCodes";
    import { DEFAULT_QR_POSITION, QR_POSITIONS, QR_POSITION_LABELS } from "$lib/resources/common/qrCodes";
    import { onMount } from "svelte";

    let codes: QrCode[] = $state([]);

    onMount(() => {
        fetch('/api/qrCodes').then(r => {
            if (r.ok) return r.json();
            throw new Error('Failed to fetch');
        }).then(data => {
            codes = data;
        }).catch(() => {
            alert('Failed to fetch QR codes!');
        });
    });

    function save() {
        fetch('/api/qrCodes', {
            method: 'POST',
            body: JSON.stringify(codes),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => {
            if (res.ok) {
                alert('Saved!');
            } else {
                res.json().then(t => {
                    alert(`Failed to save (${res.status})\n${t.message}`);
                }).catch(() => alert('Failed to save'));
            }
        });
    }
</script>

<div class="center-content main">
    <div class="panel">
        <header>
            <h1>QR Codes</h1>
            <div class="actions">
                <button onclick={() => codes.push({ url: '', title: '', position: DEFAULT_QR_POSITION })}>+ Add</button>
                <button class="save" onclick={save}>Save</button>
            </div>
        </header>
        <p class="description">Sets the QR codes shown on the town square across all games.</p>

        <div class="list-container">
        {#if codes.length === 0}
            <p class="empty">No QR codes yet. Add one to show it on the town square.</p>
        {/if}

        <ul>
            {#each codes as code, i}
                <li>
                    <label class="field">
                        <span>Title</span>
                        <input bind:value={code.title} type="text" placeholder="Title" />
                    </label>
                    <label class="field grow">
                        <span>URL</span>
                        <input bind:value={code.url} type="text" placeholder="https://..." />
                    </label>
                    <label class="field">
                        <span>Position</span>
                        <select bind:value={code.position}>
                            {#each QR_POSITIONS as pos}
                                <option value={pos}>{QR_POSITION_LABELS[pos]}</option>
                            {/each}
                        </select>
                    </label>
                    <button class="delete" title="Delete" aria-label="Delete entry" onclick={() => codes.splice(i, 1)}>✕</button>
                </li>
            {/each}
        </ul>
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
        width: min(60rem, 100%);
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
    }

    h1 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .list-container {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    .actions {
        display: flex;
        gap: 0.5rem;
    }

    ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    li {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.75rem;
        padding: 0.75rem;
        background-color: var(--theme-bg-secondary);
        border-radius: 8px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 10rem;
    }

    .field.grow {
        flex: 1;
        min-width: 14rem;
    }

    .field span {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--theme-on-bg-secondary);
    }

    input, select {
        padding: 0.5rem 0.6rem;
        border: 1px solid transparent;
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    input:focus, select:focus {
        outline: none;
        border-color: var(--theme-highlight);
    }

    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font: inherit;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    button:hover {
        filter: brightness(1.15);
    }

    .save {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .delete:hover {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    .empty {
        text-align: center;
        color: var(--theme-on-bg-secondary);
        margin: 0.5rem 0 1rem;
    }
</style>
