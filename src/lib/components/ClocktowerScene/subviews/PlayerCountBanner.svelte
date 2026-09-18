<script lang="ts" module>
    export type PlayerCounts = {
        townsfolk: number;
        outsiders: number;
        minions: number;
        demons: number;
    };
</script>

<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import bannerTextureUrl from "$lib/assets/clocktower-scene/billboard.png";
    import bannerNormalMapUrl from "$lib/assets/clocktower-scene/billboard_normal.png";
    import SmallBanner from "./SmallBanner.svelte";
    import SlotLabel from "./SlotLabel.svelte";

    // ---------------------------------------------------------------------
    // Layout margins - tweak these freely.
    //
    // SLOT_MARGIN insets the row of SmallBanner slots from the background
    // banner's own edges, as a fraction of the banner's width/height
    // (0 = flush to the edge, 0.5 = half way to the centre). The banner art
    // has decorative borders, so the slots are pulled well inside them.
    //
    // SLOT_GAP is the horizontal space between adjacent slots, as a fraction
    // of the background banner's width.
    //
    // SLOT_Z_LIFT pushes the SmallBanners in front of the background plane.
    // ---------------------------------------------------------------------
    const SLOT_MARGIN = {
        top: 0.7,
        right: 0.18,
        bottom: 0.65,
        left: 0.18
    };
    const SLOT_GAP = 0.02;
    const SLOT_Z_LIFT = 0.02;

    // The classifier label ("TOWNSFOLK", "OUTSIDERS", ...) drawn just below
    // each SmallBanner slot. Height is a fraction of the slot's own width;
    // LABEL_GAP is the space between the slot's bottom and the label's top,
    // both as fractions of the background banner's height. SmallBanner's own
    // aspect (width / height) is needed to find the slot's bottom edge - keep
    // in sync with BannerSmall.png's real dimensions if that asset changes.
    const SMALL_BANNER_ASPECT = 512 / 543;
    const LABEL_HEIGHT_FRACTION = 0.18;
    const LABEL_GAP = -0.06;

    // Font-fitting constants shared with SlotLabel.svelte, used below to work
    // out one font size that fits every label (rather than letting each
    // label auto-fit independently and end up at different sizes).
    const LABEL_FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const LABEL_FONT_WEIGHT = "400";
    const LABEL_MAX_FONT_PX = 220;
    const LABEL_MIN_FONT_PX = 24;
    const LABEL_CANVAS_HEIGHT = 256;

    // ---------------------------------------------------------------------
    // Title text ("PLAYER COUNT") drawn onto its own overlay canvas, laid
    // over the billboard in the strip reserved above the slots by
    // SLOT_MARGIN.top. Same canvas-texture technique as TextBanner/
    // SmallBanner.
    // ---------------------------------------------------------------------
    const TITLE_TEXT = "Player Count";
    const TITLE_MARGIN = {
        top: 0.07,
        right: SLOT_MARGIN.right,
        bottom: 1 - SLOT_MARGIN.top + 0.03,
        left: SLOT_MARGIN.left
    };
    const TITLE_FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const TITLE_FONT_WEIGHT = "400";
    const TITLE_UPPERCASE = true;
    const TITLE_TEXT_COLOR = "#c9c2a3";
    // Drop shadow so the text reads as sitting in the scene rather than
    // floating flat above the banner. Offsets/blur are in the working
    // canvas's own pixels (TITLE_CANVAS_HEIGHT tall).
    const TITLE_SHADOW_COLOR = "rgba(0, 0, 0, 0.6)";
    const TITLE_SHADOW_BLUR = 10;
    const TITLE_SHADOW_OFFSET_X = 0;
    const TITLE_SHADOW_OFFSET_Y = 6;
    const TITLE_MAX_FONT_PX = 70;
    const TITLE_MIN_FONT_PX = 24;
    const TITLE_CANVAS_HEIGHT = 1024;

    // The classifiers, in display order. The number is shown as the
    // SmallBanner's big glyph; the classifier word itself (`key`) is drawn
    // as a SlotLabel below it (both upper-case it), all in LABEL_TEXT_COLOR.
    const ENTRIES: { key: keyof PlayerCounts }[] = [
        { key: "townsfolk" },
        { key: "outsiders" },
        { key: "minions" },
        { key: "demons" }
    ];

    // Same silver used for the "Player Count" title, so the classifier
    // labels read as part of one consistent metal-on-wood text style.
    const LABEL_TEXT_COLOR = "#c9c2a3";

    // The camera is always centred on world (0,0) and shows `visibleHeight`
    // world-units vertically; the visible width is about `visibleHeight * 2`
    // (see the `horizontalOffset` note in ClocktowerScene.svelte).
    const SCREEN_WIDTH_FACTOR = 2;

    let {
        counts,
        visibleHeight,
        // Background banner width as a fraction of the visible screen width.
        widthFraction = 1 / 2,
        // Centre of the banner, as a fraction of the screen width (x) and of
        // `visibleHeight` (y), measured from dead centre.
        offsetX = 0,
        offsetY = -0.32,
        z = 0.2,
        // Explicit world-space placement. When set it overrides the screen-
        // relative `widthFraction` / `offsetX` / `offsetY` maths above - used
        // when a parent node (e.g. GameStatsPanel) lays several banners out
        // itself. `width` is the background plane width in world units; the
        // height follows the texture aspect. `x` / `y` are its centre.
        placement
    }: {
        counts: PlayerCounts;
        visibleHeight: number;
        widthFraction?: number;
        offsetX?: number;
        offsetY?: number;
        z?: number;
        placement?: { x: number; y: number; width: number };
    } = $props();

    const screenWidth = $derived(visibleHeight * SCREEN_WIDTH_FACTOR);

    const bannerTexture = useTexture(untrack(() => bannerTextureUrl));
    const bannerNormalTexture = useTexture(untrack(() => bannerNormalMapUrl));

    $effect(() => {
        // Albedo textures need to be interpreted as sRGB; the normal map must
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

    // World-space placement for each SmallBanner slot: four evenly spaced
    // columns inside the inset area, vertically centred in it.
    const slots = $derived.by(() => {
        const areaLeft = x - planeWidth / 2 + planeWidth * SLOT_MARGIN.left;
        const areaW =
            planeWidth * (1 - SLOT_MARGIN.left - SLOT_MARGIN.right);
        const gap = planeWidth * SLOT_GAP;
        const slotW = (areaW - gap * (ENTRIES.length - 1)) / ENTRIES.length;

        const areaTop = y + planeHeight / 2 - planeHeight * SLOT_MARGIN.top;
        const areaBottom = y - planeHeight / 2 + planeHeight * SLOT_MARGIN.bottom;
        const slotY = (areaTop + areaBottom) / 2;
        const slotH = slotW / SMALL_BANNER_ASPECT;
        const slotBottom = slotY - slotH / 2;

        const labelH = planeHeight * LABEL_HEIGHT_FRACTION;
        const labelGap = planeHeight * LABEL_GAP;
        const labelY = slotBottom - labelGap - labelH / 2;

        return ENTRIES.map((entry, i) => {
            const slotX = areaLeft + slotW / 2 + i * (slotW + gap);
            return {
                entry,
                placement: { x: slotX, y: slotY, width: slotW },
                labelPlacement: { x: slotX, y: labelY, width: slotW },
                labelHeight: labelH
            };
        });
    });

    // "Dumbledore" is a webfont; if the canvas draws before it's parsed the
    // browser silently falls back to serif. Ask for it explicitly and flip
    // this once it's ready so the draw effect below re-runs with the real
    // face. Starts true when the font is already cached from elsewhere in
    // the app.
    let titleFontReady = $state(
        typeof document !== "undefined" && document.fonts.check(`16px "Dumbledore"`)
    );
    $effect(() => {
        if (titleFontReady) return;
        document.fonts
            .load(`${TITLE_FONT_WEIGHT} 16px "Dumbledore"`)
            .then(() => (titleFontReady = true))
            .catch(() => (titleFontReady = true));
    });

    // One shared font size for every slot label, instead of each SlotLabel
    // auto-fitting on its own and ending up at different sizes for shorter
    // vs. longer words ("Demons" vs. "Townsfolk"): fit against the longest
    // label at the shared slot width, then hand that size to every SlotLabel.
    const labelScratchCanvas: HTMLCanvasElement | null =
        typeof document !== "undefined" ? document.createElement("canvas") : null;

    const labelFontPx = $derived.by(() => {
        void titleFontReady;

        const ctx = labelScratchCanvas?.getContext("2d");
        const slot = slots[0];
        if (!ctx || !slot) return LABEL_MAX_FONT_PX;

        const canvasWidth = Math.round(
            LABEL_CANVAS_HEIGHT * (slot.labelPlacement.width / slot.labelHeight)
        );

        let fontPx = LABEL_MAX_FONT_PX;
        while (fontPx >= LABEL_MIN_FONT_PX) {
            ctx.font = `${LABEL_FONT_WEIGHT} ${fontPx}px ${LABEL_FONT_FAMILY}`;
            const fits = ENTRIES.every(
                (entry) => ctx.measureText(entry.key.toUpperCase()).width <= canvasWidth
            );
            if (fits) break;
            fontPx -= 4;
        }
        return fontPx;
    });

    // The title is drawn onto its own transparent canvas, laid over the
    // billboard as a second plane a hair in front - same canvas-texture
    // technique used for TextBanner/SmallBanner.
    const titleCanvas: HTMLCanvasElement = document.createElement("canvas");
    const titleTexture = new THREE.CanvasTexture(titleCanvas);
    titleTexture.colorSpace = THREE.SRGBColorSpace;
    titleTexture.generateMipmaps = false;
    titleTexture.minFilter = THREE.LinearFilter;
    titleTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        // Re-runs when `titleFontReady` flips so the text is redrawn in the
        // real Dumbledore face instead of the serif fallback.
        void titleFontReady;

        const ratio = aspect;
        const height = TITLE_CANVAS_HEIGHT;
        const width = Math.round(height * ratio);
        titleCanvas.width = width;
        titleCanvas.height = height;

        const ctx = titleCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        const text = TITLE_UPPERCASE ? TITLE_TEXT.toUpperCase() : TITLE_TEXT;

        const boxX = width * TITLE_MARGIN.left;
        const boxY = height * TITLE_MARGIN.top;
        const boxW = width * (1 - TITLE_MARGIN.left - TITLE_MARGIN.right);
        const boxH = height * (1 - TITLE_MARGIN.top - TITLE_MARGIN.bottom);

        let fontPx = TITLE_MAX_FONT_PX;
        while (fontPx >= TITLE_MIN_FONT_PX) {
            ctx.font = `${TITLE_FONT_WEIGHT} ${fontPx}px ${TITLE_FONT_FAMILY}`;
            const w = ctx.measureText(text).width;
            const h = fontPx * 0.8;
            if (w <= boxW && h <= boxH) break;
            fontPx -= 4;
        }

        ctx.font = `${TITLE_FONT_WEIGHT} ${fontPx}px ${TITLE_FONT_FAMILY}`;
        ctx.fillStyle = TITLE_TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = TITLE_SHADOW_COLOR;
        ctx.shadowBlur = TITLE_SHADOW_BLUR;
        ctx.shadowOffsetX = TITLE_SHADOW_OFFSET_X;
        ctx.shadowOffsetY = TITLE_SHADOW_OFFSET_Y;
        ctx.fillText(text, boxX + boxW / 2, boxY + boxH / 2);
        ctx.shadowColor = "transparent";

        titleTexture.needsUpdate = true;
    });
</script>

<!-- MeshStandardMaterial (like the tower / TextBanner) so the scene's
     sun/moon directional lights and Sky ambient fill wash over the banner
     rather than leaving it flatly lit. -->
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
            map={titleTexture}
            transparent
            depthWrite={false}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>

    {#each slots as slot (slot.entry.key)}
        <SlotLabel
            text={slot.entry.key}
            color={LABEL_TEXT_COLOR}
            placement={slot.labelPlacement}
            height={slot.labelHeight}
            fontPx={labelFontPx}
            z={z + SLOT_Z_LIFT}
        />
        <SmallBanner
            text={String(counts[slot.entry.key] ?? 0)}
            {visibleHeight}
            placement={slot.placement}
            z={z + SLOT_Z_LIFT}
        />
    {/each}
{/if}
