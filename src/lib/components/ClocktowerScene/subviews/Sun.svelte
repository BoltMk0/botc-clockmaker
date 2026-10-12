<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";
    import { parseCssColor } from "$lib/common/util";
    import { getSceneSunColor } from "../sceneColors";

    let {
        smoothProgress,
        arcRadius,
        height,
        forwardDistance
    }: {
        smoothProgress: number;
        arcRadius: number;
        height: number;
        forwardDistance: number;
    } = $props();

    // A single curved path (quadratic Bezier) rather than a simple circular
    // arc: starts on screen far to the left, bows way up above the tower -
    // out of frame at the top for the whole of midday - then comes back down
    // through frame on the right before continuing on, off the bottom of the
    // screen, for night. `arcRadius` doubles as the "half the visible frame"
    // scale unit here (it's set to roughly that by the caller).
    const p = $derived(Math.min(Math.max(smoothProgress, 0), 1));

    function bezier(t: number, p0: number, p1: number, p2: number) {
        const oneMinusT = 1 - t;
        return oneMinusT * oneMinusT * p0 + 2 * oneMinusT * t * p1 + t * t * p2;
    }

    const START_X = -1.5;
    const START_Y = -0.5;
    const CONTROL_X = 0;
    const CONTROL_Y = 4;
    const END_X = 2.3;
    const END_Y = -2;

    const x = $derived(arcRadius * bezier(p, START_X, CONTROL_X, END_X));
    const y = $derived(height + arcRadius * bezier(p, START_Y, CONTROL_Y, END_Y));
    const z = $derived(forwardDistance);

    function colorToRgb01(css: string): [number, number, number] {
        const { r, g, b } = parseCssColor(css);
        return [r / 255, g / 255, b / 255];
    }

    const colorRgb = $derived(colorToRgb01(getSceneSunColor(smoothProgress)));

    // Real daylight stays close to full strength for most of the day -
    // morning and evening sun are still bright - it's only in the final
    // stretch, as the sun nears the horizon, that it fades out. A separate
    // curve from `getSceneSkyBrightness` (the scene's overall mood/ambient
    // fade) even though the shape rhymes, so the sun's own falloff point and
    // steepness can be tuned independently of it.
    const FADE_START = 0.9;
    const fadeAmount = $derived(Math.min(Math.max((p - FADE_START) / (1 - FADE_START), 0), 1));
    const sunBrightness = $derived(1 - fadeAmount * fadeAmount * (3 - 2 * fadeAmount));

    // A soft, feathered halo around the sun, same technique as the moon's
    // mist halo - a radial-gradient canvas (opaque-ish center fading
    // smoothly to fully transparent) rather than a hard-edged glow circle.
    const HALO_TEXTURE_SIZE = 128;
    const haloCanvas: HTMLCanvasElement = document.createElement("canvas");
    haloCanvas.width = HALO_TEXTURE_SIZE;
    haloCanvas.height = HALO_TEXTURE_SIZE;
    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    haloTexture.colorSpace = THREE.SRGBColorSpace;
    haloTexture.generateMipmaps = false;
    haloTexture.minFilter = THREE.LinearFilter;
    haloTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        const ctx = haloCanvas.getContext("2d");
        if (!ctx) return;
        const [r255, g255, b255] = colorRgb.map((c) => Math.round(c * 255));
        const center = HALO_TEXTURE_SIZE / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${r255}, ${g255}, ${b255}, 0.55)`);
        gradient.addColorStop(0.35, `rgba(${r255}, ${g255}, ${b255}, 0.25)`);
        gradient.addColorStop(1, `rgba(${r255}, ${g255}, ${b255}, 0)`);
        ctx.clearRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        haloTexture.needsUpdate = true;
    });
</script>

<!-- A directional light for real shading across the tower's normal map, plus
     a small emissive disc so it's visible in the shot as it arcs overhead. -->
<!-- No floor on intensity/opacity: once the sun has set (sunBrightness -> 0)
     it should contribute no light and not be visible at all, not linger as a
     dim colored lamp. -->
<T.DirectionalLight
    position={[x, y, z]}
    intensity={sunBrightness * 5}
    color={new THREE.Color().setRGB(...colorRgb, THREE.SRGBColorSpace)}
/>

<T.Mesh position={[x, y, -0.001]}>
    <T.CircleGeometry args={[arcRadius * 0.15, 32]} />
    <T.MeshBasicMaterial
        color={new THREE.Color().setRGB(...colorRgb, THREE.SRGBColorSpace)}
        transparent
        opacity={sunBrightness * 0.3}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
    />
</T.Mesh>

<T.Mesh position={[x, y, - 0.002]}>
    <T.PlaneGeometry args={[arcRadius * 1.2, arcRadius * 1.2]} />
    <T.MeshBasicMaterial
        map={haloTexture}
        transparent
        opacity={sunBrightness}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
    />
</T.Mesh>
