<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import PlusIcon from '$lib/components/PlusIcon.svelte';
    import BookIcon from '$lib/components/BookIcon.svelte';
    import TownSquareIcon from '$lib/components/TownSquareIcon.svelte';
    import TrashIcon from '$lib/components/TrashIcon.svelte';
    import PencilIcon from '$lib/components/PencilIcon.svelte';
    import type { Config } from '$lib/common/config';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';
    import type { ClockSfxPreset } from '$lib/audio/common/clockSfxPreset';

    let { data }: { data: {
        games: { instance: ClocktowerModel, scriptId: string | null, scriptName: string | null, hasGrim: boolean }[],
        clockSfxPresets: ClockSfxPreset[]
    } } = $props();

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
        const id = instance.clock.clockId;
        if(!confirm(`Delete "${instance.config.teamName ?? id}"? This cannot be undone.`)) return;
        fetch(`/api/clock/${id}`, { method: 'DELETE' }).then(response => {
            if(!response.ok){
                alert("Failed to delete game");
                throw new Error('Failed to delete game');
            }
            return invalidateAll();
        }).catch(error => {
            console.error("Error deleting game:", error);
        });
    }

    function saveConfig(instance: ClocktowerModel, changes: Partial<Config>, what: string){
        const id = instance.clock.clockId;
        const config = { ...instance.config, teamName: instance.config.teamName ?? id, ...changes };
        fetch(`/api/clock/${id}/config`, {
            method: 'POST',
            body: JSON.stringify(config),
            headers: { 'Content-Type': 'application/json' }
        }).then(response => {
            if(!response.ok){
                alert(`Failed to change ${what}`);
                throw new Error(`Failed to change ${what}`);
            }
            return invalidateAll();
        }).catch(error => {
            console.error(`Error changing ${what}:`, error);
            invalidateAll(); // Put the page back to the saved values
        });
    }

    // Saved as soon as it's picked; the server re-resolves the clock's bell sounds from the preset.
    function setClockSfxPreset(instance: ClocktowerModel, presetId: string | null){
        saveConfig(instance, { clockSfxPresetId: presetId }, 'clock SFX preset');
    }

    // The game whose name is being edited, and the name typed so far.
    let renamingId: string | null = $state(null);
    let renameValue = $state('');

    function startRename(instance: ClocktowerModel){
        renamingId = instance.clock.clockId;
        renameValue = instance.config.teamName ?? instance.clock.clockId;
    }

    function finishRename(instance: ClocktowerModel){
        if(renamingId !== instance.clock.clockId) return; // Already finished (Enter then blur)
        renamingId = null;
        const name = renameValue.trim();
        if(name && name !== instance.config.teamName) saveConfig(instance, { teamName: name }, 'game name');
    }

    function focusAndSelect(input: HTMLInputElement){
        input.focus();
        input.select();
    }

    // The game whose grim the End game dialog is for.
    let endGameId: string | null = $state(null);
    let endGameVisible = $state(false);

    function openEndGame(id: string){
        endGameId = id;
        endGameVisible = true;
    }

    // A winner credits the game to the preset it was set up from (if any) before the grim is deleted.
    function endGame(winner?: 'good' | 'evil'){
        endGameVisible = false;
        const id = endGameId;
        if(!id) return;
        const query = winner ? `?winner=${winner}` : '';
        fetch(`/admin/${id}/grim/state${query}`, { method: 'DELETE' }).then(response => {
            if(!response.ok){
                alert("Failed to end game");
                throw new Error('Failed to end game');
            }
            localStorage.removeItem(`grimoire-state-${id}`);
            return invalidateAll();
        }).catch(error => {
            console.error("Error ending game:", error);
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
    <p class="description">Open a game's town square or grimoire.</p>

    <div class="game-list">
        {#each data.games as { instance, scriptId, scriptName, hasGrim } (instance.clock.clockId)}
            {@const id = instance.clock.clockId}
            <div class="game-panel">
                <div class="game-panel-name">
                    {#if renamingId === id}
                        <input
                            class="rename-input"
                            type="text"
                            aria-label="Game name"
                            bind:value={renameValue}
                            use:focusAndSelect
                            onblur={() => finishRename(instance)}
                            onkeydown={(e) => {
                                if(e.key === 'Enter') finishRename(instance);
                                else if(e.key === 'Escape') renamingId = null;
                            }}/>
                    {:else}
                        <span>{instance.config.teamName ?? id}</span>
                        <button class="rename-game" onclick={() => startRename(instance)} aria-label="Rename game" title="Rename">
                            <PencilIcon size={20}/>
                        </button>
                    {/if}
                </div>
                <button class="delete-game" onclick={() => deleteGame(instance)} aria-label="Delete game" title="Delete">
                    <TrashIcon size={24}/>
                </button>
                <div class="game-panel-stats">
                    <div class="stat">
                        <div class="stat-label">Script</div>
                        <div class="stat-value script-value">
                            <span>{scriptName ?? '-'}</span>
                            {#if scriptId}
                                <a class="view-script" href="/script/{scriptId}?backUrl=/play" aria-label="View script characters" title="View characters">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
                                        <path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>
                                    </svg>
                                </a>
                            {/if}
                        </div>
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
                <label class="sfx-preset">
                    <span class="stat-label">Clock SFX</span>
                    <select value={instance.config.clockSfxPresetId ?? ''} onchange={(e) => setClockSfxPreset(instance, e.currentTarget.value || null)}>
                        <option value="">None</option>
                        {#each data.clockSfxPresets as preset (preset.id)}
                            <option value={preset.id}>{preset.name}</option>
                        {/each}
                    </select>
                </label>
                <div class="game-panel-actions">
                    <a class="button-style" href="/townsquare/{id}"><TownSquareIcon size={36}/><span>Town Square</span></a>
                    {#if hasGrim}
                        <div class="grim-actions">
                            <a class="button-style" href="/admin/{id}/grim"><BookIcon size={36}/><span>Grimoire</span></a>
                            <button class="button-style end-game" onclick={() => openEndGame(id)}>End game</button>
                        </div>
                    {:else}
                        <a class="button-style setup-grim" href="/admin/{id}/grim/setup"><PlusIcon size={36}/><span>Setup Grimoire</span></a>
                    {/if}
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

<CustomOverlay title="End game" showButton={false} showClose={false} bind:visible={endGameVisible}>
    <p style="margin-top: 0;">Who won this game? This deletes the grimoire and cannot be undone.</p>
    <div class="end-game-choices">
        <button class="button-style evil-victory" onclick={() => endGame('evil')}>Evil victory</button>
        <button class="button-style good-victory" onclick={() => endGame('good')}>Good victory</button>
        <button class="button-style" onclick={() => endGame()}>Just delete</button>
        <button class="button-style cancel" onclick={() => endGameVisible = false}>Cancel</button>
    </div>
</CustomOverlay>

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
    }

    .game-panel {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.8em;
        padding: 1rem;
        box-sizing: border-box;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
    }

    .game-panel-name {
        display: flex;
        align-items: center;
        gap: 0.3em;
        font-size: x-large;
        word-break: break-word;
        padding-right: 2em;
    }

    .rename-game {
        display: flex;
        flex: 0 0 auto;
        padding: 0.2em;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--theme-on-bg);
        opacity: 0.6;
        cursor: pointer;
    }

    .rename-game:hover {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
    }

    .rename-input {
        flex: 1;
        min-width: 0;
        box-sizing: border-box;
        padding: 0.1em 0.4em;
        border: 1px solid var(--theme-highlight);
        border-radius: 6px;
        outline: none;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    .delete-game {
        position: absolute;
        top: 0.8em;
        right: 1em;
        display: flex;
        padding: 0.2em;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--theme-on-bg);
        opacity: 0.6;
        cursor: pointer;
    }

    .delete-game:hover {
        opacity: 1;
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    .sfx-preset {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
    }

    .sfx-preset select {
        width: 100%;
        box-sizing: border-box;
        padding: 0.5rem 0.6rem;
        border: 1px solid transparent;
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    .sfx-preset select:focus {
        outline: none;
        border-color: var(--theme-highlight);
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

    .script-value {
        display: flex;
        align-items: center;
        gap: 0.3em;
    }

    .view-script {
        display: flex;
        flex: 0 0 auto;
        padding: 0.2em;
        border-radius: 6px;
        color: var(--theme-on-bg);
        opacity: 0.6;
    }

    .view-script:hover {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
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

    .grim-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
    }

    .grim-actions > a {
        flex: 1;
    }

    .game-panel-actions .end-game {
        flex: 0 0 auto;
        padding: 0.4em 0.5em;
        font-size: medium;
        background-color: #b63737;
        color: #fff;
    }

    .end-game-choices {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .end-game-choices .button-style {
        padding: 0.8em 1em;
        text-align: center;
    }

    .end-game-choices .cancel {
        margin-top: 10px;
    }

    .evil-victory {
        background-color: #b63737;
        color: #fff;
    }

    .good-victory {
        background-color: #2563eb;
        color: #fff;
    }

    .game-panel-actions .setup-grim {
        background: transparent;
        border: 2px dashed currentColor;
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
