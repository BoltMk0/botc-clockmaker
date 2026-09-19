<script lang="ts">
    import * as THREE from "three";
    import { T, useThrelte } from "@threlte/core";
    import { parseCssColor } from "$lib/common/util";
    import { mixRgb, getSceneSkyColor, MOON_GLOW_COLOR } from "../sceneColors";

    // A soft fog bank drifting across the bottom half of the screen, mostly
    // to hide the seam where the tower art's cropped bottom edge would
    // otherwise be visible, and to give the scene some atmosphere. Sits in
    // front of the tower/clock face/hands (z 0-0.09) but behind the stats
    // panel's day/count banners (GameStatsPanel's PANEL.z = 0.2), so the UI
    // always reads clearly on top of it.
    const MIST_Z = 0.1;

    let {
        smoothProgress,
        visibleHeight,
        // How much of the screen's vertical extent the mist covers, as a
        // fraction of `visibleHeight` - 0.5 = the bottom half. Its bottom
        // edge is always pinned to the screen's actual bottom; this only
        // moves the top (fade-in) edge up or down.
        heightFraction = 0.5
    }: {
        smoothProgress: number;
        visibleHeight: number;
        heightFraction?: number;
    } = $props();

    // The real visible half-width, in world units - same derivation as
    // GameStatsPanel.svelte's `realHalfWidth` (see the comment there): with
    // an orthographic camera, 1 world unit = 1px at zoom 1 and
    // zoom = size.height / visibleHeight, so half the real screen width in
    // world units is visibleHeight * (size.width / size.height) / 2.
    const { size } = useThrelte();
    const realHalfWidth = $derived(visibleHeight * ($size.width / $size.height) / 2);
    // Overscan the plane's width a little past the real edges so nothing
    // ever shows a gap at the sides on an unusually wide/narrow screen.
    const WIDTH_OVERSCAN = 1.1;
    const planeWidth = $derived(realHalfWidth * 2 * WIDTH_OVERSCAN);
    // The plane's bottom edge is always pinned to the screen's actual
    // bottom (world y = -visibleHeight / 2); `heightFraction` only moves its
    // top (fade-in) edge up or down from there.
    const planeHeight = $derived(visibleHeight * heightFraction);
    const planeY = $derived(-visibleHeight / 2 + planeHeight / 2);

    // The mist's own texture: a vertical fade (transparent at the top edge,
    // toward pale and opaque at the bottom) with a few soft blurred banks
    // breaking up the top edge so it doesn't read as one flat, hard-edged
    // sheet - same blurred-disc technique as Clouds.svelte.
    const TEX_W = 512;
    const TEX_H = 512;
    const mistCanvas: HTMLCanvasElement = document.createElement("canvas");
    mistCanvas.width = TEX_W;
    mistCanvas.height = TEX_H;
    const mistTexture = new THREE.CanvasTexture(mistCanvas);
    mistTexture.colorSpace = THREE.SRGBColorSpace;
    mistTexture.generateMipmaps = false;
    mistTexture.minFilter = THREE.LinearFilter;
    mistTexture.magFilter = THREE.LinearFilter;

    {
        const ctx = mistCanvas.getContext("2d");
        if (ctx) {
            ctx.clearRect(0, 0, TEX_W, TEX_H);

            // Base fade: nothing at the very top, thickening toward the bottom.
            const fade = ctx.createLinearGradient(0, 0, 0, TEX_H);
            fade.addColorStop(0, "rgba(255, 255, 255, 0)");
            fade.addColorStop(0.45, "rgba(255, 255, 255, 0)");
            fade.addColorStop(0.75, "rgba(255, 255, 255, 0.55)");
            fade.addColorStop(1, "rgba(255, 255, 255, 0.85)");
            ctx.fillStyle = fade;
            ctx.fillRect(0, 0, TEX_W, TEX_H);

            // A row of soft blurred banks straddling the fade's leading edge,
            // so the mist's top boundary reads as uneven drifting billows
            // rather than a ruler-straight line.
            const banks = [
                { x: 0.08, y: 0.52, r: 0.22 },
                { x: 0.24, y: 0.46, r: 0.18 },
                { x: 0.4, y: 0.55, r: 0.24 },
                { x: 0.58, y: 0.44, r: 0.2 },
                { x: 0.74, y: 0.52, r: 0.22 },
                { x: 0.9, y: 0.47, r: 0.19 }
            ];
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.filter = `blur(${TEX_H * 0.05}px)`;
            for (const b of banks) {
                ctx.beginPath();
                ctx.arc(b.x * TEX_W, b.y * TEX_H, b.r * TEX_H, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.filter = "none";

            mistTexture.needsUpdate = true;
        }
    }

    // Mist reads as mostly pale/white, lightly tinted by the current sky
    // colour (and, at night, the blood moon's glow) so it sits in the scene
    // rather than glaring against it - same approach as Clouds.svelte's
    // `tintColor`, just without the sun-glow term (mist sits low, out of
    // direct sun glare).
    const MOON_APPEAR_START = 0.93;
    const moonAmount = $derived(
        Math.pow(
            Math.min(Math.max((smoothProgress - MOON_APPEAR_START) / (1 - MOON_APPEAR_START), 0), 1),
            1.4
        )
    );
    const tintColor = $derived.by(() => {
        const p = Math.min(Math.max(smoothProgress, 0), 1);
        let rgb = mixRgb({ r: 248, g: 249, b: 252 }, parseCssColor(getSceneSkyColor(p)), 0.22);
        rgb = mixRgb(rgb, MOON_GLOW_COLOR, moonAmount * 0.45);
        rgb = mixRgb(rgb, { r: 20, g: 14, b: 18 }, moonAmount * 0.35);
        return new THREE.Color().setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, THREE.SRGBColorSpace);
    });
</script>

<T.Mesh position={[0, planeY, MIST_Z]}>
    <T.PlaneGeometry args={[planeWidth, planeHeight]} />
    <T.MeshBasicMaterial
        map={mistTexture}
        color={tintColor}
        transparent
        opacity={0.7}
        depthWrite={false}
    />
</T.Mesh>
