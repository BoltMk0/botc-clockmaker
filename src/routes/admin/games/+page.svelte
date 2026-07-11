<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import type { GameFull } from '$lib/database/common/types.js';
    import CustomOverlay from '$lib/components/CustomOverlay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import { formatTimeAgo } from '$lib/common/util';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    async function createGame(event: SubmitEvent) {
        const formData = new FormData(event.target as HTMLFormElement);
        const body = Object.fromEntries(formData);
        try {
            const response = await fetch('/api/games', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
            const responseData = await response.json();
            if (!response.ok) {
                alert(`Failed to create new game: ${responseData.error || 'Unknown error'}`);
                return;
            } else {
                goto(`/admin/games/${responseData.id}`); // Navigate to the new game's edit page
            }
        } catch (er) {
            alert(`Failed to create new game: ${er}`);
        }
    }

    async function deleteGame(gameId: number) {
        if (!confirm("Are you sure you want to delete this game? This action cannot be undone.")) return;
        try {
            await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
            invalidateAll();
        } catch (er) {
            alert(`Failed to delete game: ${er}`);
        }
    }

    function get_player_count(game: GameFull){
        return game.script.characters.filter(scriptChar => game.character_ids.includes(scriptChar.id)).reduce((count, scriptChar) => count + scriptChar.player_count, 0);
    }


</script>

<style>
    table {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-secondary);
        border-collapse: collapse;
    }

    th, td {
        padding : 0.2em 0.5em;
        border-collapse: collapse;
        margin: 0;
    }

    th {
        background-color: #0002;
    }

    .table-container {
        background-color: var(--theme-bg);
        padding: 1em;
    }
</style>

<Navbar/>
<div>
    <div class="table-container">
        <div style="display: flex; width: 100%; justify-content: space-between; align-items: center;">
            <h3>Games</h3>
            <CustomOverlay title="+ Create Game">
                <form onsubmit={(event) => { event.preventDefault(); createGame(event); }}>
                    <select name="script_id" required>
                        <option disabled>Select script id</option>
                        {#each data.scripts as script(script.id)}
                            <option value="{script.id}">{script.name}</option>
                        {/each}
                    </select>
                    <button>Submit</button>
                </form>
            </CustomOverlay>
        </div>
        <table style="text-align: center;">
            <thead>
                <tr>
                    <th>Script</th>
                    <th>Players</th>
                    <th>Created</th>
                    <th>Last Change</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {#each data.games.sort((a, b)=>new Date(a.game.created).getTime() - new Date(b.game.created).getTime()) as game(game.game.id)}
                    <tr>
                        <td>{game.game.script.name}</td>
                        <td>{get_player_count(game.game) || ""}</td>
                        <td>{formatTimeAgo(new Date(game.game.created).getTime())}</td>
                        <td>{game.grimoireState ? formatTimeAgo(new Date(game.grimoireState.present.timestamp).getTime()) : ''}</td>
                        <td>
                            <a class="button-style" href="/admin/games/{game.game.id}">Edit</a>
                            <button onclick={() => deleteGame(game.game.id)} class="button-style">Delete</button>
                            <a class="button-style" href="/admin/games/{game.game.id}/grimoire">Grimoire</a>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>

    </div>
</div>