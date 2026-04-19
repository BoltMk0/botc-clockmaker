<script lang="ts">
    import SkyDisplay from "../OldClockFace/SkyDisplay.svelte";
import DisplayPanelBase from "./DisplayPanel/DisplayPanelBase.svelte";

    export let progress: number; // 0 to 1
    
    export let timeRemaining: number;
    export let title = "Time Remaining";
    export let style = "";
    export let sky: boolean = false;

    $: minutes = Math.floor(timeRemaining / 60);
    $: seconds = Math.round(timeRemaining) % 60;
    $: timeRemainingString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
</script>

<style>
</style>
<DisplayPanelBase title={title}>
    {#if sky}
    <div style="position: relative;">
        <SkyDisplay progress={progress} style={"width: 100%; height: 100px;"}/>
        <div style=" position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5em; text-shadow: 0 2px 4px #0007; font-family: monospace; font-weight: bold;">{timeRemainingString}</div>
    </div>
    {:else}
    <div style=" text-align: center; font-size: 1.7em; text-shadow: 0 2px 4px #0007; font-family: monospace; font-weight: bold; padding: 10px;">{timeRemainingString}</div>
    {/if}
</DisplayPanelBase>