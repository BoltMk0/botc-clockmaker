<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";
    import QRCode from "qrcode";
    import { page } from "$app/state";

    // A QR code + title rendered as a lit plane in the 3D scene (rather than
    // the DOM overlay used elsewhere - see SiteQRCode.svelte) so it can sit
    // at a fixed depth relative to other scene objects - in particular
    // behind the player seat tokens (see SceneQrCodes.svelte's `z`), so a
    // seated token drawn in front of it actually occludes it instead of the
    // two competing as separate DOM/canvas layers.

    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    // Same pale-on-dark scheme as SiteQRCode.svelte's defaults (dark = the
    // pale foreground/module colour, light = the dark card background).
    const DARK = "#EEE";
    const LIGHT = "#444";
    const CANVAS_SIZE = 512;
    const PADDING = 32;
    const CORNER_RADIUS = 32;
    const FONT_PX = 60; // 2x the original 30px
    const LINE_HEIGHT = FONT_PX * 1.15;
    // Gap above the title text (top of the card) and below it (before the QR
    // image) - kept separate so the top can be opened up without also
    // pushing the QR image further down.
    const TITLE_TOP_PADDING = 40;
    const TITLE_BOTTOM_PADDING = 20;
    const TITLE_MAX_WIDTH = CANVAS_SIZE - PADDING * 2;
    // Side length of the QR image itself - kept square and inset by
    // `PADDING` on every side (left/right/bottom) so the padding around it
    // reads as even.
    const QR_SIZE = CANVAS_SIZE - PADDING * 2;

    let {
        path,
        title,
        placement,
        z = 0.05
    }: {
        path: string;
        title: string;
        placement: { x: number; y: number; width: number };
        z?: number;
    } = $props();

    const url = $derived(new URL(path, page.url.origin).href);

    const canvas: HTMLCanvasElement = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    let ready = $state(false);
    // Tracks canvas.height as state, since the canvas itself isn't reactive
    // - the aspect ratio below needs to re-derive whenever the title wraps
    // to a different number of lines and the canvas is resized to fit.
    let canvasAspect = $state(1);

    function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return [""];
        const lines: string[] = [];
        let current = words[0];
        for (let i = 1; i < words.length; i++) {
            const candidate = `${current} ${words[i]}`;
            if (ctx.measureText(candidate).width <= maxWidth) {
                current = candidate;
            } else {
                lines.push(current);
                current = words[i];
            }
        }
        lines.push(current);
        return lines;
    }

    function draw(qrImage: HTMLImageElement, label: string) {
        const measureCtx = canvas.getContext("2d");
        if (!measureCtx) return;
        measureCtx.font = `700 ${FONT_PX}px ${FONT_FAMILY}`;
        const lines = wrapLines(measureCtx, label, TITLE_MAX_WIDTH);
        const titleHeight = TITLE_TOP_PADDING + lines.length * LINE_HEIGHT + TITLE_BOTTOM_PADDING;

        // Bottom padding below the QR image matches PADDING on the sides,
        // rather than doubling up the way a plain `CANVAS_SIZE + titleHeight`
        // canvas would (QR_SIZE is already inset by PADDING on each side).
        canvas.height = titleHeight + QR_SIZE + PADDING;
        canvasAspect = canvas.height / canvas.width;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Round the card's corners by only filling inside a rounded-rect
        // path, leaving the canvas (and so the plane's texture) transparent
        // outside it instead of drawing a square card with square corners.
        ctx.fillStyle = LIGHT;
        ctx.beginPath();
        ctx.roundRect(0, 0, canvas.width, canvas.height, CORNER_RADIUS);
        ctx.fill();

        ctx.fillStyle = DARK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${FONT_PX}px ${FONT_FAMILY}`;
        const firstLineY = TITLE_TOP_PADDING + LINE_HEIGHT / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line, canvas.width / 2, firstLineY + i * LINE_HEIGHT);
        });

        ctx.drawImage(qrImage, PADDING, titleHeight, QR_SIZE, QR_SIZE);

        texture.needsUpdate = true;
        ready = true;
    }

    $effect(() => {
        const target = url;
        const label = title.toUpperCase();
        QRCode.toDataURL(target, {
            margin: 1,
            width: QR_SIZE,
            errorCorrectionLevel: "M",
            color: { dark: DARK, light: LIGHT }
        })
            .then((src) => {
                const img = new Image();
                img.onload = () => draw(img, label);
                img.src = src;
            })
            .catch(() => {});
    });

    const planeWidth = $derived(placement.width);
    const planeHeight = $derived(planeWidth * canvasAspect);
</script>

{#if ready}
    <T.Mesh position={[placement.x, placement.y, z]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshBasicMaterial map={texture} transparent depthWrite={false} />
    </T.Mesh>
{/if}
