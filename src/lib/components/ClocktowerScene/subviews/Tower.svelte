<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";

    let {
        imageUrl,
        normalMapUrl,
        origin,
        planeHeight,
        horizontalOffset,
        verticalOffset = 0
    }: {
        imageUrl: string;
        normalMapUrl: string;
        origin: { x: number; y: number };
        planeHeight: number;
        horizontalOffset: number;
        verticalOffset?: number;
    } = $props();

    // Textures are loaded once for the component's lifetime - imageUrl/normalMapUrl
    // aren't expected to change while it's mounted.
    const colorTexture = useTexture(untrack(() => imageUrl));
    const normalTexture = useTexture(untrack(() => normalMapUrl));

    $effect(() => {
        // Albedo textures need to be interpreted as sRGB; the normal map must
        // stay in linear space, which is three's default, so it's untouched.
        if ($colorTexture && $colorTexture.colorSpace !== THREE.SRGBColorSpace) {
            $colorTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    // The image's own aspect ratio, once known - falls back to square while loading.
    const imageAspect = $derived(
        $colorTexture?.image ? $colorTexture.image.width / $colorTexture.image.height : 1
    );

    const planeWidth = $derived(planeHeight * imageAspect);

    // Position the plane so that the defined origin point (normalized image
    // coordinates, (0,0) = top-left, (1,1) = bottom-right) lands on the
    // world origin, offset by `horizontalOffset` - the camera is always
    // centered on world (0,0), so with no offset the origin would sit dead
    // center; shifting the plane (and the moon, in step) right by this
    // amount instead moves the whole tower into the right third of frame,
    // without touching the camera or the sun's own screen-relative arc.
    const planeX = $derived((0.5 - origin.x) * planeWidth + horizontalOffset);
    const planeY = $derived((origin.y - 0.5) * planeHeight + verticalOffset);
</script>

{#if $colorTexture && $normalTexture}
    <!-- Deferred until both textures resolve: the material's shader is
         compiled against whichever map/normalMap it's created with, so
         mounting it with the textures already in hand avoids needing a
         manual `needsUpdate` poke when they'd otherwise arrive later. -->
    <T.Mesh position={[planeX, planeY, 0]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$colorTexture}
            normalMap={$normalTexture}
            transparent
            alphaTest={0.01}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>
{/if}
