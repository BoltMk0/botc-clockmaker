<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";
    import type { Character } from "$lib/resources/common/gameData";

    // One row of the loric/fabled list (see GameStatsPanel.svelte): the
    // character's icon on the left, and to its right - filling the rest of
    // the row - its name as a title with the full rules text underneath.
    // Everything is drawn onto a single canvas texture (icon included), the
    // same technique PlayerSeatToken uses for its token face, just laid out
    // as a row instead of a circular badge.

    const FONT_FAMILY = '"Dumbledore", Georgia, "Times New Roman", serif';
    const TITLE_WEIGHT = "700";
    const RULES_WEIGHT = "400";
    const TEXT_COLOR = "#f0dfa8";
    const RULES_COLOR = "#f0dfa8";
    const RULES_OPACITY = 1;
    const TEXT_SHADOW_COLOR = "rgba(0, 0, 0, 0.8)";

    // A dark panel behind the icon/text so the row stays legible over the
    // sky/scene behind it, however bright or busy that gets.
    const BACKGROUND_COLOR = "rgba(8, 6, 5, 0.6)";
    const BACKGROUND_RADIUS_FRACTION = 0.16; // of row height

    // Working resolution of the row's canvas; width follows the row's own
    // aspect ratio (placement.width / placement.height) once that's known.
    const CANVAS_HEIGHT = 256;

    // Icon: a circle inset from the row's left/top/bottom edges by this
    // fraction of the row height.
    const ICON_MARGIN_FRACTION = 0.025;
    // Gap between the icon and the text column, as a fraction of row height.
    const ICON_TEXT_GAP_FRACTION = 0;
    // Inset from the row's right edge, as a fraction of row height.
    const RIGHT_MARGIN_FRACTION = 0.02;

    const TITLE_MAX_FONT_FRACTION = 0.17; // of row height
    const TITLE_MIN_FONT_PX = 14;
    const RULES_MAX_FONT_FRACTION = 0.15; // of row height
    const RULES_MIN_FONT_PX = 10;
    const RULES_LINE_HEIGHT = 1.02;
    // Gap between the title and the rules text, as a fraction of row height.
    const TITLE_RULES_GAP_FRACTION = 0.06;

    let {
        character,
        placement,
        z = 0.2
    }: {
        character: Character;
        placement: { x: number; y: number; width: number; height: number };
        z?: number;
    } = $props();

    const x = $derived(placement.x);
    const y = $derived(placement.y);
    const planeWidth = $derived(placement.width);
    const planeHeight = $derived(placement.height);

    let fontReady = $state(
        typeof document !== "undefined" && document.fonts.check(`16px "Dumbledore"`)
    );
    $effect(() => {
        if (fontReady) return;
        document.fonts
            .load(`${TITLE_WEIGHT} 16px "Dumbledore"`)
            .then(() => (fontReady = true))
            .catch(() => (fontReady = true));
    });

    let iconImage = $state<HTMLImageElement | null>(null);
    $effect(() => {
        const id = character.id;
        iconImage = null;
        if (!id) return;
        const img = new Image();
        img.onload = () => { iconImage = img; };
        img.src = `/api/characters/${id}/img`;
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

    const canvas: HTMLCanvasElement = document.createElement("canvas");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    $effect(() => {
        void fontReady;
        void iconImage;

        const aspect = planeWidth / planeHeight;
        const height = CANVAS_HEIGHT;
        const width = Math.round(height * aspect);
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        // Background panel behind the whole row.
        ctx.fillStyle = BACKGROUND_COLOR;
        ctx.beginPath();
        ctx.roundRect(0, 0, width, height, height * BACKGROUND_RADIUS_FRACTION);
        ctx.fill();

        // Icon, clipped to a circle inset from the row's edges.
        const iconMargin = height * ICON_MARGIN_FRACTION;
        const iconR = height / 2 - iconMargin;
        const iconCx = iconMargin + iconR;
        const iconCy = height / 2;
        if (iconImage) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
            ctx.clip();
            const side = iconR * 2;
            ctx.drawImage(iconImage, iconCx - side / 2, iconCy - side / 2, side, side);
            ctx.restore();
        } else {
            ctx.fillStyle = "#999";
            ctx.beginPath();
            ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
            ctx.fill();
        }

        // Text column: everything to the right of the icon, out to the
        // row's own right margin.
        const textX = iconCx + iconR + height * ICON_TEXT_GAP_FRACTION;
        const textRight = width - height * RIGHT_MARGIN_FRACTION;
        const textWidth = Math.max(0, textRight - textX);

        ctx.textAlign = "left";
        ctx.shadowColor = TEXT_SHADOW_COLOR;

        const rulesText = character.rules?.trim() ?? "";
        const hasRules = rulesText.length > 0;
        const gap = hasRules ? height * TITLE_RULES_GAP_FRACTION : 0;

        // Rules block first (bottom-up), so the title above it can claim
        // whatever height the rules didn't need - the title never shrinks
        // to make room for rules text, only the reverse.
        let rulesLines: string[] = [];
        let rulesFontPx = 0;
        let rulesBlockH = 0;
        if (hasRules) {
            rulesFontPx = Math.max(RULES_MIN_FONT_PX, height * RULES_MAX_FONT_FRACTION);
            const maxRulesH = height * 0.72;
            while (rulesFontPx >= RULES_MIN_FONT_PX) {
                ctx.font = `${RULES_WEIGHT} ${rulesFontPx}px ${FONT_FAMILY}`;
                rulesLines = wrapLines(ctx, rulesText, textWidth);
                rulesBlockH = rulesLines.length * rulesFontPx * RULES_LINE_HEIGHT;
                if (rulesBlockH <= maxRulesH) break;
                rulesFontPx -= 1;
            }
        }

        const titleMaxH = height - rulesBlockH - gap;
        let titleFontPx = Math.max(TITLE_MIN_FONT_PX, height * TITLE_MAX_FONT_FRACTION);
        while (titleFontPx >= TITLE_MIN_FONT_PX) {
            ctx.font = `${TITLE_WEIGHT} ${titleFontPx}px ${FONT_FAMILY}`;
            if (ctx.measureText(character.name.toUpperCase()).width <= textWidth && titleFontPx <= titleMaxH) break;
            titleFontPx -= 1;
        }

        const blockH = titleFontPx + gap + rulesBlockH;
        let cursorY = (height - blockH) / 2;

        ctx.font = `${TITLE_WEIGHT} ${titleFontPx}px ${FONT_FAMILY}`;
        ctx.fillStyle = TEXT_COLOR;
        ctx.textBaseline = "top";
        ctx.shadowBlur = titleFontPx * 0.1;
        ctx.shadowOffsetY = titleFontPx * 0.03;
        ctx.fillText(character.name.toUpperCase(), textX, cursorY);
        cursorY += titleFontPx + gap;

        if (hasRules) {
            ctx.font = `${RULES_WEIGHT} ${rulesFontPx}px ${FONT_FAMILY}`;
            ctx.fillStyle = RULES_COLOR;
            ctx.globalAlpha = RULES_OPACITY;
            ctx.shadowBlur = rulesFontPx * 0.1;
            ctx.shadowOffsetY = rulesFontPx * 0.03;
            const lineStep = rulesFontPx * RULES_LINE_HEIGHT;
            for (const line of rulesLines) {
                ctx.fillText(line, textX, cursorY);
                cursorY += lineStep;
            }
            ctx.globalAlpha = 1;
        }

        ctx.shadowColor = "transparent";
        texture.needsUpdate = true;
    });
</script>

<T.Mesh position={[x, y, z]}>
    <T.PlaneGeometry args={[planeWidth, planeHeight]} />
    <T.MeshBasicMaterial map={texture} transparent depthWrite={false} />
</T.Mesh>
