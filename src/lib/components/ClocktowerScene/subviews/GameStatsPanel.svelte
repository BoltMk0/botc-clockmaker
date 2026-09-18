<script lang="ts">
    import TextBanner from "./TextBanner.svelte";
    import PlayerCountBanner, { type PlayerCounts } from "./PlayerCountBanner.svelte";
    import Lantern from "./Lantern.svelte";
    import RopeChain from "./RopeChain.svelte";

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
    // size if wanted. Kept equal so both banners render the same size.
    const DAY_WIDTH_SCALE = 1.0;
    const COUNT_WIDTH_SCALE = 0.8;

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

    // Rope length/thickness, relative to the lantern's own width.
    const ROPE_LENGTH_SCALE = 2.4;
    const ROPE_THICKNESS_SCALE = 0.12;
    // Nudges the lantern up so its top overlaps the rope's bottom end
    // (where its ring would attach) instead of just touching it.
    const LANTERN_ROPE_OVERLAP_SCALE = 0.11;

    // The camera is always centred on world (0,0) and shows `visibleHeight`
    // world-units vertically; the visible width is about `visibleHeight * 2`
    // (see the `horizontalOffset` note in ClocktowerScene.svelte).
    const SCREEN_WIDTH_FACTOR = 2;

    let {
        day,
        progress,
        totalTime,
        counts,
        visibleHeight,
        // The tower's rightward shift; the panel mirrors it to the left so
        // the scene reads as centred. Same default as ClocktowerScene.
        horizontalOffset = visibleHeight * 0.4
    }: {
        day: number;
        // Day progress 0..1 and the day's total length in seconds - together
        // they give the time remaining shown on the top banner.
        progress: number;
        totalTime: number;
        counts: PlayerCounts;
        visibleHeight: number;
        horizontalOffset?: number;
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

    // The panel spans the full screen height: the count banner's bottom
    // edge sits flush with the bottom of the screen, and the day banner is
    // centred in whatever vertical space is left above it, up to the top
    // edge of the screen. The camera is centred on world (0,0) and shows
    // `visibleHeight` world-units vertically, so the screen's top/bottom
    // edges sit at +/- visibleHeight / 2.
    const rows = $derived.by(() => {
        const dayW = panelW * DAY_WIDTH_SCALE;
        const dayH = dayW / DAY_BANNER_ASPECT;
        const countW = panelW * COUNT_WIDTH_SCALE;
        const countH = countW / COUNT_BANNER_ASPECT;

        const screenTop = visibleHeight / 2;
        const screenBottom = -visibleHeight / 2;

        const countY = screenBottom + countH / 2 - (countH/6);
        const countTop = countY + countH / 2;
        const dayY = (screenTop + countTop) / 2;
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

        return {
            day: { x: panelX, y: dayY, width: dayW },
            count: { x: panelX, y: countY, width: countW },
            lanterns: [
                { x: panelX - poleEdgeX, y: lanternY, width: lanternW },
                { x: panelX + poleEdgeX, y: lanternY, width: lanternW }
            ],
            ropes: [
                { x: panelX - poleEdgeX, topY: poleY, bottomY: lanternTopY, thickness: ropeThickness },
                { x: panelX + poleEdgeX, topY: poleY, bottomY: lanternTopY, thickness: ropeThickness }
            ]
        };
    });
</script>

<TextBanner
    content={timeLabel}
    subtitle={`Time Remaining`}
    {visibleHeight}
    placement={rows.day}
    z={PANEL.z}
/>
<PlayerCountBanner {counts} {visibleHeight} placement={rows.count} z={PANEL.z} />
{#each rows.ropes as rope, i (i)}
    <RopeChain {...rope} z={PANEL.z} />
{/each}
{#each rows.lanterns as lantern, i (i)}
    <Lantern {visibleHeight} placement={lantern} {progress} z={PANEL.z} />
{/each}
