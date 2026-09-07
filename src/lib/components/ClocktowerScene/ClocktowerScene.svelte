<script lang="ts">
    import * as THREE from "three";
    import { browser } from "$app/environment";
    import { Canvas } from "@threlte/core";
    import Scene from "./Scene.svelte";
    import clocktowerColor from "$lib/assets/clocktower-scene/clocktower-color.png";
    import clocktowerNormal from "$lib/assets/clocktower-scene/clocktower-normal.png";
    import clockfaceColor from "$lib/assets/clocktower-scene/clockface-color.png";
    import clockfaceNormal from "$lib/assets/clocktower-scene/clockface-normal.png";

    let {
        progress,
        // Countdown length in seconds - drives how fast the clock hands
        // sweep (they tick once per real minute of countdown, same as the
        // 2D clocktower display), independent of `progress` alone.
        totalTime = 60,
        imageUrl = clocktowerColor,
        normalMapUrl = clocktowerNormal,
        clockFaceImageUrl = clockfaceColor,
        clockFaceNormalMapUrl = clockfaceNormal,
        // Normalized (0-1) position of the clock's center within the image,
        // (0,0) = top-left, (1,1) = bottom-right. This point is always kept
        // centered on screen and is what the camera stays focused on as the
        // image is cropped/zoomed. Placeholder art estimate - retune once the
        // final asset is in.
        origin = { x: 0.499, y: 0.506 },
        // How much of the image's vertical extent is visible on screen: a
        // fraction of `planeHeight`. Smaller = more cropped/zoomed in.
        visibleHeight = 5,
        // World-space height the full image is scaled to. Only matters
        // relative to visibleHeight/sun tuning; the default of 10 is arbitrary.
        planeHeight = 10,
        // Scaled off the visible crop (not the full image scale) so the sun
        // actually stays on screen through its arc, the same fix the moon
        // needed - `planeHeight` is the wrong unit here since it can be much
        // larger than what's actually in view.
        sunArcRadius = visibleHeight * 0.35,
        // Raised and brought in a bit from the earlier low, distant angle:
        // steeper incidence means the flat facade catches less flat/frontal
        // light while the normal map's carved relief picks up stronger
        // highlights and shadows, without the tower going unlit (the ambient
        // fill in Sky.svelte covers that).
        sunHeight = visibleHeight * 0.15,
        sunForwardDistance = planeHeight * 0.6,
        // Pushes the tower (and the moon, which stays anchored to it) off
        // dead-center - the screen is thought of as 5 equal vertical
        // strips, with the tower centered in strip 4 (leaving 2 and 3 free
        // for UI/text), leaving the sun's own full-width arc and the camera
        // framing untouched. Strip 4 of 5 spans 60%-80% of the width, so its
        // center sits 20% of the full width right of dead-center.
        horizontalOffset = visibleHeight * 0.4,
        showOriginMarker = false,
        // Testing aid: a slider pinned to the bottom of the scene that drives
        // `progress` directly, so the full day/night cycle can be scrubbed
        // by hand instead of waiting on (or faking) a real countdown.
        showProgressSlider = false,
        style = ""
    }: {
        progress: number;
        totalTime?: number;
        imageUrl?: string;
        normalMapUrl?: string;
        clockFaceImageUrl?: string;
        clockFaceNormalMapUrl?: string;
        origin?: { x: number; y: number };
        visibleHeight?: number;
        planeHeight?: number;
        sunArcRadius?: number;
        sunHeight?: number;
        sunForwardDistance?: number;
        horizontalOffset?: number;
        showOriginMarker?: boolean;
        showProgressSlider?: boolean;
        style?: string;
    } = $props();

    // null = follow the real `progress` prop; a number = manual override
    // from the slider below, until "Live" is pressed to hand control back.
    let manualProgress: number | null = $state(null);
    const effectiveProgress = $derived(manualProgress ?? progress);
</script>

<div style="position: relative; width: 100%; height: 100%; {style}">
    {#if browser}
        <Canvas
            createRenderer={(canvas) => {
                const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
                renderer.setClearColor(0x000000, 0);
                return renderer;
            }}
            toneMapping={THREE.NoToneMapping}
        >
            <Scene
                progress={effectiveProgress}
                {totalTime}
                {imageUrl}
                {normalMapUrl}
                {clockFaceImageUrl}
                {clockFaceNormalMapUrl}
                {origin}
                {visibleHeight}
                {planeHeight}
                {sunArcRadius}
                {sunHeight}
                {sunForwardDistance}
                {horizontalOffset}
                {showOriginMarker}
            />
        </Canvas>
    {/if}

    {#if showProgressSlider}
        <div
            style="position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 10px;
                   padding: 8px 14px; background: rgba(0, 0, 0, 0.65); color: #fff; font: 12px monospace;
                   z-index: 10; box-sizing: border-box;"
        >
            <span>progress</span>
            <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={effectiveProgress}
                oninput={(e) => (manualProgress = parseFloat(e.currentTarget.value))}
                style="flex: 1;"
            />
            <span style="width: 4.5em; text-align: right;">{effectiveProgress.toFixed(3)}</span>
            <button
                type="button"
                disabled={manualProgress === null}
                onclick={() => (manualProgress = null)}
                style="font: inherit; cursor: pointer;"
            >
                Live
            </button>
        </div>
    {/if}
</div>
