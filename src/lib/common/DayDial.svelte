<script lang="ts">
    import type { Readable } from "svelte/store";
    import { getSkyColor } from "./util";

    export let day_info: Readable<{ day: number; max: number }>;
    $: day = $day_info.day;
    $: max = $day_info.max;

    export let size: number = 700;

    export let clockData: Readable<{ cur: number; max: number }> | undefined = undefined;

    $: rotationAngle = 70 - 140 * (day / max);
    // $: rotationAngle = 0;

    $: timeOfDayProgress = clockData !== undefined ? ($clockData!.max > 0 ? $clockData!.cur / $clockData!.max : 0): 0;
    $: skyColor = clockData !== undefined? getSkyColor(1-timeOfDayProgress, 0.5) : '';
</script>

<div class="clock-container" style="width: {size}px; height: {size / 2}px;">
    <!-- Dial that rotates from right (max) to left (min) -->
     <div class="dial-background" style="background-color: {skyColor};">
        {#each {length: $day_info.max+1} as _, i}
            <div class="dial-tick-container" style="transform: rotate({(140 * (i / ($day_info.max)) - 70)}deg);">
                <div class="dial-tick major"></div>
            </div>
        {/each}

        <div class="time-display">
            <div style="font-size: 0.3em; opacity: 0.7;">Day</div>
            <div>{day}</div>
        </div>
        
        <!-- <div class="dial-shadow"></div> -->
        <!-- <div class="dial-center-dot" style="box-shadow: 0 0 200px {getSkyColor(1-timeOfDayProgress, 1, 3)}, 0 0 70px {getSkyColor(1-timeOfDayProgress, 0.3)} inset;"></div> -->
     </div>
    <div class="dial-container" style="transform: translate(-50%, -6.5%);">
        <div class="dial" style="transform: rotate({rotationAngle}deg);">
            <img src="/clockhand3.png" alt="clock hand" class="dial-needle" style="transform: rotate(90deg);"/>
        </div>
    </div>

</div>

<style>
    .clock-container {
        width: 100%;
        aspect-ratio: 2;
        position: relative;
    }

    .dial-background {
        box-sizing: border-box;
        background-color: rgb(114, 131, 143);
        width: 100%;
        aspect-ratio: 1 / 0.5;
        border-radius: 0 0 999em 999em;
        overflow: hidden;
        position: absolute;
        transition: background-color 1s ease;
    }

    .dial-container {
        position: relative;
        width: 70%;
        aspect-ratio: 1;
        left: 50%;
        top: 0;
    }

    .dial {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        transform-origin: 50% 7%;
        transition: transform 1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .dial-needle {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }


    .dial-tick-container {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        transform-origin: 50% 0%;
    }

    .dial-tick {
        position: absolute;
        bottom: 0%;
        height: 7%;
        width: 1.5px;
        background-color: #333;
        opacity: 0.6;
    }

    .dial-tick.major {
        height: 10%;
        width: 4px;
        background-color: #000;
    }

    .time-display {
        opacity: 0.9;
        font-size: 2em;
        font-weight: bold;
        font-family: monospace;
        text-align: center;
        color: #FED;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        top: 30%;
        text-shadow: #1005 1px 3px 4px;
    }

</style>
