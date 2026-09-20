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
  <div class="card">
    <header class="card-header">
        <h1>Storytell - {data.name}</h1>
    </header>
    <p class="description">Storytelling tools for this game.</p>

    <div class="storytell-halves">
    <section class="storytell-section">
        <h2>Virtual Grimoire</h2>
        {#if grimExists}
            <a class="button-style" href="/admin/{data.clockid}/grim"><BookIcon size={40}/><span>Open Grim</span><small>Open the virtual grimoire with tokens and annotations</small></a>
            <button class="button-style error delete-grim" onclick={() => deleteOverlayVisible = true}><TrashIcon size={22}/><span>Delete Grim</span><small>Remove the virtual grimoire and record who won</small></button>
            <CustomOverlay title="Delete Grim" showButton={false} bind:visible={deleteOverlayVisible}>
                <p style="margin-top: 0;">Who won this game? This cannot be undone.</p>
                <div class="delete-choices">
                    <button class="button-style evil-victory" onclick={() => removeGrim('evil')}>Evil victory</button>
                    <button class="button-style good-victory" onclick={() => removeGrim('good')}>Good victory</button>
                    <button class="button-style" onclick={() => removeGrim()}>Just delete</button>
                </div>
            </CustomOverlay>
        {:else}
            <a class="button-style setup-btn" href="/admin/{data.clockid}/grim/setup"><PlusIcon size={40}/><span>Setup new grim</span><small>Choose a script and characters to start a new virtual grimoire. The clock timer is controllable from within the grim.</small></a>
        {/if}
    </section>

    <section class="storytell-section">
        <h2>Clock Only</h2>
        <a class="button-style fill" href="/admin/{data.clockid}"><ClockIcon size={40}/><span>Clock timer controls</span><small>Start, stop and adjust the game timer and day. Intended for use with a physical grimoire</small></a>
    </section>
    </div>
  </div>
</div>

<style>
    .storytell {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 90px 1.5rem 1.5rem;
        overflow: auto;
        color: var(--theme-on-bg);
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }

    .card {
        width: 100%;
        max-width: 42rem;
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
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

    .storytell-halves {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .storytell-section {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        min-width: 0;
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    h2 {
        margin: 0;
        font-size: 1.05rem;
        color: var(--theme-on-bg);
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

    .storytell-section small {
        font-size: 0.75rem;
        font-style: italic;
        line-height: 1.3;
        opacity: 0.7;
    }

    .storytell-section .fill {
        flex: 1;
    }

    .storytell-section .delete-grim {
        flex: 0 0 auto;
        min-height: 0;
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

    @media (max-width: 560px) {
        .storytell-halves {
            grid-template-columns: 1fr;
        }
    }
</style>
