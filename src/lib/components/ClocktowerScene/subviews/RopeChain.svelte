<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";

    // ---------------------------------------------------------------------
    // A thin twisted-rope texture, tiled vertically to whatever length is
    // needed rather than drawn as one giant stretched texture. The tile is a
    // small seamless diagonal-stripe canvas (two-tone, like twisted strands)
    // - seamless because the stripe pattern is a periodic function of
    // `x + y`, so it repeats cleanly both across and along the tile with no
    // visible seam. `repeat.y` is then set from the actual world-space
    // length needed, so the twist reads at a consistent scale regardless of
    // how long the rope between two points ends up being.
    // ---------------------------------------------------------------------
    const TILE_SIZE = 64;
    const STRIPE_PERIOD = 16; // px; TILE_SIZE should be a multiple of this
    const ROPE_COLOR_A = "#4a3220";
    const ROPE_COLOR_B = "#8a6540";
    // World-space length one tile should cover - smaller means a tighter,
    // more visible twist; larger reads as a smoother cord.
    const TILE_WORLD_SIZE_SCALE = 1.1; // relative to `thickness`

    let {
        x,
        topY,
        bottomY,
        thickness,
        z = 0.2
    }: {
        x: number;
        topY: number;
        bottomY: number;
        thickness: number;
        z?: number;
    } = $props();

    const tileCanvas: HTMLCanvasElement = document.createElement("canvas");
    tileCanvas.width = TILE_SIZE;
    tileCanvas.height = TILE_SIZE;
    const ropeTexture = new THREE.CanvasTexture(tileCanvas);
    ropeTexture.colorSpace = THREE.SRGBColorSpace;
    ropeTexture.wrapS = THREE.RepeatWrapping;
    ropeTexture.wrapT = THREE.RepeatWrapping;
    ropeTexture.generateMipmaps = false;
    ropeTexture.minFilter = THREE.LinearFilter;
    ropeTexture.magFilter = THREE.LinearFilter;

    {
        const ctx = tileCanvas.getContext("2d");
        if (ctx) {
            const imageData = ctx.createImageData(TILE_SIZE, TILE_SIZE);
            const colorA = new THREE.Color(ROPE_COLOR_A);
            const colorB = new THREE.Color(ROPE_COLOR_B);
            for (let py = 0; py < TILE_SIZE; py++) {
                for (let px = 0; px < TILE_SIZE; px++) {
                    // A soft (non-hard-edged) diagonal stripe: blend smoothly
                    // between the two strand colors rather than a flat cut,
                    // so it reads as a rounded twisted cord.
                    const phase = ((px + py) % STRIPE_PERIOD) / STRIPE_PERIOD;
                    const t = (Math.sin(phase * Math.PI * 2) + 1) / 2;
                    const idx = (py * TILE_SIZE + px) * 4;
                    imageData.data[idx] = Math.round(colorA.r * 255 * (1 - t) + colorB.r * 255 * t);
                    imageData.data[idx + 1] = Math.round(
                        colorA.g * 255 * (1 - t) + colorB.g * 255 * t
                    );
                    imageData.data[idx + 2] = Math.round(
                        colorA.b * 255 * (1 - t) + colorB.b * 255 * t
                    );
                    imageData.data[idx + 3] = 255;
                }
            }
            ctx.putImageData(imageData, 0, 0);
        }
        ropeTexture.needsUpdate = true;
    }

    const height = $derived(Math.max(0, topY - bottomY));
    const centerY = $derived((topY + bottomY) / 2);
    const tileWorldSize = $derived(thickness * TILE_WORLD_SIZE_SCALE);
    const repeatY = $derived(Math.max(1, height / Math.max(tileWorldSize, 0.0001)));

    $effect(() => {
        ropeTexture.repeat.set(1, repeatY);
        ropeTexture.needsUpdate = true;
    });
</script>

{#if height > 0}
    <T.Mesh position={[x, centerY, z]}>
        <T.PlaneGeometry args={[thickness, height]} />
        <T.MeshStandardMaterial map={ropeTexture} roughness={0.9} metalness={0} />
    </T.Mesh>
{/if}
