<script lang="ts">
    import clocktowerSillhouette from "$lib/assets/clocktower.sillhouette.png";
    import CountdownDisplay from "./ClockFaces/NewClockFace/CountdownDisplay.svelte";
    import DaysDisplay from "./ClockFaces/NewClockFace/DaysDisplay.svelte";
    import NewClockFace from "./ClockFaces/NewClockFace/NewClockFace.svelte";
    import PlayerCountDisplay from "./ClockFaces/NewClockFace/PlayerCountDisplay.svelte";
    import Bunting from "./ClocktowerSillhouette/Bunting.svelte";
    import ClocktowerSillhouette from "./ClocktowerSillhouette/ClocktowerSillhouette.svelte";
    import { getSkyColor } from "./util";

    export let totalTime: number = 120; // seconds
    export let timeRemaining: number = 120; // seconds

    export let hue: number = 200;
    export let dayNumber: number = 0;
    export let playerCount: number = 10;

    export let size = 700;

    export let style: string = "";

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
        top: 0;
    }   

    .clocktower-main>*{
        position: absolute;
    }

    .sillhouette {
        pointer-events: none;
        object-fit:contain;
        /* opacity: 0.8; */
    }
</style>
<div style="position: relative; width: 100%; height: 100%; bottom: 0; --clocktower-color-base: {clocktowerColorBase}; {style}; --clocktower-color-highlight: hsl(from var(--clocktower-color-base) calc(h + 20) calc(s*1.2) 70% / 0.1);">
    
    <Bunting color={`hsl(${hue}, 50%, 50%)`} width={"45%"} height={"5%"} numBunting={5} rotation={-18} style="position: absolute; top: 77%; left: -5%;"/>
    <Bunting color={`hsl(${hue}, 50%, 50%)`} width={"40%"} height={"5%"} numBunting={4} rotation={-20} style="position: absolute; top: 33%; left: -5%;"/>

    <Bunting color={`hsl(${hue}, 50%, 50%)`} width={"45%"} height={"5%"} numBunting={5} rotation={17} style="position: absolute; top: 76%; right: -7%;"/>
    <Bunting color={`hsl(${hue}, 50%, 50%)`} width={"40%"} height={"5%"} numBunting={4} rotation={21} style="position: absolute; top: 34%; right: -7%;"/>

    <div class="clocktower-main" style="--sky-color: {getSkyColor(progress)}; --hue: var(--sky-color); width: {size}px; height: {size*1.5}px;">
        <ClocktowerSillhouette/>
        <div style="top: 48%; width: 52%; left: 50%; transform: translate(-50%, -50%); padding: {size/5}px; font-size: 0.8em;">
            <NewClockFace totalTime={totalTime} progress={progress} dayNumber={dayNumber} playerCount={playerCount}/>
        </div>

        <div style="top: 71%; width: 44%; margin: 0 28%; font-size: 1em;">
            <CountdownDisplay progress={progress} {timeRemaining}/>
        </div>
        <div style="top: 14%; width: 26%; margin: 0 37%; font-size: 0.8em;">
            <PlayerCountDisplay numPlayers={playerCount} style="--hue: var(--clocktower-color-highlight); --hue-dark: var(--clocktower-color-base);"/>
        </div>
    </div>
</div>