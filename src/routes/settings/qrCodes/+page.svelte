<script lang="ts">
    import type { QrCode } from "$lib/resources/server/qrCodes";
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
                <td colspan="2">
                    <div style="display: flex;">
                        <button style="flex: 1;" onclick={() => codes.splice(codes.length - 1, 1)}>Delete Entry</button>
                        <button style="flex: 1;" onclick={() => codes.push({ url: '', title: '' })}>Add Entry</button>
                        <button style="background-color: greenyellow;" onclick={save}>Save</button>
                    </div>
                </td>
            </tr>
            <tr>
                <th>Title</th>
                <th>URL</th>
            </tr>
            {#each codes as code}
                <tr>
                    <td><input bind:value={code.title} type="text" placeholder="Title" /></td>
                    <td><input class="url-input" bind:value={code.url} type="text" placeholder="https://..." /></td>
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
