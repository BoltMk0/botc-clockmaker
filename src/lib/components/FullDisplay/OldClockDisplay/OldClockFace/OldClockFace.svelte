<script lang="ts">
    import { getSkyColor } from "$lib/common/util";
    import ClockDisplay from "./ClockDisplay.svelte";
    import DayDial from "./DayDial.svelte";

    let {
        hue = 200,
        size = 700,
        progress,
        totalTime = 800,
        dayNumber = undefined,
        style = ""
    }: {
        hue?: number;
        size?: number;
        progress: number;
        totalTime?: number|undefined;
        dayNumber?: number|undefined;
        style?: string;
    } = $props();

    const border_thickness = $derived(size/30);

    const skyColor = $derived(getSkyColor(progress, 1, 1, 1));

    const borderColor = $derived(`hsl(${hue}, 60%, 40%)`);
</script>

<div style="--clock-tick-color: #0009; font-size:{size/15}px; position: relative; width: {size-border_thickness*2}px; height: {size-border_thickness*2}px; border-radius: 50%; border: {border_thickness}px solid {borderColor}; {style}">
    <ClockDisplay progress={progress} timeRemaining={totalTime? Math.round(totalTime*(1-progress)) : 0} size={size-border_thickness*2} onTimeShift={undefined}/>
    <DayDial size={size-border_thickness*2} day={dayNumber ?? 0} {progress}/>
    <div style="position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 {border_thickness}px 0px black inset, 0 0 20px {skyColor};"></div>
    <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: {border_thickness*3}px; aspect-ratio: 1/1; border-radius: 50%; background-color: hsl({hue}, 55%, 30%); box-shadow: 0 0 10px {skyColor} inset;"></div>
</div>
