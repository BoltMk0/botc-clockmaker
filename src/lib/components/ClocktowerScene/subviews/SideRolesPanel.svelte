<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";
    import { onDestroy } from "svelte";
    import type { Character } from "$lib/resources/common/gameData";

    // A small panel listing the loric and fabled characters in the game (public info that never takes a
    // seat), as a vertical list of icon + name. Anchored by its top-right corner. Drawn onto a canvas
    // texture like the other text in this scene.

    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const FONT_WEIGHT = "700";
    const TEXT_COLOR = "#c9c2a3";
    const CANVAS_WIDTH = 512;

    // Sizes as fractions of visibleHeight.
    const PANEL_WIDTH_FRACTION = 0.27;
    const ROW_HEIGHT_FRACTION = 0.0765;
    const PADDING_FRACTION = 0.0135;
    const TITLE_HEIGHT_FRACTION = 0.05;

    let {
        characters,
        visibleHeight,
        anchor,
        z = 0.2
    }: {
        characters: Character[];
        visibleHeight: number;
        // Top-right corner of the panel, in world units.
        anchor: { x: number; y: number };
        z?: number;
    } = $props();

    const panelW = $derived(visibleHeight * PANEL_WIDTH_FRACTION);
    const rowH = $derived(visibleHeight * ROW_HEIGHT_FRACTION);
    const pad = $derived(visibleHeight * PADDING_FRACTION);
    const titleH = $derived(visibleHeight * TITLE_HEIGHT_FRACTION);
    const panelH = $derived(titleH + characters.length * rowH + pad * 2);
    const title = $derived.by(() => {
        const hasLoric = characters.some(c => c.category === "loric");
        const hasFabled = characters.some(c => c.category === "fabled");
        return hasLoric && hasFabled ? "Loric & Fabled" : hasFabled ? "Fabled" : "Loric";
    });
    const centerX = $derived(anchor.x - panelW / 2);
    const centerY = $derived(anchor.y - panelH / 2);

    const canvas: HTMLCanvasElement = document.createElement("canvas");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // The canvas is sized to the number of rows, so the parent re-creates this component when that changes.
    onDestroy(() => texture.dispose());

    let fontReady = $state(typeof document !== "undefined" && document.fonts.check(`16px "Dumbledore"`));
    $effect(() => {
        if (fontReady) return;
        document.fonts
            .load(`${FONT_WEIGHT} 16px "Dumbledore"`)
            .then(() => (fontReady = true))
            .catch(() => (fontReady = true));
    });

    // Character icons, loaded as needed; `imageVersion` re-runs the draw when one arrives.
    const images = new Map<string, HTMLImageElement>();
    let imageVersion = $state(0);
    $effect(() => {
        for (const { id } of characters) {
            if (images.has(id)) continue;
            const img = new Image();
            img.onload = () => { imageVersion++; };
            img.src = `/api/characters/${id}/img`;
            images.set(id, img);
        }
    });

    $effect(() => {
        void fontReady;
        void imageVersion;

        const k = CANVAS_WIDTH / panelW; // canvas px per world unit
        canvas.width = CANVAS_WIDTH;
        canvas.height = Math.max(1, Math.round(panelH * k));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Backing plate.
        ctx.beginPath();
        ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, pad * k);
        ctx.fillStyle = "rgba(28, 20, 13, 0.88)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(201, 194, 163, 0.45)";
        ctx.stroke();

        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${FONT_WEIGHT} ${titleH * k * 0.6}px ${FONT_FAMILY}`;
        ctx.fillText(title.toUpperCase(), canvas.width / 2, (pad + titleH / 2) * k);
        // Rule under the title.
        ctx.fillStyle = "rgba(201, 194, 163, 0.35)";
        ctx.fillRect(pad * k, (pad + titleH) * k - 1, canvas.width - pad * k * 2, 2);

        characters.forEach((character, i) => {
            const top = (pad + titleH + i * rowH) * k;
            const h = rowH * k;
            const iconR = h * 0.4;
            const iconX = pad * k + iconR + h * 0.05;
            const iconY = top + h / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
            ctx.clip();
            const img = images.get(character.id);
            if (img?.complete && img.naturalWidth > 0) {
                const side = iconR * 2 * 1.5;
                ctx.drawImage(img, iconX - side / 2, iconY - side / 2, side, side);
            } else {
                ctx.fillStyle = "#f3e9d2";
                ctx.fillRect(iconX - iconR, iconY - iconR, iconR * 2, iconR * 2);
            }
            ctx.restore();

            const textX = iconX + iconR + h * 0.18;
            const maxW = canvas.width - textX - pad * k;
            const text = character.name.toUpperCase();
            let fontPx = h * 0.42;
            ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
            const w = ctx.measureText(text).width;
            if (w > maxW) {
                fontPx *= maxW / w;
                ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
            }
            ctx.fillStyle = TEXT_COLOR;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, textX, iconY);
        });

        texture.needsUpdate = true;
    });
</script>

<T.Mesh position={[centerX, centerY, z]}>
    <T.PlaneGeometry args={[panelW, panelH]} />
    <T.MeshBasicMaterial map={texture} transparent depthWrite={false} />
</T.Mesh>
