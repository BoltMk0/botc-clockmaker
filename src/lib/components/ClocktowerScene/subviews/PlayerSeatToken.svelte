<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import tokenTextureUrl from "$lib/assets/clocktower-scene/player_token.png";
    import tokenNormalMapUrl from "$lib/assets/clocktower-scene/player_token_normal.png";

    // A single seated player's token, rendered as a lit mesh (like every
    // other prop in this scene) rather than the DOM/CSS token used
    // elsewhere (PlayerToken.svelte) - see PlayerSeats.svelte, which lays
    // several of these out within the space GameStatsPanel frees up under
    // the day banner when a grim exists.

    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const FONT_WEIGHT = "700";
    // Same pale silver used for the day/time banner's text and the
    // population title (see TextBanner.svelte/PlayerCountBanner.svelte's
    // TEXT_COLOR), so player names read as part of the same signage system.
    const TEXT_COLOR = "#c9c2a3";
    const MAX_FONT_PX = 220;
    const MIN_FONT_PX = 40;
    // Inset from the token's own edge before text can be drawn, as a
    // fraction of the token's width/height - keeps names off the carved
    // wooden rim.
    const CONTENT_MARGIN = 0.22;

    const CANVAS_SIZE = 512;

    // Dead tokens fade out almost entirely...
    const DEAD_OPACITY = 0.28;
    // ...but the name stays at full opacity throughout (see `opacity` below,
    // only applied to the background/skull) with a drop shadow so it still
    // reads clearly once the wood behind it has faded, and a faint skull
    // glyph behind it, hand-drawn (rather than a Unicode/emoji glyph, whose
    // colour and even shape can't be relied on across platforms).
    const SKULL_COLOR = "rgba(255, 255, 255, 0.16)";
    const SKULL_SIZE_FRACTION = 0.62; // fraction of the token's own size
    const TEXT_SHADOW_COLOR = "rgba(0, 0, 0, 0.75)";
    const TEXT_SHADOW_BLUR_FRACTION = 0.1; // fraction of the fitted font size
    const TEXT_SHADOW_OFFSET_FRACTION = 0.03;

    let {
        playerName,
        isDead = false,
        placement,
        z = 0.2
    }: {
        playerName: string;
        isDead?: boolean;
        placement: { x: number; y: number; width: number };
        z?: number;
    } = $props();

    const tokenTexture = useTexture(untrack(() => tokenTextureUrl));
    const tokenNormalTexture = useTexture(untrack(() => tokenNormalMapUrl));

    $effect(() => {
        if ($tokenTexture && $tokenTexture.colorSpace !== THREE.SRGBColorSpace) {
            $tokenTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    const aspect = $derived(
        $tokenTexture?.image ? $tokenTexture.image.width / $tokenTexture.image.height : 1
    );

    const planeWidth = $derived(placement.width);
    const planeHeight = $derived(planeWidth / aspect);
    const x = $derived(placement.x);
    const y = $derived(placement.y);

    // "Dumbledore" is a webfont; if the canvas draws before it's parsed the
    // browser silently falls back to serif. Ask for it explicitly and flip
    // this once it's ready so the draw effects below re-run with the real
    // face.
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

    // The player's name, drawn onto its own transparent canvas laid over the
    // token background - same canvas-texture technique used throughout this
    // scene (SmallBanner, TextBanner, ...).
    const textCanvas: HTMLCanvasElement = document.createElement("canvas");
    textCanvas.width = CANVAS_SIZE;
    textCanvas.height = CANVAS_SIZE;
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.colorSpace = THREE.SRGBColorSpace;
    textTexture.generateMipmaps = false;
    textTexture.minFilter = THREE.LinearFilter;
    textTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        void fontReady;

        const ctx = textCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        const text = (playerName || "?").toUpperCase();
        const boxSize = CANVAS_SIZE * (1 - CONTENT_MARGIN * 2);
        const centerX = CANVAS_SIZE / 2;
        const centerY = CANVAS_SIZE / 2;

        let fontPx = MAX_FONT_PX;
        let lines: string[] = [];
        const lineHeight = 1.15;
        while (fontPx >= MIN_FONT_PX) {
            ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
            lines = wrapLines(ctx, text, boxSize);
            const widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
            const blockH = lines.length * fontPx * lineHeight;
            if (widest <= boxSize && blockH <= boxSize) break;
            fontPx -= 6;
        }

        ctx.font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // A drop shadow so the name stays legible over both the wood grain
        // and (when dead) the skull sitting behind it.
        ctx.shadowColor = TEXT_SHADOW_COLOR;
        ctx.shadowBlur = fontPx * TEXT_SHADOW_BLUR_FRACTION;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = fontPx * TEXT_SHADOW_OFFSET_FRACTION;

        const step = fontPx * lineHeight;
        let cursorY = centerY - ((lines.length - 1) * step) / 2;
        for (const line of lines) {
            ctx.fillText(line, centerX, cursorY);
            cursorY += step;
        }

        ctx.shadowColor = "transparent";
        textTexture.needsUpdate = true;
    });

    // The faint skull glyph shown behind a dead player's name - drawn once
    // per token (it doesn't depend on any reactive value), as a rounded
    // cranium with eye/nose sockets and a jaw punched out via
    // "destination-out", plus a few teeth gaps.
    const skullCanvas: HTMLCanvasElement = document.createElement("canvas");
    skullCanvas.width = CANVAS_SIZE;
    skullCanvas.height = CANVAS_SIZE;
    const skullTexture = new THREE.CanvasTexture(skullCanvas);
    skullTexture.generateMipmaps = false;
    skullTexture.minFilter = THREE.LinearFilter;
    skullTexture.magFilter = THREE.LinearFilter;

    (() => {
        const ctx = skullCanvas.getContext("2d");
        if (!ctx) return;

        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;
        const r = (CANVAS_SIZE * SKULL_SIZE_FRACTION) / 2;

        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.fillStyle = SKULL_COLOR;

        // Cranium: a rounded dome over a slightly narrower jaw.
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.15, r * 0.85, Math.PI, 0);
        ctx.lineTo(cx + r * 0.7, cy + r * 0.45);
        ctx.quadraticCurveTo(cx + r * 0.55, cy + r * 0.75, cx, cy + r * 0.75);
        ctx.quadraticCurveTo(cx - r * 0.55, cy + r * 0.75, cx - r * 0.7, cy + r * 0.45);
        ctx.closePath();
        ctx.fill();

        // Punch out the eye sockets, nasal cavity and teeth gaps so the
        // token's own wood shows through them instead of solid white.
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0, 0, 0, 1)";

        for (const dx of [-0.38, 0.38]) {
            ctx.beginPath();
            ctx.ellipse(cx + dx * r, cy - r * 0.1, r * 0.26, r * 0.32, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.05);
        ctx.lineTo(cx - r * 0.12, cy + r * 0.32);
        ctx.lineTo(cx + r * 0.12, cy + r * 0.32);
        ctx.closePath();
        ctx.fill();

        const teethTop = cy + r * 0.5;
        const teethBottom = cy + r * 0.72;
        for (let i = -2; i <= 2; i++) {
            const gx = cx + i * r * 0.16;
            ctx.fillRect(gx - r * 0.02, teethTop, r * 0.04, teethBottom - teethTop);
        }

        ctx.globalCompositeOperation = "source-over";
        skullTexture.needsUpdate = true;
    })();

    const opacity = $derived(isDead ? DEAD_OPACITY : 1);
</script>

<!-- The background/text planes use MeshStandardMaterial (like the tower/
     banners) so the scene's sun/moon lights wash over the token, and the
     normal map gives the carved wooden rim real per-pixel shading. Dead
     tokens fade the whole thing down to DEAD_OPACITY rather than just
     darkening it, with the skull (unlit - it should read the same day or
     night) sitting behind the name to signal why. -->
{#if $tokenTexture && $tokenNormalTexture}
    <T.Mesh position={[x, y, z]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$tokenTexture}
            normalMap={$tokenNormalTexture}
            transparent
            {opacity}
            alphaTest={0.01}
            roughness={0.9}
            metalness={0}
        />
    </T.Mesh>

    {#if isDead}
        <!-- Not multiplied by `opacity` - its faintness is already baked
             into SKULL_COLOR's own alpha, so it stays legible even though
             the token around it has faded almost away. -->
        <T.Mesh position={[x, y, z + 0.005]}>
            <T.PlaneGeometry args={[planeWidth, planeHeight]} />
            <T.MeshBasicMaterial map={skullTexture} transparent depthWrite={false} />
        </T.Mesh>
    {/if}

    <!-- Always full opacity, even when dead - see TEXT_SHADOW_COLOR above,
         which is what keeps the name readable once the token has faded. -->
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
