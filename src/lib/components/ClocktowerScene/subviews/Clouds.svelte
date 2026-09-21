<script lang="ts">
    import * as THREE from "three";
    import { T, useTask } from "@threlte/core";
    import { parseCssColor } from "$lib/common/util";
    import {
        mixRgb,
        getSceneSkyColor,
        getSceneSunColor,
        getSceneSkyBrightness,
        MOON_GLOW_COLOR
    } from "../sceneColors";
    import { fillBlurredCircle } from "../canvasBlur";

    let {
        smoothProgress,
        visibleHeight,
        horizontalOffset
    }: {
        smoothProgress: number;
        visibleHeight: number;
        horizontalOffset: number;
    } = $props();

    // Clouds sit behind the tower (z=0) but in front of the moon (which
    // rides at z = -visibleHeight * 0.6), so drifting clouds pass across
    // and partly occlude the blood moon rather than slipping behind it.
    // Orthographic projection means world-space size doesn't change with
    // depth, so this z only sets draw order / layering, not scale; the
    // parallax feel comes from giving clouds varied drift speeds instead.
    const CLOUD_Z = $derived(-visibleHeight * 0.4);

    // How far a cloud travels before wrapping back to the start. Sized off
    // the visible crop (like the sun and moon) so the band always overshoots
    // the screen edges regardless of zoom, and clouds pop in/out off-frame.
    const TRAVEL_WIDTH = $derived(visibleHeight * 8);

    // A single cloud sprite, drawn once: a row of overlapping solid white
    // discs (flattish along the base, lumpy across the top) run through a
    // heavy canvas blur so the silhouette reads as soft billows rather than
    // a bumpy outline, then given a faint bluish underside shade for depth.
    // Every disc is kept well inside the canvas with margin to spare so the
    // sprite always fades to nothing before the plane's edge - no hard clip.
    const TEX_W = 512;
    const TEX_H = 256;
    const BLUR = TEX_H * 0.06;
    const cloudCanvas: HTMLCanvasElement = document.createElement("canvas");
    cloudCanvas.width = TEX_W;
    cloudCanvas.height = TEX_H;
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.generateMipmaps = false;
    cloudTexture.minFilter = THREE.LinearFilter;
    cloudTexture.magFilter = THREE.LinearFilter;

    {
        const ctx = cloudCanvas.getContext("2d");
        if (ctx) {
            // cx as a fraction of width; cy and r as fractions of height.
            const discs = [
                { x: 0.5, y: 0.58, r: 0.3 },
                { x: 0.35, y: 0.62, r: 0.24 },
                { x: 0.65, y: 0.62, r: 0.24 },
                { x: 0.22, y: 0.66, r: 0.17 },
                { x: 0.78, y: 0.66, r: 0.17 },
                { x: 0.44, y: 0.42, r: 0.2 },
                { x: 0.6, y: 0.4, r: 0.18 },
                { x: 0.5, y: 0.52, r: 0.24 }
            ];
            for (const d of discs) {
                fillBlurredCircle(ctx, d.x * TEX_W, d.y * TEX_H, d.r * TEX_H, BLUR, "#ffffff");
            }

            // Bluish shade toward the underside, clipped to the cloud body
            // (source-atop) so only the billows pick it up, not the whole
            // canvas - gives the flat sprite a bit of top-lit volume.
            ctx.globalCompositeOperation = "source-atop";
            const shade = ctx.createLinearGradient(0, TEX_H * 0.38, 0, TEX_H * 0.86);
            shade.addColorStop(0, "rgba(150, 160, 185, 0)");
            shade.addColorStop(1, "rgba(120, 132, 160, 0.4)");
            ctx.fillStyle = shade;
            ctx.fillRect(0, 0, TEX_W, TEX_H);
            ctx.globalCompositeOperation = "source-over";

            cloudTexture.needsUpdate = true;
        }
    }

    const CLOUD_ASPECT = TEX_W / TEX_H;

    // Fixed layout so the sky doesn't reshuffle on every reload. `x` is a
    // fraction of `TRAVEL_WIDTH` from its left edge; `y` is a fraction of the
    // visible frame height measured from the top (kept in the upper band so
    // clouds stay in the sky above the tower); `height` is a fraction of the
    // visible frame height; `speed` is in visibleHeight-units per second.
    // `flip` mirrors the sprite horizontally so they don't read as one
    // shape repeated. `speed` is deliberately gentle - a slow, lazy drift.
    const CLOUD_DEFS = [
        { x: 0.02, y: 0.15, height: 0.62, speed: 0.06, opacity: 0.85, flip: false },
        { x: 0.14, y: 0.34, height: 0.4, speed: 0.1, opacity: 0.62, flip: true },
        { x: 0.25, y: 0.09, height: 0.78, speed: 0.045, opacity: 0.9, flip: false },
        { x: 0.34, y: 0.27, height: 0.5, speed: 0.08, opacity: 0.74, flip: true },
        { x: 0.44, y: 0.12, height: 0.56, speed: 0.055, opacity: 0.83, flip: false },
        { x: 0.53, y: 0.4, height: 0.32, speed: 0.12, opacity: 0.52, flip: true },
        { x: 0.62, y: 0.19, height: 0.68, speed: 0.05, opacity: 0.88, flip: false },
        { x: 0.71, y: 0.33, height: 0.44, speed: 0.09, opacity: 0.65, flip: true },
        { x: 0.8, y: 0.1, height: 0.6, speed: 0.05, opacity: 0.83, flip: false },
        { x: 0.88, y: 0.28, height: 0.46, speed: 0.075, opacity: 0.71, flip: true },
        { x: 0.95, y: 0.16, height: 0.54, speed: 0.06, opacity: 0.78, flip: false }
    ];

    // Live x-offsets (world units, before centring), advanced each frame and
    // wrapped. Kept as its own $state array so mutating an entry re-renders
    // just that cloud's mesh.
    let offsets = $state(CLOUD_DEFS.map((c) => c.x * (visibleHeight * 8)));

    useTask((delta) => {
        const width = TRAVEL_WIDTH;
        for (let i = 0; i < CLOUD_DEFS.length; i++) {
            let next = offsets[i] + CLOUD_DEFS[i].speed * visibleHeight * delta;
            // Wrap once the cloud has fully cleared the right-hand overshoot,
            // reappearing past the left edge with its full width to spare.
            const w = CLOUD_DEFS[i].height * visibleHeight * CLOUD_ASPECT;
            if (next - width / 2 > width / 2 + w) {
                next -= width + w * 2;
            }
            offsets[i] = next;
        }
    });

    // By day the clouds are lit by the sky itself and fade as it darkens.
    // They don't vanish at night though - once the blood moon is up it
    // still catches their tops, so they hold a dim red-lit presence on the
    // same appear curve the moon uses (see Moon.svelte).
    const daylight = $derived(getSceneSkyBrightness(smoothProgress));
    const MOON_APPEAR_START = 0.93;
    const moonAmount = $derived(
        Math.pow(
            Math.min(Math.max((smoothProgress - MOON_APPEAR_START) / (1 - MOON_APPEAR_START), 0), 1),
            1.4
        )
    );
    // Fairly solid at night - the denser clouds meaningfully veil the moon
    // as they drift across it - but not so opaque they black it out.
    const layerOpacity = $derived(Math.max(Math.pow(daylight, 0.7), moonAmount * 0.7));

    // White, nudged toward the current sky colour so they sit in the scene
    // rather than glaring against it, then warmed toward the sun's own
    // colour near the horizon (clouds catch the sunset before the ground
    // does) - only while the sun is actually up to cast that light. After
    // dark the tint swings the other way, toward the moon's blood glow and
    // then down toward near-black, so night clouds read as dim red shapes -
    // the moon's forward halo (Moon.svelte) is what then washes light back
    // over the ones drifting across it.
    const tintColor = $derived.by(() => {
        const p = Math.min(Math.max(smoothProgress, 0), 1);
        const sunFromHorizon = Math.abs(p - 0.5) * 2;
        let rgb = mixRgb({ r: 248, g: 249, b: 252 }, parseCssColor(getSceneSkyColor(p)), 0.18);
        rgb = mixRgb(rgb, parseCssColor(getSceneSunColor(p)), sunFromHorizon * 0.3 * daylight);
        rgb = mixRgb(rgb, MOON_GLOW_COLOR, moonAmount * 0.5);
        rgb = mixRgb(rgb, { r: 34, g: 16, b: 18 }, moonAmount * 0.7);
        return new THREE.Color().setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, THREE.SRGBColorSpace);
    });
</script>

{#if layerOpacity > 0.01}
    {#each CLOUD_DEFS as cloud, i}
        {@const h = cloud.height * visibleHeight}
        <T.Mesh
            position={[
                offsets[i] - TRAVEL_WIDTH / 2 + horizontalOffset,
                (0.5 - cloud.y) * visibleHeight,
                CLOUD_Z + i * 0.01
            ]}
            scale={[cloud.flip ? -1 : 1, 1, 1]}
        >
            <T.PlaneGeometry args={[h * CLOUD_ASPECT, h]} />
            <T.MeshBasicMaterial
                map={cloudTexture}
                color={tintColor}
                transparent
                opacity={cloud.opacity * layerOpacity}
                depthWrite={false}
            />
        </T.Mesh>
    {/each}
{/if}
