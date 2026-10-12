<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";

    // A single line of small text drawn onto its own transparent canvas
    // plane - no background art, just floating text (e.g. the classifier
    // labels above each PlayerCountBanner slot). Same canvas-texture
    // technique as TextBanner/SmallBanner, stripped down to one auto-fit
    // line and no backing image.

    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const FONT_WEIGHT = "700";
    const UPPERCASE = true;
    const DEFAULT_TEXT_COLOR = "#2b1d10";
    const MAX_FONT_PX = 220;
    const MIN_FONT_PX = 24;
    const CANVAS_HEIGHT = 256;

    // Drop shadow so the label reads as sitting in the scene rather than
    // floating flat above the banner - same treatment as the title text.
    const SHADOW_COLOR = "rgba(0, 0, 0, 0.6)";
    const SHADOW_BLUR = 6;
    const SHADOW_OFFSET_X = 0;
    const SHADOW_OFFSET_Y = 3;

    let {
        text,
        color,
        placement,
        // World-space height of the label plane; width follows `placement.width`.
        height,
        z = 0,
        // Fixed font size (in canvas px, against CANVAS_HEIGHT) to use
        // instead of auto-fitting this label on its own - so a row of
        // labels of differing lengths can share one size instead of each
        // shrinking independently. Falls back to the normal auto-fit when
        // omitted.
        fontPx
    }: {
        text: string;
        color?: string;
        placement: { x: number; y: number; width: number };
        height: number;
        z?: number;
        fontPx?: number;
    } = $props();

    let fontReady = $state(
        typeof document !== "undefined" && document.fonts.check(`16px "Dumbledore"`)
    );
    $effect(() => {
        if (fontReady) return;
        document.fonts
            .load(`${FONT_WEIGHT} 16px "Dumbledore"`)
            .then(() => (fontReady = true))
            .catch(() => (fontReady = true));
    });

    const aspect = $derived(placement.width / height);

    const textCanvas: HTMLCanvasElement = document.createElement("canvas");
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    textTexture.generateMipmaps = false;
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        void fontReady;

        const canvasHeight = CANVAS_HEIGHT;
        const canvasWidth = Math.round(canvasHeight * aspect);
        textCanvas.width = canvasWidth;
        textCanvas.height = canvasHeight;

        const ctx = textCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const label = UPPERCASE ? (text ?? "").toUpperCase() : (text ?? "");

        let resolvedFontPx = fontPx ?? MAX_FONT_PX;
        if (fontPx === undefined) {
            while (resolvedFontPx >= MIN_FONT_PX) {
                ctx.font = `${FONT_WEIGHT} ${resolvedFontPx}px ${FONT_FAMILY}`;
                const w = ctx.measureText(label).width;
                const h = resolvedFontPx * 0.8;
                if (w <= canvasWidth && h <= canvasHeight) break;
                resolvedFontPx -= 4;
            }
        }

        ctx.font = `${FONT_WEIGHT} ${resolvedFontPx}px ${FONT_FAMILY}`;
        ctx.fillStyle = color ?? DEFAULT_TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = SHADOW_COLOR;
        ctx.shadowBlur = SHADOW_BLUR;
        ctx.shadowOffsetX = SHADOW_OFFSET_X;
        ctx.shadowOffsetY = SHADOW_OFFSET_Y;
        ctx.fillText(label, canvasWidth / 2, canvasHeight / 2);
        ctx.shadowColor = "transparent";

        textTexture.needsUpdate = true;
    });
</script>

<T.Mesh position={[placement.x, placement.y, z]}>
    <T.PlaneGeometry args={[placement.width, height]} />
    <T.MeshStandardMaterial
        map={textTexture}
        transparent
        depthWrite={false}
        roughness={0.9}
        metalness={0}
    />
</T.Mesh>
