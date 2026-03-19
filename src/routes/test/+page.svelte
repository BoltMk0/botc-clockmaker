<script lang="ts">
    import NewClockFace from "$lib/common/ClockFaces/NewClockFace/NewClockFace.svelte";
    import OldClockFace from "$lib/common/ClockFaces/OldClockFace/OldClockFace.svelte";
    import SkyDisplay from "$lib/common/ClockFaces/OldClockFace/SkyDisplay.svelte";
    import ClocktowerSillhouette from "$lib/common/ClocktowerSillhouette/ClocktowerSillhouette.svelte";
    import GodraysLayer from "$lib/common/GodraysLayer.svelte";
    import NewClocktower from "$lib/common/NewClocktower.svelte";
    import { getSkyColor } from "$lib/common/util";

    let minuteHandProgress = 0; // 0 to 1

    $: secondClockProgress = (minuteHandProgress+0.5) % 1;

    $: color = getSkyColor(minuteHandProgress);

    setInterval(()=>{
        minuteHandProgress = (minuteHandProgress + 1/10) % 1;
    }, 1000);
</script>

<div style="display: grid; grid-template-columns: 1fr 1fr; height: 100%; width: 100%; justify-items: center; gap: 20px;">
    <div style="height: 100%;  width: 100%; overflow: hidden; position: relative;">
        <SkyDisplay progress={minuteHandProgress} style=""/>
        <!-- <NewClocktower totalTime={220} timeRemaining={220*(1-minuteHandProgress)} hue={200} dayNumber={3} playerCount={10} style="top: 0; position: absolute;"/> -->
        <NewClocktower totalTime={500} timeRemaining={500*(1-minuteHandProgress)} hue={0} dayNumber={6} playerCount={8} style="top: 0; position: absolute;"/>
    </div>

    <div style="height: 100%;  width: 100%; overflow: hidden; position: relative;">
        <SkyDisplay progress={secondClockProgress} style=""/>
        <NewClocktower totalTime={120} timeRemaining={120*(1-secondClockProgress)} hue={190} dayNumber={3} playerCount={10} style="top: 0; position: absolute;"/>
        <!-- <GodraysLayer rotation={45+secondClockProgress*90}/> -->
    </div>
</div>