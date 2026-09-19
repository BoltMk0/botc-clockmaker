<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import PlusIcon from '$lib/components/PlusIcon.svelte';
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
    <div class="play-header">
        <a class="play-home" href="/">&larr; Back</a>
        <div class="play-title dumbledore-font">Play</div>
    </div>

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
                    <a class="button-style" href="/townsquare/{id}">Town Square</a>
                    <a class="button-style" href="/admin/{id}/storytell">Storytell</a>
                </div>
            </div>
        {/each}

        {#if data.games.length > 0}
            <a class="button-style new-game-row" href="/townsquare/all">View All (Splitscreen)</a>
        {/if}

        <button class="button-style new-game-row" onclick={createNewGame} disabled={creating}>
            <PlusIcon size={28}/>
            <span>New Game</span>
        </button>

        <a class="button-style new-game-row" href="/admin/mixer">Audio Mixer</a>
    </div>
</div>

<style>
    .play {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        padding: 90px 2em 2em;
        overflow: auto;
        color: var(--theme-on-bg);
    }

    .play-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75em;
        width: 100%;
        max-width: 480px;
        margin: 0 auto 1.5em;
    }

    .play-home {
        align-self: start;
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.8;
        font-size: large;
    }

    .play-home:hover {
        opacity: 1;
    }

    .play-title {
        font-size: 2em;
        opacity: 0.9;
    }

    .game-list {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
    }

    .game-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        padding: 1em 1.1em;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        border-radius: 0.5em;
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
        color: var(--theme-on-bg);
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
    }

    .game-panel-actions .button-style {
        padding: 1.1em 0.5em;
        font-size: large;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .new-game-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5em;
        width: 100%;
        box-sizing: border-box;
        padding: 0.9em 1.1em;
        font-size: large;
        background-color: var(--theme-bg-secondary);
    }

    .new-game-row:hover {
        background-color: var(--theme-bg-tertiary);
    }
</style>
