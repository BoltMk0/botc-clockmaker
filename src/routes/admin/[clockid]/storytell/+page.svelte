<script lang="ts">
    import Navbar from '$lib/components/Navbar.svelte';

    let { data }: { data: { clockid: string, name: string, hasGrim: boolean } } = $props();

    // Seeded from the server-loaded value, then updated locally after removing so the buttons
    // switch without a reload.
    let grimExists = $state(data.hasGrim);

    function removeGrim(){
        if(!confirm("Are you sure you want to delete the grim for this game? This action cannot be undone.")) return;
        fetch(`/admin/${data.clockid}/grim/state`, { method: 'DELETE' }).then(response => {
            if (!response.ok) {
                alert("Failed to delete grim");
                throw new Error('Failed to delete grim');
            }
            grimExists = false;
        }).catch(error => {
            console.error("Error deleting grim:", error);
        });
    }
</script>

<Navbar/>

<div class="storytell">
    <div class="storytell-header">
        <a class="storytell-back" href="/play">&larr; Back</a>
        <div class="storytell-title dumbledore-font">{data.name}</div>
        <div class="storytell-subtitle">Storytell</div>
    </div>

    <div class="storytell-section">
        <div class="storytell-section-title">Grim</div>
        {#if grimExists}
            <div class="row">
                <a class="button-style" href="/admin/{data.clockid}/grim">Open Grim</a>
                <button class="button-style error" onclick={removeGrim}>Delete Grim</button>
            </div>
        {:else}
            <a class="button-style setup-btn" href="/admin/{data.clockid}/grim/setup">Setup new grim</a>
        {/if}
    </div>

    <div class="storytell-section">
        <div class="storytell-section-title">Clock</div>
        <a class="button-style" href="/admin/{data.clockid}">Clock timer controls</a>
    </div>
</div>

<style>
    .storytell {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 90px 2em 2em;
        overflow: auto;
        color: var(--theme-on-bg);
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .storytell-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4em;
        margin-bottom: 1.5em;
        width: 100%;
        max-width: 400px;
    }

    .storytell-back {
        align-self: start;
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
        font-size: large;
    }

    .storytell-back:hover {
        opacity: 1;
    }

    .storytell-title {
        font-size: 2em;
        opacity: 0.9;
        text-align: center;
    }

    .storytell-subtitle {
        opacity: 0.6;
    }

    .storytell-section {
        display: flex;
        flex-direction: column;
        gap: 0.6em;
        width: 100%;
        max-width: 400px;
        margin-bottom: 1.5em;
    }

    .storytell-section-title {
        font-size: large;
        opacity: 0.6;
    }

    .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5em;
    }

    .storytell-section .button-style {
        box-sizing: border-box;
        text-align: center;
        padding: 0.8em 1em;
        font-size: large;
    }

    .setup-btn {
        background: transparent;
        border: 2px dashed currentColor;
    }
</style>
