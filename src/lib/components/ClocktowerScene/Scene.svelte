<script lang="ts">
    import { untrack } from "svelte";
    import { useTask } from "@threlte/core";
    import OrthoCamera from "./subviews/OrthoCamera.svelte";
    import Sky from "./subviews/Sky.svelte";
    import Clouds from "./subviews/Clouds.svelte";
    import Sun from "./subviews/Sun.svelte";
    import Moon from "./subviews/Moon.svelte";
    import TextBanner from "./subviews/TextBanner.svelte";
    import Tower from "./subviews/Tower.svelte";
    import ClockFace from "./subviews/ClockFace.svelte";
    import ClockHands from "./subviews/ClockHands.svelte";
    import OriginMarker from "./subviews/OriginMarker.svelte";

    let {
        progress,
        totalTime,
        imageUrl,
        normalMapUrl,
        origin,
        visibleHeight,
        planeHeight,
        sunArcRadius,
        sunHeight,
        sunForwardDistance,
        showOriginMarker,
        horizontalOffset,
        clockFaceImageUrl,
        clockFaceNormalMapUrl
    }: {
        progress: number;
        totalTime: number;
        imageUrl: string;
        normalMapUrl: string;
        origin: { x: number; y: number };
        visibleHeight: number;
        planeHeight: number;
        sunArcRadius: number;
        sunHeight: number;
        sunForwardDistance: number;
        showOriginMarker: boolean;
        horizontalOffset: number;
        clockFaceImageUrl: string;
        clockFaceNormalMapUrl: string;
    } = $props();

    // Smooth the day-progress value over time instead of snapping the sun
    // (and everything timed off it) straight to a new position whenever
    // `progress` ticks. Computed once here and shared, so the sun and moon
    // never drift out of sync with each other.
    let smoothProgress = $state(untrack(() => progress));
    // The clock hands chase the target about twice as fast as the sky/sun/
    // moon, so a jump in `progress` reads back on the dial quickly while the
    // rest of the scene still eases across gently. Same exponential smoothing,
    // just a higher rate constant (~0.33s settling vs ~0.67s).
    let handsProgress = $state(untrack(() => progress));
    useTask((delta) => {
        // Re-seed instantly on large jumps (e.g. switching clocks / resetting)
        // instead of animating across the whole dial.
        if (Math.abs(progress - smoothProgress) > 0.5) {
            smoothProgress = progress;
        } else {
            smoothProgress += (progress - smoothProgress) * Math.min(1, delta * 1.5);
        }

        if (Math.abs(progress - handsProgress) > 0.5) {
            handsProgress = progress;
        } else {
            handsProgress += (progress - handsProgress) * Math.min(1, delta * 10);
        }
    });
</script>

<OrthoCamera {visibleHeight} />
<Sky {smoothProgress} />
<Clouds {smoothProgress} {visibleHeight} {horizontalOffset} />
<Sun {smoothProgress} arcRadius={sunArcRadius} height={sunHeight} forwardDistance={sunForwardDistance} />
<Moon {smoothProgress} {visibleHeight} {horizontalOffset} />
<TextBanner content="Day 4" {visibleHeight} />
<Tower {imageUrl} {normalMapUrl} {origin} {planeHeight} {horizontalOffset} />
<ClockFace
    imageUrl={clockFaceImageUrl}
    normalMapUrl={clockFaceNormalMapUrl}
    towerPlaneHeight={planeHeight}
    {horizontalOffset}
    {smoothProgress}
/>
<ClockHands progress={handsProgress} {totalTime} towerPlaneHeight={planeHeight} {horizontalOffset} />

{#if showOriginMarker}
    <OriginMarker size={planeHeight} {horizontalOffset} />
{/if}
