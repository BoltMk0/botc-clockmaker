<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import type { Config } from '$lib/common/config.js';
    import Navbar from '$lib/components/Navbar.svelte';
    import { v7 } from 'uuid';

    export let data;

    function createNewClock(){
        let newClockId = v7();
        const trimmedId = newClockId.trim();
        if(trimmedId){
            fetch(`/admin/api/clock/create`, {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    alert("Failed to create clock");
                    throw new Error('Failed to create clock');
                }
                response.text().then(id => {
                    console.log("Clock created with id:", id);
                    goto(`/admin/${id}/config`);
                });
            }).catch(error => {
                console.error("Error creating clock:", error);
            });
        }
    }

    function deleteClock(clockData: {id: string, config: Config}){
        if(confirm(`Are you sure you want to delete clock "${clockData.config.teamName ?? clockData.id}"? This action cannot be undone.`)){
            fetch(`/admin/api/clock/${clockData.id}/delete`, {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    alert("Failed to delete clock");
                    throw new Error('Failed to delete clock');
                }
                console.log("Clock deleted");
                invalidateAll();
                goto('/admin/');
            }).catch(error => {
                console.error("Error deleting clock:", error);
            });
        }
    }

</script>

<div style="display: flex; flex-direction: column; gap: 10px;">
    <table>
        <tbody>
            {#each data.clocks as clockData(clockData.id)}
            <tr>
                <td><a class="button-style" style="min-width: 10em; border-color: hsl({clockData.config.theme.hue}, 70%, 50%)" href="/admin/{clockData.id}">{clockData.config.teamName ?? clockData.id}</a></td>
                <td><button class="button-style error" on:click={() => deleteClock(clockData)} disabled={clockData.id==="default"}>Delete</button></td>
            </tr>
            {/each}
            <tr>
                <td colspan="2">
                    <button class="button-style highlight" on:click={createNewClock}>
                        Create New Clock
                    </button>
                </td>
            </tr>
        </tbody>
    </table>
</div>

<Navbar/>

<style>
    table, td {
        border-collapse: collapse;
    }
    td {
        padding: 2px;
    }

    td>.button-style {
        display: block;
        width: 100%;
    }

    a.button-style {
        border: 2px solid #0000;
    }
</style>