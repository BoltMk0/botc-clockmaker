<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import type { Config } from '$lib/common/config.js';
    import SideTabLayout from '$lib/components/SideTabLayout.svelte';
    import { v7 } from 'uuid';
    import ClockEditView from './ClockEditView.svelte';
    import type { Resource } from '$lib/resources/common/types';
    import { type ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    type Props = {
        clocks: ClocktowerModel[];
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

{#snippet renderClockSettings(clock: ClocktowerModel)}
    <ClockEditView {clock} sfx_resources={data.sfxResources}/>
{/snippet}

<SideTabLayout title="Clocks" items={data.clocks.map(c=>{
    return {
        label: c.config.teamName ?? c.clock.clockId,
        snippet: renderClockSettings,
        arg: c
    }
})} onAddItem={createNewClock} bind:selectedIndex/>
