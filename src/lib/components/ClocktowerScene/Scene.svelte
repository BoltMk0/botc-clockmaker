<script lang="ts">
    import { untrack } from "svelte";
    import { useTask, useThrelte } from "@threlte/core";
    import OrthoCamera from "./subviews/OrthoCamera.svelte";
    import Sky from "./subviews/Sky.svelte";
    import Clouds from "./subviews/Clouds.svelte";
    import Sun from "./subviews/Sun.svelte";
    import Moon from "./subviews/Moon.svelte";
    import Mist from "./subviews/Mist.svelte";
    import GameStatsPanel from "./subviews/GameStatsPanel.svelte";
    import Tower from "./subviews/Tower.svelte";
    import ClockFace from "./subviews/ClockFace.svelte";
    import ClockHands from "./subviews/ClockHands.svelte";
    import OriginMarker from "./subviews/OriginMarker.svelte";
    import SceneQrCodes from "./subviews/SceneQrCodes.svelte";
    import { getPlayerCount } from "$lib/common/util";
    import type { GrimoireStateHistory } from "$lib/resources/common/grimoireState";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData";
    import type { QrCode } from "$lib/resources/server/qrCodes";

    let {
        progress,
        totalTime,
        dayNumber,
        playerCount,
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
        verticalOffset,
        mistHeightFraction,
        clockFaceImageUrl,
        clockFaceNormalMapUrl,
        hasGrim = false,
        grimoireState = null,
        script = null,
        qrCodes = []
    }: {
        progress: number;
        totalTime: number;
        dayNumber: number;
        playerCount: number;
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
        verticalOffset: number;
        mistHeightFraction: number;
        clockFaceImageUrl: string;
        clockFaceNormalMapUrl: string;
        hasGrim?: boolean;
        grimoireState?: GrimoireStateHistory | null;
        script?: ScriptWithCharacters | null;
        qrCodes?: QrCode[];
    } = $props();

    const counts = $derived(getPlayerCount(playerCount));

    // Every element's own size is a fraction of `visibleHeight`, so sizes
    // already track the screen's height only, never its width. Positioning
    // (the tower/panel's horizontal offset) is tuned for a design aspect
    // ratio of visibleHeight * DESIGN_ASPECT wide (see the `horizontalOffset`
    // notes in ClocktowerScene.svelte and GameStatsPanel.svelte) though, and
    // on narrower screens the real visible width is less than that - so the
    // fixed offset pushes the tower and panel past the actual screen edges.
    // Scaling just the offset down (never up, so normal/wide screens are
    // untouched) pulls them back toward centre - overlapping each other
    // rather than running off-screen - without touching either one's size.
    const DESIGN_ASPECT = 2;
    const { size } = useThrelte();
    const layoutScale = $derived(Math.min(1, $size.width / $size.height / DESIGN_ASPECT));
    const scaledHorizontalOffset = $derived(horizontalOffset * layoutScale);

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
<Clouds {smoothProgress} {visibleHeight} horizontalOffset={scaledHorizontalOffset} />
<Sun {smoothProgress} arcRadius={sunArcRadius} height={sunHeight} forwardDistance={sunForwardDistance} />
<Moon {smoothProgress} {visibleHeight} horizontalOffset={scaledHorizontalOffset} />
<GameStatsPanel
    day={dayNumber}
    {progress}
    {totalTime}
    {counts}
    {visibleHeight}
    horizontalOffset={scaledHorizontalOffset}
    {hasGrim}
    {grimoireState}
    {script}
    {qrCodes}
/>
<Tower {imageUrl} {normalMapUrl} {origin} {planeHeight} horizontalOffset={scaledHorizontalOffset} {verticalOffset} />
<ClockFace
    imageUrl={clockFaceImageUrl}
    normalMapUrl={clockFaceNormalMapUrl}
    towerPlaneHeight={planeHeight}
    horizontalOffset={scaledHorizontalOffset}
    {verticalOffset}
    {smoothProgress}
/>

<ClockHands
    progress={handsProgress}
    {totalTime}
    towerPlaneHeight={planeHeight}
    horizontalOffset={scaledHorizontalOffset}
    {verticalOffset}
/>

{#if showOriginMarker}
    <OriginMarker size={planeHeight} horizontalOffset={scaledHorizontalOffset} {verticalOffset} />
{/if}

<!-- Sits in front of the tower/clock face/hands but behind the day/count
     banners - see Mist.svelte's MIST_Z vs GameStatsPanel's PANEL.z. -->
<Mist {smoothProgress} {visibleHeight} heightFraction={mistHeightFraction} />

{#if qrCodes.length > 0}
    <!-- In front of both the mist (z=0.1) and the day/count banners
         (GameStatsPanel's PANEL.z=0.2), so a code always reads clearly at
         the screen edges, but still well behind the player seat tokens
         (see PlayerSeats.svelte, z~0.3) - so a seated token drawn over a
         corner occludes the code there instead of it always winning like
         the DOM overlay it replaces in this display mode. -->
    <SceneQrCodes {qrCodes} {visibleHeight} z={0.25} />
{/if}
