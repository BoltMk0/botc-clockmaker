<script lang="ts">
    import {formatTime, getSkyColor} from "$lib/common/util";
    import type { Readable } from "svelte/store";

    export let clock_info: Readable<{cur: number; max: number}>;
    export let size: number = 700;

    $: rounded_cur = Math.round($clock_info.cur);

    // Calculate the rotation angle (0 = right/max, 180 = left/min)
    $: rotationAngle = $clock_info.max > 0 ? 80-160 * (1 - rounded_cur / $clock_info.max) : -80;
    
    // Calculate position (0 to 1, where 0 is left and 1 is right)
    $: progress = $clock_info.max > 0 ? 1 - rounded_cur / $clock_info.max : 1;
    
    // Calculate color interpolation from blue to orange
    $: colorHue = 200 - (progress * 180); // 200 (blue) to 20 (orange)
    function getCircleColor(progress: number): string {
        if(progress >= 1){
            return "#F00"
        }
        // Adjust progress to range [0,1] with emphasis on extremes
        let adj_progress = Math.min(Math.max(progress, 0.5), 1)*2-1;
        let saturation = 80;
        const hue = 40-(adj_progress**2)*30;
        return `hsl(${hue}, ${saturation}%, 60%)`;
    }

    let ticks = 41;
    let majorTicks = 5;

</script>

<div class="clock-container" style="width: {size}px; height: {size/2}px;">
    <!-- Dial that rotates from right (max) to left (min) -->
     <div class="dial-background" style="background-color: {getSkyColor(progress)}; box-shadow: 0 0 500px {getSkyColor(progress, 0.6)}, 0 30px 50px black;">
        

        <div class="dial-sun-container">
            <div class="dial-sun" style="transform: rotate({-rotationAngle*0.4}deg); background-color: {getCircleColor(progress)}"></div>
        </div>
        
        <div class="dial-tick-main">
            {#each {length: ticks} as _, i}
                {@const angle = (80-160 * (i / (ticks - 1)))}
                <div class="dial-tick-container" style="transform: rotate({angle}deg);">
                    <div class="dial-tick"></div>
                </div>
            {/each}



            {#each {length: majorTicks} as _, i}
                {@const angle = (80-160 * (i / (majorTicks - 1)))}
                <div class="dial-tick-container" style="transform: rotate({angle}deg);">
                    <div class="dial-tick major"></div>
                </div>
            {/each}

            <div class="dial-tick-outer-rim"></div>
            <div class="dial-tick-inner-rim"></div>

        </div>



        <div class="time-display">
            <div style="font-size: 0.4em; opacity: 0.7;">Time Remaining</div>
            <div>{formatTime($clock_info.cur)}</div>
        </div>
        
        <!-- <div class="dial-shadow"></div> -->

     </div>
    <div class="dial-container" style="transform: translate(-50%, 6.5%);">
        <div class="dial" style="transform: rotate({rotationAngle}deg);">
            <img src="/clockhand.png" alt="clock hand" class="dial-needle" style="transform: rotate(-90deg);"/>
        </div>
    </div>
</div>

<style>
    .clock-container {
        width: 100%;
        margin: 0 auto;
        position: relative;
    }

    .dial-sun-container {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        height: 100%;
        display: flex;
        align-items: start;
        justify-content: center;
        box-sizing:content-box;
    }

    .dial-sun {
        height: 60%;
        aspect-ratio: 1;
        background-color: red;
        border-radius: 50%;
        transform-origin: 50% 300%;
        transition: transform 1s ease, background-color 1s ease;
        margin-top: 5px;
    }

    .dial-background {
        box-sizing: border-box;
        background-color: rgb(114, 131, 143);
        width: 100%;
        aspect-ratio: 1/0.5;
        overflow: hidden;
        border-radius: 999em 999em 0 0;
        position: absolute;
        transition: background-color 1s ease;
    }

    .dial-container {
        position: relative;
        width: 54%;
        aspect-ratio: 1;
        left: 50%;
        bottom: 0;
        top: -8%;
    }

    .dial {
        width: 100%;
        height: 100%;
        transform-origin: 50% 93%;
        transition: transform 1s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .dial-needle {
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0.9;
    }

    .dial-tick-main {
        position: relative;
        width: 100%;
        height: 100%;
        opacity: 0.6;
    }

    .dial-tick-outer-rim {
        position: absolute;
        top: 5%;
        left: 2.5%;
        right: 2.5%;
        bottom: 0%;
        border: 1px solid #112;
        border-bottom: none;
        border-radius: 999em 999em 0 0;
        box-sizing: border-box;
    }
    .dial-tick-inner-rim {
        position: absolute;
        top: 10%;
        left: 5%;
        right: 5%;
        bottom: 0%;
        border: 1px solid #112;
        border-radius: 999em 999em 0 0;
        border-bottom: none;
        box-sizing: border-box;

    }

    .dial-tick-container {
        position: absolute;
        height: 95%;
        left: 50%;
        bottom: 0;
        width: 0;
        transform-origin: 50% 100%;
        /* width: 2px; */
    }

    .dial-tick {
        position: absolute;
        height: 5%;
        width: 1px;
        background-color: #112;
        transform: translateX(-50%);
    }

    .dial-tick.major {
        width: 4px;
        background-color: #000;
    }

    .time-display {
        font-size: 1.7em;
        font-weight: bold;
        font-family: monospace;
        text-align: center;
        color: #0009;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        top: 30%;
        text-shadow: #1005 1px 3px 4px;
    }

</style>
