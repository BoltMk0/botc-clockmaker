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

<style>
    .main {
        margin-top: 5em;
    }

    .panel {
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border-radius: 12px;
        box-shadow: 0 4px 16px var(--theme-shadow);
        padding: 1.25rem;
        width: min(60rem, 92vw);
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }

    h1 {
        margin: 0;
        font-size: 1.4rem;
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
        margin: 1.5rem 0;
    }
</style>
