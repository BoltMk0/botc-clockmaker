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
    const DEAD_TEXT_COLOR = "#6b6558";
    const MAX_FONT_PX = 220;
    const MIN_FONT_PX = 40;
    // Inset from the token's own edge before text can be drawn, as a
    // fraction of the token's width/height - keeps names off the carved
    // wooden rim.
    const CONTENT_MARGIN = 0.22;

    const CANVAS_SIZE = 512;

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
        ctx.fillStyle = isDead ? DEAD_TEXT_COLOR : TEXT_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const step = fontPx * lineHeight;
        let cursorY = centerY - ((lines.length - 1) * step) / 2;
        for (const line of lines) {
            ctx.fillText(line, centerX, cursorY);
            cursorY += step;
        }

        textTexture.needsUpdate = true;
    });

    // A soft dark shroud drawn over dead tokens - same radial-gradient
    // technique used for the sun/moon/lantern halos elsewhere in the scene,
    // just inverted (dark instead of a glow) and clipped to the token's own
    // circular shape via its own alpha.
    const shroudCanvas: HTMLCanvasElement = document.createElement("canvas");
    shroudCanvas.width = CANVAS_SIZE;
    shroudCanvas.height = CANVAS_SIZE;
    const shroudTexture = new THREE.CanvasTexture(shroudCanvas);
    shroudTexture.generateMipmaps = false;
    shroudTexture.minFilter = THREE.LinearFilter;
    shroudTexture.magFilter = THREE.LinearFilter;

    $effect(() => {
        const ctx = shroudCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const gradient = ctx.createRadialGradient(
            CANVAS_SIZE * 0.5, CANVAS_SIZE * 0.35, 0,
            CANVAS_SIZE * 0.5, CANVAS_SIZE * 0.35, CANVAS_SIZE * 0.5
        );
        gradient.addColorStop(0, "rgba(10, 10, 15, 0.75)");
        gradient.addColorStop(0.7, "rgba(10, 10, 15, 0.3)");
        gradient.addColorStop(1, "rgba(10, 10, 15, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        shroudTexture.needsUpdate = true;
    });
</script>

<!-- All three planes use MeshStandardMaterial (like the tower/banners) so
     the scene's sun/moon lights wash over the token, and the normal map
     gives the carved wooden rim real per-pixel shading. -->
{#if $tokenTexture && $tokenNormalTexture}
    <T.Mesh position={[x, y, z]}>
        <T.PlaneGeometry args={[planeWidth, planeHeight]} />
        <T.MeshStandardMaterial
            map={$tokenTexture}
            normalMap={$tokenNormalTexture}
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

    {#if isDead}
        <T.Mesh position={[x, y, z + 0.02]}>
            <T.PlaneGeometry args={[planeWidth, planeHeight]} />
            <T.MeshBasicMaterial map={shroudTexture} transparent depthWrite={false} />
        </T.Mesh>
    {/if}
{/if}
