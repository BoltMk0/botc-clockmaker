<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/state';
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

    // Deep-linked from elsewhere (e.g. the Town Square game list's "Settings"
    // buttons) via ?select=<clockId>, so that link lands on the right clock's
    // tab instead of always defaulting to the first one.
    const selectedClockId = page.url.searchParams.get('select');
    const initialIndex = selectedClockId
        ? Math.max(0, data.clocks.findIndex(c => c.clock.clockId === selectedClockId))
        : 0;

    var selectedIndex = $state(initialIndex);

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
    {#key clock.clock.clockId}
        <ClockEditView {clock} sfx_resources={data.sfxResources}/>
    {/key}
{/snippet}

<SideTabLayout title="Games" items={data.clocks.map(c=>{
    return {
        label: c.config.teamName ?? c.clock.clockId,
        snippet: renderClockSettings,
        arg: c
    }
})} onAddItem={createNewClock} bind:selectedIndex/>
