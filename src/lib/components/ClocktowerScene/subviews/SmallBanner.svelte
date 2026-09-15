<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import bannerTextureUrl from "$lib/assets/clocktower-scene/BannerSmall.png";

    // ---------------------------------------------------------------------
    // Content margins / text styling - tweak these freely.
    //
    // CONTENT_MARGIN insets the text area from the banner's edges, as a
    // fraction of the banner's own width/height (0 = flush to the edge,
    // 0.5 = half way to the centre). The banner art has decorative borders,
    // so the text should be pulled well inside them.
    // ---------------------------------------------------------------------
    const CONTENT_MARGIN = {
        top: 0.1,
        right: 0.12,
        bottom: 0.24,
        left: 0.12
    };

    // The content box is split top-to-bottom into a big single-glyph area
    // and a smaller subtext area, with a gap between them. All three are
    // fractions of the content box height and should add up to <= 1.
    const MAIN_AREA_FRACTION = 0.56;
    const GAP_FRACTION = 0.0;
    const SUBTEXT_AREA_FRACTION = 0.28;
    // When there is no subtext, the main glyph gets the whole content box.
    // This nudges it back up so it still reads as vertically centred against
    // the banner art rather than sinking toward the middle.
    const MAIN_ONLY_VERTICAL_NUDGE = 0.0; // fraction of content box height, +down
    // Fine vertical nudges applied only when a subtext is present. Both are
    // fractions of the content box height; +down. Positive MAIN pushes the
    // big glyph lower; negative SUBTEXT lifts the subtext toward it.
    const MAIN_VERTICAL_NUDGE = 0.0;
    const SUBTEXT_VERTICAL_NUDGE = -0.05;

    // Font stack used to render the text onto the canvas overlay; this is a
    // plain canvas 2d `font`. "Dumbledore" is the app-wide display face
    // (see `.dumbledore-font` / `--font-dumbledore` in src/routes/style.css,
    // loaded from /fonts/dum1.ttf). It's a webfont, so the canvas is
    // redrawn once `document.fonts` confirms it has loaded (see below).
    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const FONT_WEIGHT = "700";
    // The app always sets `text-transform: uppercase` alongside this font.
    const UPPERCASE = true;
    const TEXT_COLOR = "#3a2c22";
    // Nudges the fitted main-glyph size up a touch beyond what the fit loop
    // lands on, since that loop is conservative about slack near the edges.
    const MAIN_FONT_SCALE = 1.1;
    // Default subtext colour; overridden per-instance via the `subtextColor`
    // prop when set.
    const SUBTEXT_COLOR = "#2b1d10";
    const TEXT_ALIGN: CanvasTextAlign = "center"; // "left" | "center" | "right"
    const LINE_HEIGHT = 1.15; // multiple of the font size

    // The big glyph auto-shrinks to fit its area; it never grows past this
    // (expressed against the working canvas below). Set high so it fills the
    // area - the fit loop clamps it to whatever actually fits.
    const MAIN_MAX_FONT_PX = 520;
    const MAIN_MIN_FONT_PX = 24;

    // The subtext auto-shrinks to fit its slice, wrapping if needed.
    const SUBTEXT_MAX_FONT_PX = 130;
    const SUBTEXT_MIN_FONT_PX = 12;

    // Working resolution of the overlay canvas. Width is derived from the
    // banner image's aspect ratio once it loads.
    const CANVAS_HEIGHT = 1024;

    // The camera is always centred on world (0,0) and shows `visibleHeight`
    // world-units vertically; the visible width is about `visibleHeight * 2`
    // (see the `horizontalOffset` note in ClocktowerScene.svelte). Placement
    // below is expressed against that estimated screen width.
    const SCREEN_WIDTH_FACTOR = 2;

    let {
        text,
        subtext,
        subtextColor,
        visibleHeight,
        // Banner width as a fraction of the visible screen width.
        widthFraction = 1 / 8,
        // Centre of the banner, as a fraction of the screen width (x) and of
        // `visibleHeight` (y), measured from dead centre.
        offsetX = -1 / 6,
        offsetY = 0.28,
        z = 0.2,
        // Explicit world-space placement. When set it overrides the screen-
        // relative `widthFraction` / `offsetX` / `offsetY` maths above - used
        // when a parent node (e.g. PlayerCountBanner) lays several of these
        // out itself. `width` is the plane width in world units; the height
        // follows the texture aspect. `x` / `y` are the plane centre.
        placement
    }: {
        text: string;
        subtext?: string;
        subtextColor?: string;
        visibleHeight: number;
        widthFraction?: number;
        offsetX?: number;
        offsetY?: number;
        z?: number;
        placement?: { x: number; y: number; width: number };
    } = $props();

    const screenWidth = $derived(visibleHeight * SCREEN_WIDTH_FACTOR);

    // "Dumbledore" is a webfont; if the canvas draws before it's parsed the
    // browser silently falls back to serif. Ask for it explicitly and flip
    // this once it's ready so the draw effect below re-runs with the real
    // face. Starts true when the font is already cached from elsewhere in
    // the app.
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

    const bannerTexture = useTexture(untrack(() => bannerTextureUrl));

    $effect(() => {
        if ($bannerTexture && $bannerTexture.colorSpace !== THREE.SRGBColorSpace) {
            $bannerTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    const aspect = $derived(
        $bannerTexture?.image
            ? $bannerTexture.image.width / $bannerTexture.image.height
            : 1 / 1
    );

    const planeWidth = $derived(placement ? placement.width : screenWidth * widthFraction);
    const planeHeight = $derived(planeWidth / aspect);
    const x = $derived(placement ? placement.x : screenWidth * offsetX);
    const y = $derived(placement ? placement.y : visibleHeight * offsetY);

    // The text is drawn onto its own transparent canvas, laid over the
    // banner as a second plane a hair in front - same canvas-texture
    // technique used for the clock numerals and sky gradients.
    const textCanvas: HTMLCanvasElement = document.createElement("canvas");
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    textTexture.generateMipmaps = false;
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.magFilter = THREE.LinearFilter;

    function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const lines: string[] = [];
        for (const paragraph of text.split("\n")) {
            const words = paragraph.split(/\s+/).filter(Boolean);
            if (words.length === 0) {
                lines.push("");
                continue;
            }
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
        }
        return lines;
    }

    $effect(() => {
        // Re-runs when `fontReady` flips so the text is redrawn in the real
        // Dumbledore face instead of the serif fallback.
        void fontReady;

        const ratio = aspect;
        const height = CANVAS_HEIGHT;
        const width = Math.round(height * ratio);
        textCanvas.width = width;
        textCanvas.height = height;

        const ctx = textCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        const mainText = UPPERCASE ? (text ?? "").toUpperCase() : (text ?? "");
        const subText = UPPERCASE ? (subtext ?? "").toUpperCase() : (subtext ?? "");
        const hasSub = subText.trim().length > 0;

        const boxX = width * CONTENT_MARGIN.left;
        const boxY = height * CONTENT_MARGIN.top;
        const boxW = width * (1 - CONTENT_MARGIN.left - CONTENT_MARGIN.right);
        const boxH = height * (1 - CONTENT_MARGIN.top - CONTENT_MARGIN.bottom);

        // Vertical layout of the content box.
        const mainAreaH = hasSub ? boxH * MAIN_AREA_FRACTION : boxH;
        const gapH = hasSub ? boxH * GAP_FRACTION : 0;
        const subAreaH = hasSub ? boxH * SUBTEXT_AREA_FRACTION : 0;
        const mainNudge = hasSub ? boxH * MAIN_VERTICAL_NUDGE : boxH * MAIN_ONLY_VERTICAL_NUDGE;
        const subNudge = hasSub ? boxH * SUBTEXT_VERTICAL_NUDGE : 0;
        const mainAreaTop = boxY + mainNudge;
        const subAreaTop = boxY + mainAreaH + gapH;

        const align: string = TEXT_ALIGN;
        const anchorX =
            align === "left" ? boxX : align === "right" ? boxX + boxW : boxX + boxW / 2;

        // --- Big single glyph -------------------------------------------------
        let mainFontPx = MAIN_MAX_FONT_PX;
        while (mainFontPx >= MAIN_MIN_FONT_PX) {
            ctx.font = `${FONT_WEIGHT} ${mainFontPx}px ${FONT_FAMILY}`;
            const w = ctx.measureText(mainText).width;
            // Cap-height is roughly 0.7 of the font size for this face; keep a
            // little slack so tall glyphs don't kiss the area edges.
            const h = mainFontPx * 0.8;
            if (w <= boxW && h <= mainAreaH) break;
            mainFontPx -= 6;
        }
        mainFontPx = Math.round(mainFontPx * MAIN_FONT_SCALE);

        ctx.font = `${FONT_WEIGHT} ${mainFontPx}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = TEXT_ALIGN;
        ctx.textBaseline = "middle";
        ctx.fillText(mainText, anchorX, mainAreaTop + mainAreaH / 2);

        // --- Subtext --------------------------------------------------------
        if (hasSub) {
            let subFontPx = SUBTEXT_MAX_FONT_PX;
            let subLines: string[] = [];
            while (subFontPx >= SUBTEXT_MIN_FONT_PX) {
                ctx.font = `${FONT_WEIGHT} ${subFontPx}px ${FONT_FAMILY}`;
                subLines = wrapLines(ctx, subText, boxW);
                const widest = Math.max(0, ...subLines.map((l) => ctx.measureText(l).width));
                const blockH = subLines.length * subFontPx * LINE_HEIGHT;
                if (widest <= boxW && blockH <= subAreaH) break;
                subFontPx -= 2;
            }

            ctx.font = `${FONT_WEIGHT} ${subFontPx}px ${FONT_FAMILY}`;
            ctx.fillStyle = subtextColor ?? SUBTEXT_COLOR;
            ctx.textAlign = TEXT_ALIGN;
            ctx.textBaseline = "middle";

            const subLineStep = subFontPx * LINE_HEIGHT;
            let subCursorY =
                subAreaTop + subNudge + subAreaH / 2 - (subLines.length - 1) * subLineStep * 0.5;
            for (const line of subLines) {
                ctx.fillText(line, anchorX, subCursorY);
                subCursorY += subLineStep;
            }
        }

        textTexture.needsUpdate = true;
    });
</script>

<!-- Both planes use MeshStandardMaterial (like the tower) so the scene's
     sun/moon directional lights and Sky ambient fill wash over the banner
     and its text - it dims and warms/cools with the rest of the scene
     rather than sitting at a flat, fully-lit brightness. -->
{#if $bannerTexture}
    <T.Mesh position={[x, y, z]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$bannerTexture}
            transparent
            alphaTest={0.01}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>

    <T.Mesh position={[x, y, z + 0.01]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={textTexture}
            transparent
            depthWrite={false}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>
{/if}
