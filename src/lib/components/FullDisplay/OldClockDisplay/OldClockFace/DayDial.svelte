<script lang="ts">
    import { getSkyColor } from "$lib/common/util";
    import clockhand from '$lib/assets/clockhand3.png';
    
    let {
        size = 700,
        day,
        max = 12,
        progress
    }: {
        size?: number;
        day: number;
        max?: number;
        progress: number;
    } = $props();

    const rotationAngle = $derived(70 - 140 * (day / max));
    // $: rotationAngle = 0;

    const skyColor = $derived(getSkyColor(progress, 0.5));
</script>

<div class="clock-container" style="width: {size}px; height: {size / 2}px;">
    <!-- Dial that rotates from right (max) to left (min) -->
     <div class="dial-background" style="background-color: {skyColor};">
        
        <div class="dial-tick-main">
            {#each {length: max+1} as _, i}
            <div class="dial-tick-container" style="transform: rotate({(140 * (i / (max)) - 70)}deg);">
                <div class="dial-tick major" style="background-color: var(--clock-tick-color);"></div>
            </div>
            {/each}
            <div class="dial-tick-outer-rim" style="border-color: var(--clock-tick-color);"></div>
            <div class="dial-tick-inner-rim" style="border-color: var(--clock-tick-color);"></div>
        </div>

        <div class="time-display dumbledore-font">
            <div style="font-size: 0.6em; opacity: 0.7;">Day</div>
            <div style="font-size: 1.2em;">{day}</div>
        </div>
        
     </div>
    <div class="dial-container" style="transform: translate(-50%, -6.5%);">
        <div class="dial" style="transform: rotate({rotationAngle}deg);">
            <img src="{clockhand}" alt="clock hand" class="dial-needle" style="transform: rotate(90deg);"/>
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
        width: 60%;
        aspect-ratio: 1;
        left: 50%;
        bottom: 0;
    }

    .dial {
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

    .dial-tick-main {
        position: relative;
        width: 100%;
        height: 100%;
        opacity: 0.6;
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
        bottom: 5%;
        height: 5%;
        width: 1px;
        background-color: #333;
    }

    .dial-tick.major {
        height: 5%;
        width: 4px;
        background-color: #000;
    }


    .dial-tick-outer-rim {
        position: absolute;
        bottom: 5%;
        left: 2.5%;
        right: 2.5%;
        top: 0%;
        border: 1px solid #112;
        border-top: none;
        border-radius: 0 0 999em 999em;
        box-sizing: border-box;
    }

    .dial-tick-inner-rim {
        position: absolute;
        bottom: 10%;
        left: 5%;
        right: 5%;
        top: 0%;
        border: 1px solid #112;
        border-radius: 0 0 999em 999em;
        border-top: none;
        box-sizing: border-box;

    }

    .time-display {
        opacity: 0.9;
        font-size: 2em;
        text-align: center;
        color: #FED;
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        text-shadow: #1005 1px 3px 4px;
    }

</style>
