<script lang="ts">
    import BookIcon from '$lib/components/BookIcon.svelte';
    import ClockIcon from '$lib/components/ClockIcon.svelte';
    import PlusIcon from '$lib/components/PlusIcon.svelte';
    import TrashIcon from '$lib/components/TrashIcon.svelte';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';

    let { data }: { data: { clockid: string, name: string, hasGrim: boolean } } = $props();

    // Seeded from the server-loaded value, then updated locally after removing so the buttons
    // switch without a reload.
    let grimExists = $state(data.hasGrim);

    let deleteOverlayVisible = $state(false);

    // A winner credits the game to the preset it was set up from (if any) before the grim is deleted.
    function removeGrim(winner?: 'good' | 'evil'){
        deleteOverlayVisible = false;
        const query = winner ? `?winner=${winner}` : '';
        fetch(`/admin/${data.clockid}/grim/state${query}`, { method: 'DELETE' }).then(response => {
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

<TopNavbar/>

<div class="storytell">
    <div class="storytell-header">
        <a class="storytell-back" href="/play">&larr; Back</a>
        <div class="storytell-title dumbledore-font">{data.name}</div>
        <div class="storytell-subtitle">Storytell</div>
    </div>

    <div class="storytell-halves">
    <div class="storytell-section">
        <div class="storytell-section-title">Grim</div>
        {#if grimExists}
            <a class="button-style" href="/admin/{data.clockid}/grim"><BookIcon size={40}/><span>Open Grim</span></a>
            <button class="button-style error delete-grim" onclick={() => deleteOverlayVisible = true}><TrashIcon size={22}/><span>Delete Grim</span></button>
            <CustomOverlay title="Delete Grim" showButton={false} bind:visible={deleteOverlayVisible}>
                <p style="margin-top: 0;">Who won this game? This cannot be undone.</p>
                <div class="delete-choices">
                    <button class="button-style evil-victory" onclick={() => removeGrim('evil')}>Evil victory</button>
                    <button class="button-style good-victory" onclick={() => removeGrim('good')}>Good victory</button>
                    <button class="button-style" onclick={() => removeGrim()}>Just delete</button>
                </div>
            </CustomOverlay>
        {:else}
            <a class="button-style setup-btn" href="/admin/{data.clockid}/grim/setup"><PlusIcon size={40}/><span>Setup new grim</span></a>
        {/if}
    </div>

    <div class="storytell-section">
        <div class="storytell-section-title">Clock</div>
        <a class="button-style fill" href="/admin/{data.clockid}"><ClockIcon size={40}/><span>Clock timer controls</span></a>
    </div>
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
        max-width: 600px;
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

    .storytell-halves {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2em;
        width: 100%;
        max-width: 600px;
    }

    .storytell-section {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        min-width: 0;
    }

    .storytell-section-title {
        font-size: large;
        opacity: 0.6;
    }

    .storytell-section .button-style {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
        text-align: center;
        padding: 1em;
        font-size: large;
        min-height: 5em;
    }

    .storytell-section .fill {
        flex: 1;
    }

    .storytell-section .delete-grim {
        flex: 0 0 auto;
        flex-direction: row;
        min-height: 0;
        font-size: large;
    }

    .delete-choices {
        display: flex;
        flex-direction: column;
        gap: 0.6em;
    }

    .delete-choices .button-style {
        padding: 0.8em 1em;
        text-align: center;
    }

    .evil-victory {
        background-color: #b63737;
        color: #fff;
    }

    .good-victory {
        background-color: #2563eb;
        color: #fff;
    }

    .setup-btn {
        background: transparent;
        border: 2px dashed currentColor;
    }
</style>
