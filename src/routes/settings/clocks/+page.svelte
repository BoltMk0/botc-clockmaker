<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import type { ClockInstanceInfo, Config } from '$lib/common/config.js';
    import Navbar from '$lib/components/Navbar.svelte';
    import SideTabLayout from '$lib/components/SideTabLayout.svelte';
    import { v7 } from 'uuid';
    import ClockEditView from './ClockEditView.svelte';
    import type { Resource } from '$lib/resources/common/types';
    import { tick } from 'svelte';

    type Props = {
        clocks: ClockInstanceInfo[];
        sfxResources: Resource[]
    };

    const {data}: {data: Props} = $props();

    var selectedIndex = $state(0);

    $inspect("Loaded SFX:", data.sfxResources)

    function createNewClock(){
        let newClockId = v7();
        const trimmedId = newClockId.trim();
        if(trimmedId){
            fetch(`/api/clock/create`, {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    alert("Failed to create clock");
                    throw new Error('Failed to create clock');
                }
                invalidateAll().then(()=>{
                    selectedIndex = data.clocks.length-1;
                });
            }).catch(error => {
                console.error("Error creating clock:", error);
            });
        }
    }

    function deleteClock(clockData: {id: string, config: Config}){
        if(confirm(`Are you sure you want to delete clock "${clockData.config.teamName ?? clockData.id}"? This action cannot be undone.`)){
            fetch(`/api/clock/${clockData.id}/delete`, {
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

{#snippet renderClockSettings(clock: ClockInstanceInfo)}
    <ClockEditView {clock} sfx_resources={data.sfxResources}/>
{/snippet}

<SideTabLayout title="Clocks" items={data.clocks.map(c=>{
    return {
        label: c.config.teamName ?? c.id,
        snippet: renderClockSettings,
        arg: c
    }
})} onAddItem={createNewClock} bind:selectedIndex style="padding: 1em;"/>
