<script lang="ts">
    import { useThrelte } from "@threlte/core";
    import TextBanner from "./TextBanner.svelte";
    import PlayerCountBanner, { type PlayerCounts } from "./PlayerCountBanner.svelte";
    import Lantern from "./Lantern.svelte";
    import RopeChain from "./RopeChain.svelte";
    import PlayerSeats from "./PlayerSeats.svelte";
    import type { GrimoireStateHistory } from "$lib/resources/common/grimoireState";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData";

    // ---------------------------------------------------------------------
    // Panel layout - tweak these freely.
    //
    // The panel spans the full screen height and is mirrored to the left of
    // the tower so the tower (shifted right by `horizontalOffset`) and the
    // panel balance around frame centre. Fractions are of the visible screen
    // width (x / widths), measured from dead centre.
    // ---------------------------------------------------------------------
    const PANEL = {
        // Horizontal centre of the panel, mirroring the tower's rightward
        // `horizontalOffset`. 1 = exact mirror; >1 pushes it further left.
        mirror: 1,
        // Extra horizontal nudge, as a fraction of screen width (+right).
        nudgeX: 0,
        // Full panel width as a fraction of screen width. Individual rows
        // scale within this via the *_WIDTH_SCALE values below.
        widthFraction: 0.34,
        z: 0.2
    };

    // The player count banner sits apart from the rest of the panel, pinned
    // to the far right of the actual screen (not mirrored off the tower's
    // offset like the day banner/lanterns above). Margin is a fraction of
    // the real visible screen width, measured in from the right edge.
    // Only used when a grim exists (see `hasGrim` below) - otherwise the
    // count banner stacks directly under the day banner in the same panel.
    const COUNT_RIGHT_MARGIN_FRACTION = 0.02;

    // With a grim, the day/time banner floats at screen-centre height
    // instead of being centred above the count banner, so the player-seats
    // view can use the panel's *entire* column (top edge to bottom edge)
    // rather than just the space left under the banner. The banner then
    // renders in front of the seats (see DAY_Z_LIFT below) since it now
    // overlaps them rather than sitting in its own reserved strip above.
    // The seats view is also given far more width than the (mirrored-panel-
    // width) banner - it's the main thing on screen at that point, not just
    // another panel row - centred on the same `panelX` the banner itself
    // sits on.
    const SEATS_WIDTH_SCALE = 2.2;

    // The count banner's own texture aspect (width / height), used to turn
    // its row width into its rendered height so it can be positioned before
    // the texture has actually loaded. Keep in sync with billboard.png's
    // real dimensions if that asset changes.
    const COUNT_BANNER_ASPECT = 687 / 730; // billboard.png

    // Same trick for the day banner, needed to work out its rendered height
    // so the lanterns hanging off its pole (see below) can be positioned
    // relative to it.
    const DAY_BANNER_ASPECT = 2172 / 724; // banner_large_2.png

    // Per-row width, as a fraction of the panel width, so rows can differ in
    // size if wanted.
    const DAY_WIDTH_SCALE = 0.75;
    const COUNT_WIDTH_SCALE = 0.8;

    // How far in front of the seats view (PANEL.z) the day banner sits when
    // it's floating over them at screen-centre.
    const DAY_Z_LIFT = 0.1;
    // How far behind the day banner itself (but still in front of the
    // seats, at PANEL.z) the lanterns/ropes hanging off its pole sit.
    const LANTERN_Z_RECESS = 0.05;
    // Nudges the day banner up from dead-centre, as a fraction of
    // `visibleHeight` - the seats view itself stays centred on the full
    // screen; only the banner floating over it shifts.
    const DAY_CENTER_LIFT_FRACTION = 0.06;

    // A pair of lanterns hang off the two ends of the day banner's pole
    // (banner_large.png's rod extends past the cloth on both sides, tipped
    // with a spearpoint finial), each on a short length of rope. Sizes are
    // a fraction of the panel width; LANTERN_ASPECT is lantern.png's own
    // aspect, needed to work out rendered height before the texture loads.
    const LANTERN_WIDTH_SCALE = 0.32 * 0.6 * 0.55 * 1.3;
    const LANTERN_ASPECT = 512 / 768; // lantern.png

    // Where the pole sits, as a fraction of the day banner's own rendered
    // height below its top edge, and how far out its ends reach, as a
    // fraction of the day banner's half-width - both read off
    // banner_large.png (a 1034x314 image; the rod's centre sits roughly
    // 20px down, and its spear tips reach almost to the image edges).
    const POLE_Y_INSET_FRACTION = 0.065;
    const POLE_EDGE_X_FRACTION = 0.855;

    // Rope length/thickness, relative to the lantern's own width. Shorter
    // than it once was, so the lanterns hang closer to the panel/pole
    // instead of dangling well below it.
    const ROPE_LENGTH_SCALE = 1.8;
    const ROPE_THICKNESS_SCALE = 0.12;
    // Nudges the lantern up so its top overlaps the rope's bottom end
    // (where its ring would attach) instead of just touching it.
    const LANTERN_ROPE_OVERLAP_SCALE = 0.11;

    // The camera is always centred on world (0,0) and shows `visibleHeight`
    // world-units vertically, and every size in this panel is a fraction of
    // `visibleHeight` - so the panel's own size tracks the screen's height
    // only, never its width. `SCREEN_WIDTH_FACTOR` is just the reference
    // width (in the same height-relative units) that `widthFraction` below
    // was tuned against - it does not depend on the real visible width.
    const SCREEN_WIDTH_FACTOR = 2;

    let {
        day,
        progress,
        totalTime,
        counts,
        visibleHeight,
        // The tower's rightward shift; the panel mirrors it to the left so
        // the scene reads as centred. Same default as ClocktowerScene. This
        // is the one thing allowed to shrink on narrow screens (see
        // Scene.svelte) - it only repositions the panel toward centre
        // (overlapping the tower if needed), it never resizes it.
        horizontalOffset = visibleHeight * 0.4,
        // Whether this game has a virtual grimoire set up - some tables run
        // without one. Without a grim there's no player-seats view to show,
        // so the count banner stacks under the day banner in one panel
        // instead of moving to the right edge; with one, the day banner
        // floats at screen-centre and the seats view fills the panel's
        // whole column behind it (see `grimoireState`/`script` below).
        hasGrim = false,
        grimoireState = null,
        script = null
    }: {
        day: number;
        // Day progress 0..1 and the day's total length in seconds - together
        // they give the time remaining shown on the top banner.
        progress: number;
        totalTime: number;
        counts: PlayerCounts;
        visibleHeight: number;
        horizontalOffset?: number;
        hasGrim?: boolean;
        grimoireState?: GrimoireStateHistory | null;
        script?: ScriptWithCharacters | null;
    } = $props();

    // Time remaining as M:SS (clamped at 0).
    const timeLabel = $derived.by(() => {
        const secs = Math.max(0, Math.round(totalTime * (1 - progress)));
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    });

    const screenWidth = $derived(visibleHeight * SCREEN_WIDTH_FACTOR);
    const panelW = $derived(screenWidth * PANEL.widthFraction);
    const panelX = $derived(-horizontalOffset * PANEL.mirror + screenWidth * PANEL.nudgeX);

    // The real visible half-width, in the same world units as everything
    // else here - unlike `screenWidth` above (a fixed design reference used
    // for tuning fractions), this tracks the actual canvas aspect so the
    // count banner can be pinned to the real right edge of the screen. See
    // OrthoCamera.svelte: zoom = size.height / visibleHeight, and 1 world
    // unit = 1px at zoom 1, so half the real width in world units is
    // visibleHeight * (size.width / size.height) / 2.
    const { size } = useThrelte();
    const realHalfWidth = $derived(visibleHeight * ($size.width / $size.height) / 2);

    // The panel spans the full screen height. Without a grim, the count
    // banner's bottom edge sits flush with the bottom of the screen and the
    // day banner is centred in whatever vertical space is left above it, up
    // to the top edge of the screen - a single stacked panel. With a grim,
    // the day banner instead floats at screen-centre height (count banner
    // still pinned to the real right edge separately - see `countX` below)
    // and the seats view takes the panel's whole column, top to bottom,
    // underneath it. The camera is centred on world (0,0) and shows
    // `visibleHeight` world-units vertically, so the screen's top/bottom
    // edges sit at +/- visibleHeight / 2.
    const rows = $derived.by(() => {
        const dayW = panelW * DAY_WIDTH_SCALE;
        const dayH = dayW / DAY_BANNER_ASPECT;
        const countW = panelW * COUNT_WIDTH_SCALE;
        const countH = countW / COUNT_BANNER_ASPECT;

        const screenTop = visibleHeight / 2;
        const screenBottom = -visibleHeight / 2;

        let dayY: number;
        let countX: number;
        let countY: number;
        let seatsArea: { x: number; y: number; width: number; height: number } | null = null;

        if (hasGrim) {
            dayY = visibleHeight * DAY_CENTER_LIFT_FRACTION;
            countY = screenBottom + countH / 2 - (countH/6);
            countX = realHalfWidth - screenWidth * COUNT_RIGHT_MARGIN_FRACTION - countW / 2;

            seatsArea = {
                x: panelX,
                y: 0,
                width: panelW * SEATS_WIDTH_SCALE,
                height: visibleHeight
            };
        } else {
            countY = screenBottom + countH / 2 - (countH/6);
            const countTop = countY + countH / 2;
            countX = panelX;
            dayY = (screenTop + countTop) / 2;
        }

        const dayTop = dayY + dayH / 2;

        // The pole's own y, and how far out (each side) its ends reach.
        const poleY = dayTop - dayH * POLE_Y_INSET_FRACTION;
        const poleEdgeX = (dayW / 2) * POLE_EDGE_X_FRACTION;

        const lanternW = panelW * LANTERN_WIDTH_SCALE;
        const lanternH = lanternW / LANTERN_ASPECT;
        const ropeLength = lanternW * ROPE_LENGTH_SCALE;
        const ropeThickness = lanternW * ROPE_THICKNESS_SCALE;
        const lanternTopY = poleY - ropeLength;
        const lanternY = lanternTopY - lanternH / 2 + lanternW * LANTERN_ROPE_OVERLAP_SCALE;

        // With a grim, the day banner now floats over the seats view rather
        // than sitting in its own reserved strip above it, so it needs to
        // render in front of the seat tokens instead of at the same depth.
        const dayZ = hasGrim ? PANEL.z + DAY_Z_LIFT : PANEL.z;
        // The lanterns/ropes stay just behind the banner itself (rather than
        // level with it) - still above the seats layer, but tucked behind
        // the panel they hang off of instead of floating in front of it.
        const lanternZ = dayZ - LANTERN_Z_RECESS;

        return {
            day: { x: panelX, y: dayY, width: dayW },
            count: { x: countX, y: countY, width: countW },
            lanterns: [
                { x: panelX - poleEdgeX, y: lanternY, width: lanternW },
                { x: panelX + poleEdgeX, y: lanternY, width: lanternW }
            ],
            ropes: [
                { x: panelX - poleEdgeX, topY: poleY, bottomY: lanternTopY, thickness: ropeThickness },
                { x: panelX + poleEdgeX, topY: poleY, bottomY: lanternTopY, thickness: ropeThickness }
            ],
            dayZ,
            lanternZ,
            seatsArea
        };
    });

</script>

<TextBanner
    content={timeLabel}
    subtitle={`Time Remaining`}
    {visibleHeight}
    placement={rows.day}
    z={rows.dayZ}
/>
<PlayerCountBanner {counts} {visibleHeight} placement={rows.count} z={PANEL.z} />
{#each rows.ropes as rope, i (i)}
    <RopeChain {...rope} z={rows.lanternZ} />
{/each}
{#each rows.lanterns as lantern, i (i)}
    <Lantern {visibleHeight} placement={lantern} {progress} z={rows.lanternZ} />
{/each}
{#if hasGrim && rows.seatsArea}
    <PlayerSeats area={rows.seatsArea} {grimoireState} {script} {visibleHeight} z={PANEL.z} />
{/if}
