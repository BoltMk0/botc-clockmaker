<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import bannerTextureUrl from "$lib/assets/clocktower-scene/banner_large_2.png";
    import bannerNormalMapUrl from "$lib/assets/clocktower-scene/banner_large_2_normal.png";

    // ---------------------------------------------------------------------
    // Content margins / text styling - tweak these freely.
    //
    // CONTENT_MARGIN insets the text area from the banner's edges, as a
    // fraction of the banner's own width/height (0 = flush to the edge,
    // 0.5 = half way to the centre). The banner art usually has decorative
    // borders, so the text should be pulled well inside them.
    // ---------------------------------------------------------------------
    const CONTENT_MARGIN = {
        top: 0.11,
        right: 0.14,
        bottom: 0.15,
        left: 0.14
    };

    // Font stack used to render the text onto the canvas overlay; this is a
    // plain canvas 2d `font`. "Dumbledore" is the app-wide display face
    // (see `.dumbledore-font` / `--font-dumbledore` in src/routes/style.css,
    // loaded from /fonts/dum1.ttf). It's a webfont, so the canvas is
    // redrawn once `document.fonts` confirms it has loaded (see below).
    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const FONT_WEIGHT = "400";
    // The app always sets `text-transform: uppercase` alongside this font.
    const UPPERCASE = true;
    const TEXT_COLOR = "#c9c2a3";
    const TEXT_ALIGN: CanvasTextAlign = "center"; // "left" | "center" | "right"
    const LINE_HEIGHT = 1.18; // multiple of the font size
    // The text auto-shrinks to fit the content box; it never grows past this
    // (expressed against the 1024px-tall working canvas below). Set high so
    // the text fills the content box - the fit loop clamps it to whatever
    // actually fits.
    const MAX_FONT_PX = 600;
    const MIN_FONT_PX = 24;
    // Applied to the fitted font size after the auto-shrink loop below, so
    // the main value can be tuned independently of how much of the content
    // box it would otherwise fill. The subtitle is unaffected by this (see
    // `fittedFontPx` below).
    const TEXT_SIZE_SCALE = 0.88;

    // Optional subtitle, drawn along the bottom of the content box in the
    // same face but much smaller. SUBTITLE_AREA_FRACTION reserves that slice
    // of the content box's height for it (the main text fits into what's
    // left, minus SUBTITLE_GAP_FRACTION of breathing room); the subtitle
    // auto-shrinks to fit that slice just like the main text does.
    const SUBTITLE_AREA_FRACTION = 0.15;
    const SUBTITLE_GAP_FRACTION = -0.01;
    // Starting subtitle size as a fraction of the fitted main font size.
    const SUBTITLE_FONT_SCALE = 0.23;
    // Vertical nudge for the subtitle, as a fraction of the content box
    // height; +down, negative lifts it toward the main text.
    const SUBTITLE_VERTICAL_NUDGE = -0.14;
    const SUBTITLE_MIN_FONT_PX = 12;

    // Working resolution of the overlay canvas. Width is derived from the
    // banner image's aspect ratio once it loads.
    const CANVAS_HEIGHT = 1024;

    // The camera is always centred on world (0,0) and shows `visibleHeight`
    // world-units vertically; the rest of the scene assumes a roughly 2:1
    // canvas, i.e. the visible width is about `visibleHeight * 2` (see the
    // `horizontalOffset` note in ClocktowerScene.svelte). Placement below is
    // expressed against that estimated screen width so "left two thirds"
    // etc. line up with what's actually on screen.
    const SCREEN_WIDTH_FACTOR = 2;

    let {
        content,
        subtitle,
        visibleHeight,
        // Banner width as a fraction of the visible screen width. 2/3 fills
        // the left two thirds of the screen.
        widthFraction = 1 / 4,
        // Centre of the banner, as a fraction of the screen width (x) and of
        // `visibleHeight` (y), measured from dead centre. The default centres
        // the banner within the left two thirds (its midpoint sits one sixth
        // of the screen width left of centre) and lifts it above the middle.
        offsetX = -1 / 6,
        offsetY = 0.28,
        z = 0.2,
        // Explicit world-space placement. When set it overrides the screen-
        // relative `widthFraction` / `offsetX` / `offsetY` maths above - used
        // when a parent node (e.g. GameStatsPanel) lays several banners out
        // itself. `width` is the plane width in world units; the height
        // follows the texture aspect. `x` / `y` are the plane centre.
        placement
    }: {
        content: string;
        subtitle?: string;
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
    const bannerNormalTexture = useTexture(untrack(() => bannerNormalMapUrl));

    $effect(() => {
        // Albedo texture needs to be interpreted as sRGB; the normal map must
        // stay in linear space, which is three's default, so it's untouched.
        if ($bannerTexture && $bannerTexture.colorSpace !== THREE.SRGBColorSpace) {
            $bannerTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    const aspect = $derived(
        $bannerTexture?.image
            ? $bannerTexture.image.width / $bannerTexture.image.height
            : 4 / 1
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

        const text = UPPERCASE ? (content ?? "").toUpperCase() : (content ?? "");

        const subtitleText = UPPERCASE
            ? (subtitle ?? "").toUpperCase()
            : (subtitle ?? "");
        const hasSubtitle = subtitleText.trim().length > 0;

        const boxX = width * CONTENT_MARGIN.left;
        const boxY = height * CONTENT_MARGIN.top;
        const boxW = width * (1 - CONTENT_MARGIN.left - CONTENT_MARGIN.right);
        const boxH = height * (1 - CONTENT_MARGIN.top - CONTENT_MARGIN.bottom);

        // With a subtitle, reserve a slice of the content box for it along the
        // bottom and fit the main text into what's left (minus a small gap).
        const subtitleAreaH = hasSubtitle ? boxH * SUBTITLE_AREA_FRACTION : 0;
        const gapH = hasSubtitle ? boxH * SUBTITLE_GAP_FRACTION : 0;
        const mainBoxH = boxH - subtitleAreaH - gapH;

        // Shrink the font until the wrapped block fits the (main) content box.
        let fontPx = MAX_FONT_PX;
        let lines: string[] = [];
        while (fontPx >= MIN_FONT_PX) {
            ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
            lines = wrapLines(ctx, text, boxW);
            const widest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
            const blockH = lines.length * fontPx * LINE_HEIGHT;
            if (widest <= boxW && blockH <= mainBoxH) break;
            fontPx -= 4;
        }
        // The subtitle is sized off the fitted-but-unscaled value so it
        // doesn't grow/shrink along with TEXT_SIZE_SCALE adjustments to the
        // main text.
        const fittedFontPx = fontPx;
        fontPx = Math.max(MIN_FONT_PX, Math.round(fontPx * TEXT_SIZE_SCALE));

        ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = TEXT_ALIGN;
        ctx.textBaseline = "middle";

        const lineStep = fontPx * LINE_HEIGHT;
        const align: string = TEXT_ALIGN;
        const anchorX = align === "left" ? boxX : align === "right" ? boxX + boxW : boxX + boxW / 2;
        // Always centre the main block in the full content box so it stays put
        // whether or not there's a subtitle. It's still *sized* to fit
        // `mainBoxH`, which leaves clear space below it for the subtitle.
        let cursorY = boxY + boxH / 2 - (lines.length - 1) * lineStep * 0.5;
        for (const line of lines) {
            ctx.fillText(line, anchorX, cursorY);
            cursorY += lineStep;
        }

        if (hasSubtitle) {
            // Sit the subtitle just below the main block's actual bottom edge
            // (plus `gapH`), so the main text keeps its normal centred position
            // and only a small gap separates the two.
            const mainBlockBottom = boxY + boxH / 2 + (lines.length * lineStep) / 2;
            const subAreaTop = mainBlockBottom + gapH + boxH * SUBTITLE_VERTICAL_NUDGE;
            const subAvailH = Math.min(subtitleAreaH, boxY + boxH - subAreaTop);

            // Same face, much smaller: start from a fraction of the fitted
            // main size and shrink further until it fits the space below.
            let subFontPx = Math.min(
                MAX_FONT_PX,
                Math.max(SUBTITLE_MIN_FONT_PX, Math.round(fittedFontPx * SUBTITLE_FONT_SCALE))
            );
            let subLines: string[] = [];
            while (subFontPx >= SUBTITLE_MIN_FONT_PX) {
                ctx.font = `${FONT_WEIGHT} ${subFontPx}px ${FONT_FAMILY}`;
                subLines = wrapLines(ctx, subtitleText, boxW);
                const widest = Math.max(0, ...subLines.map((l) => ctx.measureText(l).width));
                const blockH = subLines.length * subFontPx * LINE_HEIGHT;
                if (widest <= boxW && blockH <= subAvailH) break;
                subFontPx -= 2;
            }

            ctx.font = `${FONT_WEIGHT} ${subFontPx}px ${FONT_FAMILY}`;
            ctx.fillStyle = TEXT_COLOR;
            ctx.textAlign = TEXT_ALIGN;
            ctx.textBaseline = "middle";

            const subLineStep = subFontPx * LINE_HEIGHT;
            let subCursorY = subAreaTop + subLineStep / 2;
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
{#if $bannerTexture && $bannerNormalTexture}
    <T.Mesh position={[x, y, z]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$bannerTexture}
            normalMap={$bannerNormalTexture}
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
