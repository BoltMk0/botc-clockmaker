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
    <table>
        <tbody>
            <tr>
                <td colspan="3">
                    <div style="display: flex;">
                        <button style="flex: 1;" onclick={() => codes.splice(codes.length - 1, 1)}>Delete Entry</button>
                        <button style="flex: 1;" onclick={() => codes.push({ url: '', title: '', position: DEFAULT_QR_POSITION })}>Add Entry</button>
                        <button style="background-color: greenyellow;" onclick={save}>Save</button>
                    </div>
                </td>
            </tr>
            <tr>
                <th>Title</th>
                <th>URL</th>
                <th>Position</th>
            </tr>
            {#each codes as code}
                <tr>
                    <td><input bind:value={code.title} type="text" placeholder="Title" /></td>
                    <td><input class="url-input" bind:value={code.url} type="text" placeholder="https://..." /></td>
                    <td>
                        <select bind:value={code.position}>
                            {#each QR_POSITIONS as pos}
                                <option value={pos}>{QR_POSITION_LABELS[pos]}</option>
                            {/each}
                        </select>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .url-input {
        width: 24em;
    }

    .main {
        margin-top: 5em;
    }

    table {
        background-color: var(--theme-bg);
    }
</style>
