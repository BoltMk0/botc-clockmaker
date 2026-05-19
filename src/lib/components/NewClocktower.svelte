<script lang="ts">
    import { getSkyColor } from "$lib/common/util";
    import CountdownDisplay from "./ClockFaces/NewClockFace/CountdownDisplay.svelte";
    import NewClockFace from "./ClockFaces/NewClockFace/NewClockFace.svelte";
    import PlayerCountDisplay from "./ClockFaces/NewClockFace/PlayerCountDisplay.svelte";
    import Bunting from "./ClocktowerSillhouette/Bunting.svelte";
    import ClocktowerSillhouette from "./ClocktowerSillhouette/ClocktowerSillhouette.svelte";

    export let totalTime: number = 120; // seconds
    export let timeRemaining: number = 120; // seconds

    export let hue: number = 200;
    export let dayNumber: number = 0;
    export let playerCount: number = 10;

    export let size = 700;

    export let style: string = "";

    const BUNTING_DENSITY = 0.6;
    const BUNTING_OPACITY = 0.8;
    const BUNTING_HEIGHT_RATIO = 1/20;

    const BUNTING_ROTATION_BASE = 7;
    const BUNTIN_ROTATION_RANGE = 1;
    
    const BUNTING_BASE_SATURATION = 60;
    const BUNTING_BASE_LIGHTNESS = 40;

    $: progress = 1 - timeRemaining / totalTime;

    $: clocktowerColorBase = getSkyColor(progress, 1, 1.5, 0.25);

</script>

<style>
    .clocktower-main {
        position: absolute;
        width: 100%;
        height: 100%;
        left: 50%;
        transform: translateX(-50%);
        bottom: 0;
    }   

    .clocktower-main>*{
        position: absolute;
    }
</style>
<div style="position: relative; width: 100%; height: 100%; bottom: 0; --clocktower-color-base: {clocktowerColorBase}; {style}; --clocktower-color-highlight: hsl(from var(--clocktower-color-base) calc(h + 20) calc(s*1.2) 70% / 0.1);">
    
    <Bunting color={`hsl(${hue}, ${BUNTING_BASE_SATURATION}%, ${BUNTING_BASE_LIGHTNESS}%)`} width={"60%"} height={size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={-(BUNTING_ROTATION_BASE + Math.random() * BUNTIN_ROTATION_RANGE)} style="position: absolute; top: 77%; left: -10%; transform-origin: 100% 100%; opacity: {BUNTING_OPACITY}"/>
    <Bunting color={`hsl(${hue}, ${BUNTING_BASE_SATURATION}%, ${BUNTING_BASE_LIGHTNESS}%)`} width={"60%"} height={size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={-(BUNTING_ROTATION_BASE * 1.5 + Math.random() * BUNTIN_ROTATION_RANGE)} style="position: absolute; top: 33%; left: -10%; transform-origin: 100% 100%; opacity: {BUNTING_OPACITY}"/>

    <Bunting color={`hsl(${hue}, ${BUNTING_BASE_SATURATION}%, ${BUNTING_BASE_LIGHTNESS}%)`} width={"60%"} height={size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={BUNTING_ROTATION_BASE + Math.random() * BUNTIN_ROTATION_RANGE} style="position: absolute; top: 76%; right: -10%; transform-origin: 0% 100%; opacity: {BUNTING_OPACITY}"/>
    <Bunting color={`hsl(${hue}, ${BUNTING_BASE_SATURATION}%, ${BUNTING_BASE_LIGHTNESS}%)`} width={"60%"} height={size * BUNTING_HEIGHT_RATIO} density={BUNTING_DENSITY} rotation={BUNTING_ROTATION_BASE * 1.5 + Math.random() * BUNTIN_ROTATION_RANGE} style="position: absolute; top: 34%; right: -10%; transform-origin: 0% 100%; opacity: {BUNTING_OPACITY}"/>

    <div class="clocktower-main" style="--sky-color: {getSkyColor(progress)}; --hue: var(--sky-color); width: {size}px; height: {size*1.5}px;">
        <ClocktowerSillhouette style="--clocktower-color-highlight: hsl({hue}, 60%, 80%, 15%);"/>
        <div style="top: 48%; width: 55%; left: 50%; transform: translate(-50%, -50%); padding: {size/5}px; font-size: 0.8em;">
            <NewClockFace totalTime={totalTime} progress={progress} dayNumber={dayNumber} style="border: 10px solid hsl({hue}, 60%, 50%); border-radius: 50%; box-sizing: border-box; transition: border 1s;"/>
        </div>

        <div style="top: 71%; width: 44%; margin: 0 28%; font-size: 1em;">
            <CountdownDisplay progress={progress} {timeRemaining}/>
        </div>
        <div style="top: 14%; width: 26%; margin: 0 37%; font-size: 0.8em;">
            <PlayerCountDisplay numPlayers={playerCount} style="--hue: var(--clocktower-color-highlight); --hue-dark: var(--clocktower-color-base);"/>
        </div>
    </div>
</div>