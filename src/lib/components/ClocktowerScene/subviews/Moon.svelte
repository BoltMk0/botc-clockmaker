<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import moonTextureUrl from "$lib/assets/clocktower-scene/moon-texture.png";
    import {
        mixRgb,
        MOON_RISING_CORE_COLOR,
        MOON_RISING_GLOW_COLOR,
        MOON_CORE_COLOR,
        MOON_GLOW_COLOR,
        MOON_DISC_PINK
    } from "../sceneColors";

    let {
        smoothProgress,
        visibleHeight,
        horizontalOffset
    }: {
        smoothProgress: number;
        visibleHeight: number;
        horizontalOffset: number;
    } = $props();

    // The blood moon doesn't exist at all until the very end of the
    // countdown - it appears out of nowhere around progress 0.93 and drops
    // into its resting spot (just above the clocktower) from directly
    // above, on a curved path shaped like the sun's own arc (bow through a
    // control point) but offset so it lands centered rather than off to one
    // side. It sits behind the plane (negative z) so the tower's silhouette
    // occludes it low in the drop, and scales off the visible crop (not the
    // full image scale) so "just above the tower" holds regardless of zoom.
    const APPEAR_START = 0.93;
    const windowT = $derived(
        Math.min(Math.max((smoothProgress - APPEAR_START) / (1 - APPEAR_START), 0), 1)
    );
    const appearAmount = $derived(Math.pow(windowT, 1.4));

    const z = $derived(-visibleHeight * 0.6);
    const radius = $derived(visibleHeight * 0.15);

    const END_X = -0.15;
    const END_Y = 0.4;
    const START_X = 0.4;
    const START_Y = 1.5;
    const CONTROL_X = -0.5;
    const CONTROL_Y = 0.9;

    function bezier(t: number, p0: number, p1: number, p2: number) {
        const oneMinusT = 1 - t;
        return oneMinusT * oneMinusT * p0 + 2 * oneMinusT * t * p1 + t * t * p2;
    }

    const x = $derived(visibleHeight * bezier(windowT, START_X, CONTROL_X, END_X) + horizontalOffset);
    const y = $derived(visibleHeight * bezier(windowT, START_Y, CONTROL_Y, END_Y));

    const opacity = $derived(appearAmount * 0.95);

    // At least as bright as the clockface's own glow, if not brighter - the
    // moon is the actual light source the clockface is echoing, so it
    // should never read as the dimmer of the two. The core blends some of
    // the brighter glow color in rather than sitting at the darker, flatter
    // MOON_CORE_COLOR on its own.
    const rawCoreColorRgb = $derived(mixRgb(MOON_RISING_CORE_COLOR, MOON_CORE_COLOR, windowT));
    const glowColorRgb = $derived(mixRgb(MOON_RISING_GLOW_COLOR, MOON_GLOW_COLOR, windowT));
    const coreColorRgb = $derived(mixRgb(rawCoreColorRgb, glowColorRgb, 0.55));

    function toThreeColor(rgb: { r: number; g: number; b: number }) {
        return new THREE.Color().setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, THREE.SRGBColorSpace);
    }

    // The moon disc itself is a photographic texture; MeshBasicMaterial
    // multiplies it by `color`, so feeding the same `coreColorRgb` used for
    // the glow/light tints the grey texture into the blood moon's palette
    // rather than replacing it with a flat disc.
    //
    // Straight off the file the texture is a high-contrast grey photo, and
    // multiplying that by a deep red crushes the crater shadows to near
    // black and pushes the lit maria to a harsh pure red. So the raw image
    // is run once through a levels remap on a canvas that lifts the darks
    // and compresses the overall range (near-black -> DARK_FLOOR, gamma > 1
    // to keep midtones from ballooning), giving the tint something softer to
    // work against.
    const DARK_FLOOR = 96; // lowest value any pixel can reach after the remap
    const RANGE_GAMMA = 1.15;
    const rawMoonTexture = useTexture(untrack(() => moonTextureUrl));
    const moonCanvas: HTMLCanvasElement = document.createElement("canvas");
    const moonTexture = new THREE.CanvasTexture(moonCanvas);
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.generateMipmaps = false;
    moonTexture.minFilter = THREE.LinearFilter;
    moonTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        const img = $rawMoonTexture?.image as
            | HTMLImageElement
            | ImageBitmap
            | HTMLCanvasElement
            | undefined;
        if (!img || !("width" in img) || !img.width) return;

        moonCanvas.width = img.width;
        moonCanvas.height = img.height;
        const ctx = moonCanvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img as CanvasImageSource, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const px = data.data;
        const span = 255 - DARK_FLOOR;
        for (let i = 0; i < px.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const n = px[i + c] / 255;
                px[i + c] = DARK_FLOOR + Math.pow(n, RANGE_GAMMA) * span;
            }
        }
        ctx.putImageData(data, 0, 0);
        moonTexture.needsUpdate = true;
    });

    // Step the disc tint away from the pure blood red toward a softer pink -
    // lerping the shared core color toward a light warm pink both lightens
    // it and pulls saturation down, so the multiply reads as a rosy moon
    // rather than a red filter.
    const discTintRgb = $derived(mixRgb(coreColorRgb, MOON_DISC_PINK, 0.4));

    // The colour the moon casts onto nearby clouds - the disc's own rosy
    // tint pushed further toward pink, so the light it "emits" reads clearly
    // pink rather than as the deeper red of its halo.
    const moonGlowLightRgb = $derived(mixRgb(discTintRgb, MOON_DISC_PINK, 0.45));

    // A soft, feathered halo behind the moon to read as mist/atmosphere
    // scattering its light, rather than a hard-edged disc of glow. A plain
    // circle mesh can only ever have a crisp edge, so this is a small
    // radial-gradient canvas (opaque-ish center fading smoothly to fully
    // transparent) redrawn whenever the moon's color shifts.
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
        const { r, g, b } = glowColorRgb;
        const center = HALO_TEXTURE_SIZE / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
        gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.22)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.clearRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        haloTexture.needsUpdate = true;
    });

    // A second, broader, softer halo - pink rather than the tight halo's
    // red - used purely for the light the moon scatters through anything
    // (clouds) drifting between it and the camera. It renders in FRONT of
    // the cloud layer (mirroring how the sun's halo sits in front of the
    // clouds), so it washes additively over a cloud crossing the moon and
    // reads as the moon's light diffusing through it, rather than the cloud
    // itself lighting up.
    const diffusionCanvas: HTMLCanvasElement = document.createElement("canvas");
    diffusionCanvas.width = HALO_TEXTURE_SIZE;
    diffusionCanvas.height = HALO_TEXTURE_SIZE;
    const diffusionTexture = new THREE.CanvasTexture(diffusionCanvas);
    diffusionTexture.colorSpace = THREE.SRGBColorSpace;
    diffusionTexture.generateMipmaps = false;
    diffusionTexture.minFilter = THREE.LinearFilter;
    diffusionTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        const ctx = diffusionCanvas.getContext("2d");
        if (!ctx) return;
        const { r, g, b } = moonGlowLightRgb;
        const center = HALO_TEXTURE_SIZE / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.42)`);
        gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.16)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.clearRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        diffusionTexture.needsUpdate = true;
    });

    // In front of the clouds (z = -visibleHeight * 0.4), behind the tower.
    const diffusionZ = $derived(-visibleHeight * 0.25);
    const diffusionSize = $derived(radius * 8);

    // The moon's own light: positioned high above and only slightly in front
    // of the tower, near-overhead, rather than level with the disc's rise.
    // A flat, forward-facing normal map barely lights up under a raking
    // top-down light like this - it's the raised carved details (ledges,
    // cornices, gargoyles) whose normals actually tilt upward that catch it,
    // so this reads as scattered highlights picking out relief rather than
    // lighting the whole facade the way the sun does.
    const lightHeight = $derived(visibleHeight * 1.3);
    const lightForwardDistance = $derived(visibleHeight * 0.2);
</script>

<T.DirectionalLight
    position={[horizontalOffset, lightHeight, lightForwardDistance]}
    intensity={appearAmount * 7}
    color={toThreeColor(coreColorRgb)}
/>

<!-- Broad pink diffusion glow, in front of the cloud layer: additively
     washes over any cloud drifting across the moon so its light appears to
     scatter through them, rather than the clouds themselves lighting up. -->
<T.Mesh position={[x, y, diffusionZ]}>
    <T.PlaneGeometry args={[diffusionSize, diffusionSize]} />
    <T.MeshBasicMaterial
        map={diffusionTexture}
        transparent
        opacity={appearAmount * 0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
    />
</T.Mesh>

<T.Mesh position={[x, y, z]}>
    <T.CircleGeometry args={[radius, 64]} />
    <T.MeshBasicMaterial
        map={moonTexture}
        color={toThreeColor(discTintRgb)}
        transparent
        {opacity}
    />
</T.Mesh>

<T.Mesh position={[x, y, z - 0.02]}>
    <T.PlaneGeometry args={[radius * 7, radius * 7]} />
    <T.MeshBasicMaterial
        map={haloTexture}
        transparent
        opacity={appearAmount * 1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
    />
</T.Mesh>
