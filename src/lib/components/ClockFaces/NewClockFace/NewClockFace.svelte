<script lang="ts">
    import { getSkyColor } from "$lib/common/util";
    import SkyDisplay from "../OldClockFace/SkyDisplay.svelte";
    import ClockBackgroundDaylight1 from "./ClockBackgroundDaylight1.svelte";
    import ClockFace from "./ClockFace.svelte";
    import CountdownDisplay from "./CountdownDisplay.svelte";
    import DaysDisplay from "./DaysDisplay.svelte";
    import PlayerCountDisplay from "./PlayerCountDisplay.svelte";
    import { getColorForProgress } from "./util";

    export let progress: number = 0; // 0 to 1
    export let totalTime: number = 60; // in seconds
    export let hue: string|undefined = undefined;
    export let dayNumber: number = 0;
    export let style: string = "";
    export let borderColor: string|undefined = undefined;

    const windowSize = 0.85

    $: timeRemaining = Math.round(totalTime * (1-progress));
    $: minutes = timeRemaining / 60;
    $: seconds = timeRemaining % 60;


    $: skyColor = getSkyColor(progress);

</script>


<div style="position: relative; width: 100%; height: 100%; aspect-ratio: 1/1; --hue-dark: hsl(from var(--hue) h calc(s*0.25) calc(l*0.5)); {style};">
    <div style="position: absolute; inset: 0; box-shadow: 0 0 500px rgb(from var(--hue) r g b / 30%); border-radius: 50%; overflow: hidden;">
        <ClockBackgroundDaylight1 {windowSize} {progress}/>
    </div>

    {#if dayNumber > 0}
    <div style="position: absolute; top: 50%; left: 60%; transform: translateY(-50%); font-size: 1.6em;">
        <div style="display: flex; border-radius: 5px; overflow: hidden; border: 1px solid var(--hue); box-shadow: 0 0 10px #0007; color: #FFF9; transition: border-color 1s;">
            <div style="background-color: var(--hue-dark); padding: 5px; transition: background-color 1s;" class="dumbledore-font">Day</div>
            <div style="background-color: white; color: black; padding: 5px; font-family:monospace; font-size: 1.1em;">{dayNumber}</div>
        </div>
    </div>
    {/if}

    <!-- Window shadow ring -->
    <!-- <div style="position: absolute; inset: calc(({1-windowSize}/2)*100%); border-radius: 50%; box-shadow: 0 0 30px inset #0006;"></div> -->
    
    <div style="position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; pointer-events: none;">
        <ClockFace minuteHandProgress={timeRemaining/60} hourHandProgress={minutes/12} numerals {borderColor}/>
    </div>
</div>
