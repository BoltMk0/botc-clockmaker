<script lang="ts">
    import { getSkyColor } from "$lib/common/util";
    import { getNewClocktowerThemeContext } from "$lib/components/FullDisplay/NewClocktowerDisplay/model/theme";
    import ClockBackgroundDaylight1 from "./ClockBackgroundDaylight1.svelte";
    import ClockBackgroundWhite from "./ClockBackgroundWhite.svelte";
    import ClockFace from "./ClockFace.svelte";

    let {
        progress = 0, // 0 to 1
        totalTime = 60, // in seconds
        dayNumber = 0,
        style = "",
    }: {
        progress?: number;
        totalTime?: number;
        dayNumber?: number;
        style?: string;
    } = $props();

    const windowSize = 0.85

    const theme = getNewClocktowerThemeContext();

    const timeRemaining = $derived(Math.round(totalTime * (1-progress)));
    const minutes = $derived(timeRemaining / 60);
    const seconds = $derived(timeRemaining % 60);

    const skyColor = $derived(getSkyColor(progress));

</script>


<div style="position: relative; width: 100%; height: 100%; aspect-ratio: 1/1; {style};">
    <div style="position: absolute; inset: 0; border-radius: 50%;">
        <ClockBackgroundWhite {windowSize} {progress}/>
    </div>

    {#if dayNumber > 0}
    <div style="position: absolute; top: 50%; left: 60%; transform: translateY(-50%); font-size: 1.6em;">
        <div style="display: flex; border-radius: 5px; border: 1px solid {theme.clockfaceColorHighlight}; box-shadow: 0 0 10px #0007; color: #FFF9; transition: border-color 1s;">
            <div style="background-color: {theme.clockfaceColorSecondary}; padding: 3px 5px; transition: background-color 1s; display: flex; justify-content: center; align-items: center;" class="dumbledore-font">Day</div>
            <div style="background-color: white; color: black; padding: 3px 5px; font-family:monospace; font-size: 1.1em;">{dayNumber}</div>
        </div>
    </div>
    {/if}

    <div style="position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; pointer-events: none;">
        <ClockFace minuteHandProgress={timeRemaining/60} hourHandProgress={minutes/12} numerals/>
    </div>
</div>
