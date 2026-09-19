<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T, useTask } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import lanternTextureUrl from "$lib/assets/clocktower-scene/lantern.png";
    import lanternNormalMapUrl from "$lib/assets/clocktower-scene/lantern-normal.png";
    import { getSceneSkyBrightness } from "../sceneColors";

    // ---------------------------------------------------------------------
    // Glow tuning - tweak these freely.
    //
    // The lantern's painted glass is already lit in the source art; these
    // add an actual soft bloom around it (tight CORE halo) plus a broad,
    // very faint WASH halo pushed out in front of the entire scene so the
    // lantern reads as a real light source in the shot, not just a lit prop.
    // Both use the same radial-gradient-canvas technique as the sun/moon
    // halos. A `T.PointLight` alongside them casts real light onto the
    // tower/banners' normal maps.
    // ---------------------------------------------------------------------
    const GLOW_COLOR = { r: 255, g: 186, b: 107 }; // warm amber, matches the lit glass panes

    const CORE_GLOW_OPACITY = 0.2;
    const CORE_GLOW_Z_LIFT = 0.02; // just in front of the lantern art itself
    // Only pixels at least this bright (0-1 luminance) in the lantern's own
    // art get any glow - keeps the dark ironwork frame dark and confines the
    // additive bloom to the painted glass panes instead of washing out the
    // whole prop.
    const GLOW_MASK_THRESHOLD = 0.55;

    // The wash is rendered far out in front of everything (tower, banners,
    // clouds all sit at z values well below this) so it washes additively
    // over the whole frame near the lantern, reading as ambient light spill
    // rather than a bright halo sitting on top of the art.
    const WASH_GLOW_SIZE_SCALE = 9;
    const WASH_GLOW_OPACITY = 0.4;
    const WASH_Z = 8;

    const POINT_LIGHT_Z_FORWARD = 1.8; // pulls the real light source toward the camera/tower
    const POINT_LIGHT_INTENSITY = 5;
    const POINT_LIGHT_DISTANCE_SCALE = 55; // relative to lantern width

    // A gentle candle-flicker: two out-of-phase sine waves rather than one,
    // so it doesn't read as a metronomic pulse.
    const FLICKER_SPEED_A = 6.3;
    const FLICKER_SPEED_B = 11.7;
    const FLICKER_AMOUNT_A = 0.06;
    const FLICKER_AMOUNT_B = 0.03;

    // The glow should barely show in bright daylight and be most visible
    // once night has properly settled in - `getSceneSkyBrightness` already
    // gives 1 (daylit) -> 0 (night), so darkness is just its complement,
    // with a floor so the lantern is never fully invisible.
    const DARKNESS_FLOOR = 0.15;

    const HALO_TEXTURE_SIZE = 128;

    let {
        visibleHeight,
        placement,
        progress = 0,
        z = 0.2
    }: {
        visibleHeight: number;
        placement: { x: number; y: number; width: number };
        progress?: number;
        z?: number;
    } = $props();

    const lanternTexture = useTexture(untrack(() => lanternTextureUrl));
    const lanternNormalTexture = useTexture(untrack(() => lanternNormalMapUrl));

    $effect(() => {
        // Albedo needs to be interpreted as sRGB; the normal map must stay in
        // linear space (three's default), so it's left untouched - same
        // split as the tower/billboard normal maps.
        if ($lanternTexture && $lanternTexture.colorSpace !== THREE.SRGBColorSpace) {
            $lanternTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    const aspect = $derived(
        $lanternTexture?.image
            ? $lanternTexture.image.width / $lanternTexture.image.height
            : 512 / 768
    );

    const planeWidth = $derived(placement.width);
    const planeHeight = $derived(planeWidth / aspect);
    const x = $derived(placement.x);
    const y = $derived(placement.y);

    let flickerT = $state(0);
    useTask((delta) => {
        flickerT += delta;
    });
    const flicker = $derived(
        1 +
            Math.sin(flickerT * FLICKER_SPEED_A) * FLICKER_AMOUNT_A +
            Math.sin(flickerT * FLICKER_SPEED_B) * FLICKER_AMOUNT_B
    );

    const darkness = $derived(
        DARKNESS_FLOOR + (1 - DARKNESS_FLOOR) * (1 - getSceneSkyBrightness(progress))
    );

    const glowStrength = $derived(flicker * darkness);

    // Broad ambient wash - a plain soft radial gradient, same technique as
    // the sun/moon halos. Rendered huge and faint (see WASH_GLOW_OPACITY) so
    // its per-pixel contribution over the lantern's own dark ironwork is
    // negligible; it's there to bleed a little warm light into the rest of
    // the frame.
    const washCanvas: HTMLCanvasElement = document.createElement("canvas");
    washCanvas.width = HALO_TEXTURE_SIZE;
    washCanvas.height = HALO_TEXTURE_SIZE;
    const washTexture = new THREE.CanvasTexture(washCanvas);
    washTexture.colorSpace = THREE.SRGBColorSpace;
    washTexture.generateMipmaps = false;
    washTexture.minFilter = THREE.LinearFilter;
    washTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        const ctx = washCanvas.getContext("2d");
        if (!ctx) return;
        const { r, g, b } = GLOW_COLOR;
        const center = HALO_TEXTURE_SIZE / 2;
        const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
        gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.28)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.clearRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, HALO_TEXTURE_SIZE, HALO_TEXTURE_SIZE);
        washTexture.needsUpdate = true;
    });

    // Tight bloom, masked to the lantern's own lit glass instead of a plain
    // gradient: drawn at the lantern texture's native resolution, keeping
    // only pixels bright enough to be glass (GLOW_MASK_THRESHOLD) and
    // discarding the rest, so the dark ironwork frame stays dark instead of
    // being additively lightened by an oversized halo sitting on top of it.
    const glowMaskCanvas: HTMLCanvasElement = document.createElement("canvas");
    const glowMaskTexture = new THREE.CanvasTexture(glowMaskCanvas);
    glowMaskTexture.colorSpace = THREE.SRGBColorSpace;
    glowMaskTexture.generateMipmaps = false;
    glowMaskTexture.minFilter = THREE.LinearFilter;
    glowMaskTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        const img = $lanternTexture?.image as
            | HTMLImageElement
            | ImageBitmap
            | HTMLCanvasElement
            | undefined;
        if (!img || !("width" in img) || !img.width) return;

        glowMaskCanvas.width = img.width;
        glowMaskCanvas.height = img.height;
        const ctx = glowMaskCanvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, img.width, img.height);
        ctx.drawImage(img as CanvasImageSource, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const px = data.data;
        const { r: gr, g: gg, b: gb } = GLOW_COLOR;
        for (let i = 0; i < px.length; i += 4) {
            const luminance =
                (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
            const mask = Math.max(
                0,
                (luminance - GLOW_MASK_THRESHOLD) / (1 - GLOW_MASK_THRESHOLD)
            );
            px[i] = gr;
            px[i + 1] = gg;
            px[i + 2] = gb;
            px[i + 3] = Math.round(px[i + 3] * mask * mask);
        }
        ctx.putImageData(data, 0, 0);
        glowMaskTexture.needsUpdate = true;
    });

    const lightColor = $derived(
        new THREE.Color().setRGB(
            GLOW_COLOR.r / 255,
            GLOW_COLOR.g / 255,
            GLOW_COLOR.b / 255,
            THREE.SRGBColorSpace
        )
    );
</script>

{#if $lanternTexture && $lanternNormalTexture}
    <!-- The lantern prop itself, lit like the tower/banners by the scene's
         sun/moon lights so it darkens and warms/cools with the rest of the
         scene rather than sitting at a flat brightness. The normal map gives
         the ironwork's relief real per-pixel shading, instead of the whole
         flat plane picking up one uniform, contrast-flattening wash of
         light the way an unmapped plane does. -->
    <T.Mesh position={[x, y, z]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$lanternTexture}
            normalMap={$lanternNormalTexture}
            transparent
            alphaTest={0.01}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>

    <!-- Tight bloom, masked to just the lit glass panes (see glowMaskCanvas
         above) - sized to the lantern plane itself, not enlarged, so it
         can't bleed additive light over the dark frame around it. -->
    <T.Mesh position={[x, y, z + CORE_GLOW_Z_LIFT]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshBasicMaterial
            map={glowMaskTexture}
            transparent
            opacity={CORE_GLOW_OPACITY * glowStrength}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
        />
    </T.Mesh>

    <!-- Broad wash, pushed out in front of the entire scene (tower, banners,
         clouds) so the lantern reads as an actual light source illuminating
         the shot rather than just a glowing prop. -->
    <T.Mesh position={[x, y, WASH_Z]}>
        <T.PlaneGeometry
            args={[planeWidth * WASH_GLOW_SIZE_SCALE, planeWidth * WASH_GLOW_SIZE_SCALE]}
        />
        <T.MeshBasicMaterial
            map={washTexture}
            transparent
            opacity={WASH_GLOW_OPACITY * glowStrength}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
        />
    </T.Mesh>

    <!-- Real point light so nearby carved detail (tower facade, banner
         normal maps) actually picks up warm light from the lantern, rather
         than the glow being a purely visual overlay. -->
    <T.PointLight
        position={[x, y, z + POINT_LIGHT_Z_FORWARD]}
        color={lightColor}
        intensity={POINT_LIGHT_INTENSITY * glowStrength}
        distance={planeWidth * POINT_LIGHT_DISTANCE_SCALE}
        decay={2}
    />
{/if}
