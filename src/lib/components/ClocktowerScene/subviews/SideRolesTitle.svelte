<script lang="ts">
    import * as THREE from "three";
    import { onDestroy } from "svelte";
    import { T } from "@threlte/core";

    // Centred title text above the loric/fabled token stack. Drawn onto a fixed-size canvas texture
    // (like the scene's other text); anchored by its top-centre.

    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const FONT_WEIGHT = "700";
    const TEXT_COLOR = "#c9c2a3";
    const TEXT_SHADOW_COLOR = "rgba(0, 0, 0, 0.75)";
    const CANVAS_WIDTH = 1024;
    const CANVAS_HEIGHT = 128;

    let {
        text,
        width,
        anchor,
        z = 0.2
    }: {
        text: string;
        // World width of the (transparent) plane the text is drawn on; the text is centred within it.
        width: number;
        // Top-centre, in world units.
        anchor: { x: number; y: number };
        z?: number;
    } = $props();

    const height = $derived(width * CANVAS_HEIGHT / CANVAS_WIDTH);

    const canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    onDestroy(() => texture.dispose());

    let fontReady = $state(typeof document !== "undefined" && document.fonts.check(`16px "Dumbledore"`));
    $effect(() => {
        if (fontReady) return;
        document.fonts
            .load(`${FONT_WEIGHT} 16px "Dumbledore"`)
            .then(() => (fontReady = true))
            .catch(() => (fontReady = true));
    });

    $effect(() => {
        void fontReady;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const fontPx = CANVAS_HEIGHT * 0.7;
        ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = TEXT_SHADOW_COLOR;
        ctx.shadowBlur = fontPx * 0.1;
        ctx.shadowOffsetY = fontPx * 0.03;
        ctx.fillText(text.toUpperCase(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        texture.needsUpdate = true;
    });
</script>

<T.Mesh position={[anchor.x, anchor.y - height / 2, z]}>
    <T.PlaneGeometry args={[width, height]} />
    <T.MeshBasicMaterial map={texture} transparent depthWrite={false} />
</T.Mesh>
