<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import { mixRgb, MOON_GLOW_COLOR, MOON_DISC_PINK } from "../sceneColors";

    // The tower art was authored at 4096px for its `planeHeight` world
    // units (see ClocktowerScene.svelte) - hardcoded here rather than read
    // off the tower's own loaded texture so this component doesn't need a
    // cross-component dependency just to size itself; update this if the
    // tower asset's resolution ever changes.
    const TOWER_IMAGE_PIXEL_HEIGHT = 4096;

    // Overall strength of the dial's blood-red glow at full night (progress
    // 1) - a single knob scaling the emissive dial, the point light it casts
    // onto the tower, and the mist halo bleeding out from it, so the three
    // stay balanced with each other as this is tuned.
    const GLOW_INTENSITY = 0.5;
    let {
        imageUrl,
        normalMapUrl,
        // Normalized position of the dial's own center within its image -
        // the blank clockface art is centered on its canvas, so (0.5, 0.5)
        // needs no tuning unless that changes.
        origin = { x: 0.5, y: 0.5 },
        // The tower's world-space scale, so the clockface renders at the
        // same physical pixel density as the tower art instead of an
        // independently-tuned size - a clockface authored at N pixels tall
        // occupies N / TOWER_IMAGE_PIXEL_HEIGHT of the tower's own height.
        towerPlaneHeight,
        // Where the tower's own origin point lands in world space - the
        // clockface's origin is placed there too, so the two coincide.
        horizontalOffset,
        verticalOffset = 0,
        // Slightly in front of the tower plane (z=0) so it isn't coplanar
        // and z-fighting with it.
        forwardOffset = 0.05,
        smoothProgress
    }: {
        imageUrl: string;
        normalMapUrl: string;
        origin?: { x: number; y: number };
        towerPlaneHeight: number;
        horizontalOffset: number;
        verticalOffset?: number;
        forwardOffset?: number;
        smoothProgress: number;
    } = $props();

    // The dial glows blood red in sync with the moon - same appear window
    // and color it uses, so the two feel like one omen rather than two
    // separately-timed effects.
    const APPEAR_START = 0.93;
    const windowT = $derived(
        Math.min(Math.max((smoothProgress - APPEAR_START) / (1 - APPEAR_START), 0), 1)
    );
    const glowAmount = $derived(Math.pow(windowT, 1.4));

    function toThreeColor(rgb: { r: number; g: number; b: number }) {
        return new THREE.Color().setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, THREE.SRGBColorSpace);
    }
    // The dial's diffuse surface isn't tinted at all - all of the night
    // color comes from the glow (emissive, point light and mist halo), so
    // the dial reads as genuinely lit by the moon rather than repainted.
    // The glow is pulled toward the same soft pink as the moon's disc,
    // keeping the clockface in that desaturated rosy register rather than a
    // hot, saturated red.
    const NIGHT_GLOW_COLOR = mixRgb(MOON_GLOW_COLOR, MOON_DISC_PINK, 0.8);
    const glowColor = $derived(toThreeColor(NIGHT_GLOW_COLOR));

    const colorTexture = useTexture(untrack(() => imageUrl));
    const normalTexture = useTexture(untrack(() => normalMapUrl));

    $effect(() => {
        if ($colorTexture && $colorTexture.colorSpace !== THREE.SRGBColorSpace) {
            $colorTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    const imagePixelHeight = $derived($colorTexture?.image?.height ?? 0);
    const imageAspect = $derived(
        $colorTexture?.image ? $colorTexture.image.width / $colorTexture.image.height : 1
    );

    const planeHeight = $derived((imagePixelHeight / TOWER_IMAGE_PIXEL_HEIGHT) * towerPlaneHeight);
    const planeWidth = $derived(planeHeight * imageAspect);

    // Same placement convention as Tower.svelte: position the plane so the
    // defined origin point lands on the target world position.
    const planeX = $derived((0.5 - origin.x) * planeWidth + horizontalOffset);
    const planeY = $derived((origin.y - 0.5) * planeHeight + verticalOffset);

    // A real light at the dial, not just an emissive material - positioned
    // out in front of the tower so it actually rakes across the
    // normal-mapped stonework around the clockface (carved ledges/mouldings
    // catch it as highlights) rather than only lighting the dial itself.
    const LIGHT_FORWARD_DISTANCE = $derived(planeHeight * 1.2);
    const LIGHT_DISTANCE = $derived(planeHeight * 3);
    const lightIntensity = $derived(glowAmount * 6 * GLOW_INTENSITY);

    // A soft, feathered halo bleeding out from the dial to read as mist/bloom
    // - same radial-gradient-canvas technique as the moon's and sun's halos,
    // rather than a hard-edged glow circle.
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
        const { r, g, b } = NIGHT_GLOW_COLOR;
        const center = HALO_TEXTURE_SIZE / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
        gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.28)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.clearRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        haloTexture.needsUpdate = true;
    });

    const haloSize = $derived(planeHeight * 3);
</script>

{#if $colorTexture && $normalTexture && imagePixelHeight > 0}
    <!-- Deferred until both textures resolve and the color texture's real
         pixel size is known - same reasoning as Tower.svelte. -->
    <T.Mesh position={[planeX, planeY, forwardOffset]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$colorTexture}
            normalMap={$normalTexture}
            emissive={glowColor}
            emissiveIntensity={glowAmount * 0.5 * GLOW_INTENSITY}
            emissiveMap={$colorTexture}
            transparent
            alphaTest={0.01}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>

    <T.PointLight
        position={[planeX, planeY, LIGHT_FORWARD_DISTANCE]}
        color={glowColor}
        intensity={lightIntensity}
        distance={LIGHT_DISTANCE}
        decay={1}
    />

    <T.Mesh position={[planeX, planeY, forwardOffset - 0.01]}>
        <T.PlaneGeometry args={[haloSize, haloSize]} />
        <T.MeshBasicMaterial
            map={haloTexture}
            transparent
            opacity={glowAmount * GLOW_INTENSITY}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
        />
    </T.Mesh>
{/if}
