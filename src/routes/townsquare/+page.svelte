<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import Navbar from '$lib/components/Navbar.svelte';
    import PlusIcon from '$lib/components/PlusIcon.svelte';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    let { data }: { data: { instances: ClocktowerModel[] } } = $props();

    let creating = $state(false);

    function createNewGame(){
        if(creating) return;
        creating = true;
        fetch('/api/clock/create', { method: 'POST' }).then(response => {
            if(!response.ok){
                alert("Failed to create game");
                throw new Error('Failed to create game');
            }
            return invalidateAll();
        }).catch(error => {
            console.error("Error creating game:", error);
        }).finally(() => {
            creating = false;
        });
    }

    function deleteGame(instance: ClocktowerModel){
        const name = instance.config.teamName ?? instance.clock.clockId;
        if(!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
        fetch(`/api/clock/${instance.clock.clockId}/delete`, { method: 'POST' }).then(response => {
            if(!response.ok){
                alert("Failed to delete game");
                throw new Error('Failed to delete game');
            }
            return invalidateAll();
        }).catch(error => {
            console.error("Error deleting game:", error);
        });
    }
</script>

<Navbar/>

<div class="townsquare">
    <div class="townsquare-header">
        <a class="townsquare-home" href="/">&larr; Back</a>
        <div class="townsquare-title dumbledore-font">Town Square</div>
    </div>

    <div class="game-list">
        {#each data.instances as instance (instance.clock.clockId)}
            <div class="game-row">
                <a class="game-row-link" href="/townsquare/{instance.clock.clockId}" aria-label="Open {instance.config.teamName ?? instance.clock.clockId}"></a>
                <span class="game-row-name">{instance.config.teamName ?? instance.clock.clockId}</span>
                <div class="game-row-actions">
                    <a class="button-style" href="/settings/clocks?select={instance.clock.clockId}">Settings</a>
                    <button class="button-style error" onclick={() => deleteGame(instance)}>Delete</button>
                </div>
            </div>
        {/each}

        {#if data.instances.length > 0}
            <a class="button-style new-game-row" href="/townsquare/all">View All (Splitscreen)</a>
        {/if}

        <button class="button-style new-game-row" onclick={createNewGame} disabled={creating}>
            <PlusIcon size={28}/>
            <span>New Game</span>
        </button>
    </div>
</div>

<style>
    .townsquare {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 90px 2em 2em;
        overflow: auto;
        color: var(--theme-on-bg);
    }

    .townsquare-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75em;
        width: 100%;
        max-width: 420px;
        margin: 0 auto 1.5em;
    }

    .townsquare-home {
        align-self: start;
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
        font-size: large;
    }

    .townsquare-home:hover {
        opacity: 1;
    }

    .townsquare-title {
        font-size: 2em;
        opacity: 0.9;
    }

    .game-list {
        display: flex;
        flex-direction: column;
        gap: 0.6em;
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
    }

    .game-row {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1em;
        width: 100%;
        padding: 0.9em 1.1em;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        border-radius: 0.5em;
        transition: background-color 0.3s;
    }

    .game-row:hover {
        background-color: var(--theme-bg-tertiary);
    }

    /* Stretches to cover the whole row so anywhere on it is clickable,
       while sitting behind the row's own interactive controls (below) so
       Settings/Delete stay independently clickable rather than nesting
       interactive elements inside this link. */
    .game-row-link {
        position: absolute;
        inset: 0;
        z-index: 0;
    }

    .game-row-name {
        position: relative;
        z-index: 1;
        font-size: large;
        color: var(--theme-on-bg);
        word-break: break-word;
        pointer-events: none;
    }

    .game-row-actions {
        position: relative;
        z-index: 1;
        display: flex;
        gap: 0.5em;
        flex-shrink: 0;
    }

    .new-game-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
        width: 100%;
        padding: 0.9em 1.1em;
        font-size: large;
        background-color: var(--theme-bg-secondary);
    }

    .new-game-row:hover {
        background-color: var(--theme-bg-tertiary);
    }
</style>
