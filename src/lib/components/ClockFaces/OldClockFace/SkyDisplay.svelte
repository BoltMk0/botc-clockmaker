<script lang="ts">
    import { getSkyColor } from "$lib/common/util";

    export let progress: number;
    export let style: string = "";

    const ROTATING_ANGLE_PADDING = -30;
    // Calculate the rotation angle (0 = right/max, 180 = left/min)
    $: rotationAngle = 90 - ROTATING_ANGLE_PADDING - (180 - ROTATING_ANGLE_PADDING * 2) * (Math.min(Math.max(progress, 0), 1));
    
    
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
</script>


<div class="clock-container" style="{style}">
    <!-- Dial that rotates from right (max) to left (min) -->
     <div class="dial-background" style="background-color: {getSkyColor(progress)};">

        <div class="dial-sun-container">
            <div class="dial-sun" style="transform: rotate({-rotationAngle*0.4}deg); background-color: {getCircleColor(progress)}"></div>
        </div>
     </div>
</div>

<style>
    .clock-container {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .dial-sun-container {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        aspect-ratio: 1.5/1;
        top: -15%;
        display: flex;
        align-items: start;
        justify-content: center;
        box-sizing:content-box;
    }

    .dial-sun {
        height: 60%;
        aspect-ratio: 1;
        border-radius: 50%;
        transform-origin: 50% 300%;
        transition: transform 1s ease, background-color 1s ease;
        margin-top: 5px;
        filter: blur(10px);
    }

    .dial-background {
        width: 100%;
        height: 100%;
        position: absolute;
        transition: background-color 1s ease;
    }
</style>
