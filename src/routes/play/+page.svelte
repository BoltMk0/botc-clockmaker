<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import PlusIcon from '$lib/components/PlusIcon.svelte';
    import BookIcon from '$lib/components/BookIcon.svelte';
    import TownSquareIcon from '$lib/components/TownSquareIcon.svelte';
    import CogIcon from '$lib/components/CogIcon.svelte';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    let { data }: { data: { games: { instance: ClocktowerModel, scriptName: string | null }[] } } = $props();

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

</script>

<TopNavbar/>

<div class="play">
  <div class="card">
    <header class="card-header">
        <h1>Play</h1>
        <button class="new-game" onclick={createNewGame} disabled={creating}>
            <PlusIcon size={20}/>
            <span>New Game</span>
        </button>
    </header>
    <p class="description">Open a game's town square or storytelling view.</p>

    <div class="game-list">
        {#each data.games as { instance, scriptName } (instance.clock.clockId)}
            {@const id = instance.clock.clockId}
            <div class="game-panel">
                <div class="game-panel-name">{instance.config.teamName ?? id}</div>
                <a class="settings-link" href="/settings/clocks?select={id}" aria-label="Game settings" title="Settings">
                    <CogIcon size={24}/>
                </a>
                <div class="game-panel-stats">
                    <div class="stat">
                        <div class="stat-label">Script</div>
                        <div class="stat-value">{scriptName ?? '-'}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Players</div>
                        <div class="stat-value">{instance.clock.numPlayers}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Day</div>
                        <div class="stat-value">{instance.clock.day}</div>
                    </div>
                </div>
                <div class="game-panel-actions">
                    <a class="button-style" href="/townsquare/{id}"><TownSquareIcon size={36}/><span>Town Square</span><small>The shared clock display for players</small></a>
                    <a class="button-style" href="/admin/{id}/storytell"><BookIcon size={36}/><span>Storytell</span><small>Grimoire and clock controls for the storyteller</small></a>
                </div>
            </div>
        {/each}

        {#if data.games.length === 0}
            <p class="empty">No games yet. Create one to get started.</p>
        {/if}

    </div>

    <section class="tools">
        <h2>Tools</h2>
        <div class="extra-links">
            {#if data.games.length > 0}
                <a class="button-style" href="/townsquare/all">View All (Splitscreen)</a>
            {/if}
            <a class="button-style" href="/admin/mixer">Audio Mixer</a>
        </div>
    </section>
  </div>
</div>

<style>
    .play {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 90px 1.5rem 1.5rem;
        overflow: auto;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        color: var(--theme-on-bg);
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

    .card-header {
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

    .new-game {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        padding: 0.5em 1.2em;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border: 1px solid var(--theme-highlight);
        border-radius: 999px;
    }

    .new-game:hover:not(:disabled) {
        filter: brightness(1.12);
    }

    .new-game:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .game-list {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    .game-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        padding: 1em 1.1em;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
    }

    .game-panel-name {
        font-size: x-large;
        word-break: break-word;
        padding-right: 2em;
    }

    .settings-link {
        position: absolute;
        top: 0.8em;
        right: 1em;
        display: flex;
        color: var(--theme-on-bg-secondary);
        opacity: 0.6;
    }

    .settings-link:hover {
        opacity: 1;
    }

    .game-panel-stats {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 0.5em;
    }

    .stat-label {
        font-size: small;
        opacity: 0.6;
    }

    .stat-value {
        font-size: large;
        word-break: break-word;
    }

    .game-panel-actions {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5em;
    }

    .game-panel-actions .button-style {
        box-sizing: border-box;
        text-align: center;
        padding: 1.1em 0.5em;
        font-size: large;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        align-items: center;
        justify-content: center;
    }

    .game-panel-actions small {
        font-size: 0.75rem;
        font-style: italic;
        line-height: 1.3;
        opacity: 0.7;
    }

    .empty {
        margin: 0.5rem 0;
        text-align: center;
        opacity: 0.7;
    }

    .tools {
        margin-top: 1.25rem;
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
    }

    .tools h2 {
        margin: 0 0 0.75rem;
        font-size: 1.05rem;
        color: var(--theme-on-bg);
    }

    .extra-links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    .extra-links .button-style {
        flex: 1;
        box-sizing: border-box;
        text-align: center;
        padding: 0.7em 1.1em;
    }
</style>
