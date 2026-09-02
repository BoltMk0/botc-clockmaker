<script lang="ts">
    import { getSkyColor } from "$lib/common/util";
    import { appSettings } from "$lib/model/client/appSettings.svelte";

    let {
        progress,
        style=""
    }: {
        progress: number;
        style?: string;
    } = $props();

    const ROTATING_ANGLE_PADDING = 45;
    // Calculate the rotation angle (0 = right/max, 180 = left/min)
    const rotationAngle = $derived(ROTATING_ANGLE_PADDING - 90 + (180 - ROTATING_ANGLE_PADDING * 2) * (Math.min(Math.max(progress, 0), 1)));
    const sunSize = $derived(appSettings.size / 3);
    
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

    const skyColor = $derived(getSkyColor(progress));
    const sunColor = $derived(getCircleColor(progress));
</script>


<div class="clock-container" style="{style}">
    <!-- Dial that rotates from right (max) to left (min) -->
     <div class="dial-background" style="background-color: {skyColor};"></div>
     <div class="sky-display-sun-container" style="transform: rotate({rotationAngle}deg);">
        <div class="sky-display-sun" style="background-color: {sunColor}; width: {sunSize}px; height: {sunSize}px;"></div>
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
        width: 100%;
        aspect-ratio: 1;
        display: flex;
        align-items: start;
        justify-content: center;
        box-sizing:content-box;
    }

    .sky-display-sun-container {
        position: absolute;
        width: 100%;
        aspect-ratio: 1;
        transform-origin: 50% 100%;
        transition: transform 1s ease;
    }

    .sky-display-sun {
        position: absolute;
        left: 50%;
        top: 0%;
        transform: translateX(-50%);
        aspect-ratio: 1;
        border-radius: 50%;
        transform-origin: 50% 100%;
        transition: transform 1s ease, background-color 1s ease;
        filter: blur(6px);
    }

    .dial-background {
        position: absolute;
        inset: 0;
        transition: background-color 1s ease;
    }
</style>
