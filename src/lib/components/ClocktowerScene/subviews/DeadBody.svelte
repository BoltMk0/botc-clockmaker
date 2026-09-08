<script lang="ts">
    import * as THREE from "three";
    import { T } from "@threlte/core";

    let {
        dialPlaneHeight,
        minuteHandLength,
        rotationZ,
        horizontalOffset,
        z
    }: {
        dialPlaneHeight: number;
        minuteHandLength: number;
        rotationZ: number;
        horizontalOffset: number;
        z: number;
    } = $props();

    // A stick-figure corpse skewered on the minute hand. The torso is fixed
    // ACROSS the hand - perpendicular to it - and turns with the hand. It's
    // split at the hand into two halves that hinge there: each then sags toward
    // the ground, but no more than TORSO_DROOP_DEG away from that hand-
    // perpendicular rest line. So relative to the hand the torso is always a
    // shallow V; relative to the world it rides round with the hand. The head,
    // arms and legs live on their own upright canvases that never rotate, so
    // they always dangle straight down toward the ground.
    //
    // No real physics here: the droop is a fixed clamp toward "down" and the
    // limbs are just drawn hanging down. Swap in a pendulum sim per part if you
    // ever want it to actually swing.

    // One knob for the whole figure's size. Everything below is a fraction of
    // the dial's height; this just scales the lot up or down together (it does
    // not move the body along the hand - that's ALONG_HAND_FRACTION).
    const BODY_SCALE = 0.6;

    // Placement / sizing, all as fractions of the dial's height.
    const ALONG_HAND_FRACTION = 0.6; // how far out along the hand the torso sits
    const TORSO_LEN_FRACTION = 0.15; // full span, hinge in the middle
    const TORSO_THICK_FRACTION = 0.05; // canvas window height, room for the round cap
    const TORSO_DROOP_DEG = 20; // max sag of each torso half from the hand-perpendicular
    const STROKE_FRACTION = 0.016;
    const HEAD_R_FRACTION = 0.032;
    const NECK_FRACTION = 0.024;
    const ARM_LEN_FRACTION = 0.15;
    const LEG_LEN_FRACTION = 0.17;
    const SHOULDER_HALF_FRACTION = 0.03; // spine centre to each shoulder
    const HIP_HALF_FRACTION = 0.022;
    // How far in from the torso ends the limb joints sit, so the limb roots
    // tuck under the body instead of just touching its tips.
    const LIMB_OVERLAP_FRACTION = 0.012;
    // The upright limb canvases span this much of the dial square; big enough
    // to hold the longest dangling limb with margin.
    const LIMB_WINDOW_FRACTION = 0.3;

    const torsoLen = $derived(dialPlaneHeight * TORSO_LEN_FRACTION * BODY_SCALE);
    const torsoThick = $derived(dialPlaneHeight * TORSO_THICK_FRACTION * BODY_SCALE);
    const limbWindow = $derived(dialPlaneHeight * LIMB_WINDOW_FRACTION * BODY_SCALE);

    const DROOP = (TORSO_DROOP_DEG * Math.PI) / 180;

    // The hinge - where the hand skewers the body - rides the hand's tip.
    const along = $derived(minuteHandLength * ALONG_HAND_FRACTION);
    const hingeX = $derived(horizontalOffset + along * Math.cos(rotationZ));
    const hingeY = $derived(along * Math.sin(rotationZ));

    // Hand-perpendicular unit vector: the torso's rigid rest line. Turns with
    // the hand.
    const perpX = $derived(-Math.sin(rotationZ));
    const perpY = $derived(Math.cos(rotationZ));

    // Take a rest direction and rotate it toward straight-down (world gravity),
    // but no further than +/-DROOP from where it started. The sag also eases
    // out as the rest line approaches vertical (|rx| -> 0): pointing dead
    // upright there's no "down" side to prefer, so instead of the clamp sign
    // snapping the half from one side to the other, the droop fades to 0.
    function droopDir(rx: number, ry: number): [number, number] {
        const toDown = Math.atan2(-rx, -ry); // signed angle to bring (rx,ry) onto (0,-1)
        const clamped = Math.max(-DROOP, Math.min(DROOP, toDown));
        const t = Math.abs(rx) * clamped; // |rx| = how horizontal the rest line is
        const c = Math.cos(t);
        const s = Math.sin(t);
        return [rx * c - ry * s, rx * s + ry * c];
    }

    // Head + arms hang off the +perp half, legs off the -perp half.
    const headDir = $derived(droopDir(perpX, perpY));
    const legsDir = $derived(droopDir(-perpX, -perpY));
    const headRot = $derived(Math.atan2(headDir[1], headDir[0]));
    const legsRot = $derived(Math.atan2(legsDir[1], legsDir[0]));

    // Half-length of each torso segment, and the shoulder / hip joints at
    // their outer ends (pulled a hair inboard so the limb roots overlap).
    const half = $derived(torsoLen * 0.5);
    const jointOut = $derived(half - dialPlaneHeight * LIMB_OVERLAP_FRACTION * BODY_SCALE);
    const shoulderX = $derived(hingeX + jointOut * headDir[0]);
    const shoulderY = $derived(hingeY + jointOut * headDir[1]);
    const hipX = $derived(hingeX + jointOut * legsDir[0]);
    const hipY = $derived(hingeY + jointOut * legsDir[1]);

    // Midpoints of each half, for placing the two bar meshes.
    const headMidX = $derived(hingeX + half * 0.5 * headDir[0]);
    const headMidY = $derived(hingeY + half * 0.5 * headDir[1]);
    const legsMidX = $derived(hingeX + half * 0.5 * legsDir[0]);
    const legsMidY = $derived(hingeY + half * 0.5 * legsDir[1]);

    // Each upright limb canvas is anchored by its top-centre EXACTLY on its
    // joint: canvas point (cx, 0) maps to world (jointX, meshY + limbWindow/2),
    // so meshY = jointY - limbWindow/2.
    const upperY = $derived(shoulderY - limbWindow * 0.5);
    const lowerY = $derived(hipY - limbWindow * 0.5);

    const TORSO_Z = $derived(z);
    const LIMBS_Z = $derived(z + 0.002);

    const BODY_COLOR = "#241a10";
    const BLOOD_COLOR = "#5c0d0d";

    function makeTexture(canvas: HTMLCanvasElement) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        return tex;
    }

    // ---- torso half: a rounded horizontal bar, one segment's worth. Both
    // halves reuse this one texture; each mesh is rotated to its droop angle.
    const TORSO_PX = 512;
    const torsoCanvas = document.createElement("canvas");
    torsoCanvas.width = TORSO_PX;
    torsoCanvas.height = Math.round(TORSO_PX * (TORSO_THICK_FRACTION / (TORSO_LEN_FRACTION * 0.5)));
    const torsoTexture = makeTexture(torsoCanvas);
    (() => {
        const ctx = torsoCanvas.getContext("2d");
        if (!ctx) return;
        const w = torsoCanvas.width;
        const h = torsoCanvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = BODY_COLOR;
        ctx.lineCap = "round";
        ctx.lineWidth = (STROKE_FRACTION / TORSO_THICK_FRACTION) * h;
        const inset = ctx.lineWidth * 0.5 + 2;
        ctx.beginPath();
        ctx.moveTo(inset, h / 2);
        ctx.lineTo(w - inset, h / 2);
        ctx.stroke();
        torsoTexture.needsUpdate = true;
    })();

    // ---- hinge: a small blob over the point where the two angled halves meet,
    // filling the notch between them (and reading as the waist / skewer point).
    const hingeCanvas = document.createElement("canvas");
    hingeCanvas.width = 128;
    hingeCanvas.height = 128;
    const hingeTexture = makeTexture(hingeCanvas);
    (() => {
        const ctx = hingeCanvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, 128, 128);
        ctx.fillStyle = BODY_COLOR;
        ctx.beginPath();
        ctx.arc(64, 64, 62, 0, Math.PI * 2);
        ctx.fill();
        hingeTexture.needsUpdate = true;
    })();

    // ---- limb canvases: drawn in "fraction of the dial" units via P(), joint
    // at the top-centre, everything dangling straight down. -----------------
    const LIMB_PX = 512;

    function limbHelpers(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, LIMB_PX, LIMB_PX);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const per = LIMB_PX / LIMB_WINDOW_FRACTION; // px per fraction-of-dial
        const P = (frac: number) => frac * per;
        return { ctx, P, cx: LIMB_PX / 2 };
    }

    const upperCanvas = document.createElement("canvas");
    upperCanvas.width = LIMB_PX;
    upperCanvas.height = LIMB_PX;
    const upperTexture = makeTexture(upperCanvas);
    (() => {
        const { ctx, P, cx } = limbHelpers(upperCanvas);
        ctx.strokeStyle = BODY_COLOR;
        ctx.fillStyle = BODY_COLOR;
        ctx.lineWidth = P(STROKE_FRACTION);

        // Everything roots at the very top-centre of the canvas, which is
        // pinned to the torso end - so each stroke starts inside the body and
        // stays attached no matter which way the torso has turned.

        // neck + head, straight down
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, P(NECK_FRACTION));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, P(NECK_FRACTION + HEAD_R_FRACTION), P(HEAD_R_FRACTION), 0, Math.PI * 2);
        ctx.fill();

        // arms: out from the spine to the shoulder, then hanging down
        for (const s of [-1, 1]) {
            const sx = cx + s * P(SHOULDER_HALF_FRACTION);
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(sx, P(0.018));
            ctx.quadraticCurveTo(
                sx + s * P(0.015),
                P(ARM_LEN_FRACTION * 0.5),
                sx + s * P(0.022),
                P(ARM_LEN_FRACTION)
            );
            ctx.stroke();
        }

        // // a bead of blood off the lowest hand
        // ctx.fillStyle = BLOOD_COLOR;
        // ctx.beginPath();
        // ctx.arc(
        //     cx + P(SHOULDER_HALF_FRACTION + 0.022),
        //     P(ARM_LEN_FRACTION + 0.006),
        //     P(0.012),
        //     0,
        //     Math.PI * 2
        // );
        // ctx.fill();

        upperTexture.needsUpdate = true;
    })();

    const lowerCanvas = document.createElement("canvas");
    lowerCanvas.width = LIMB_PX;
    lowerCanvas.height = LIMB_PX;
    const lowerTexture = makeTexture(lowerCanvas);
    (() => {
        const { ctx, P, cx } = limbHelpers(lowerCanvas);
        ctx.strokeStyle = BODY_COLOR;
        ctx.lineWidth = P(STROKE_FRACTION);

        // Legs root at the top-centre (pinned to the torso end): out to the
        // hip, then hanging down.
        for (const s of [-1, 1]) {
            const hx = cx + s * P(HIP_HALF_FRACTION);
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(hx, P(0.016));
            ctx.quadraticCurveTo(
                hx + s * P(0.01),
                P(LEG_LEN_FRACTION * 0.55),
                hx + s * P(0.016),
                P(LEG_LEN_FRACTION)
            );
            ctx.stroke();
            // foot
            ctx.beginPath();
            ctx.moveTo(hx + s * P(0.016), P(LEG_LEN_FRACTION));
            ctx.lineTo(hx + s * P(0.016 + 0.03), P(LEG_LEN_FRACTION));
            ctx.stroke();
        }

        lowerTexture.needsUpdate = true;
    })();
</script>

<!-- Torso fixed across the hand and turning with it, split at the hand into
     two halves that each sag up to TORSO_DROOP_DEG toward the ground - a
     shallow V in the hand's frame, riding round the dial with it. -->
<T.Mesh position={[headMidX, headMidY, TORSO_Z]} rotation.z={headRot}>
    <T.PlaneGeometry args={[half, torsoThick]} />
    <T.MeshBasicMaterial map={torsoTexture} transparent alphaTest={0.01} />
</T.Mesh>
<T.Mesh position={[legsMidX, legsMidY, TORSO_Z]} rotation.z={legsRot}>
    <T.PlaneGeometry args={[half, torsoThick]} />
    <T.MeshBasicMaterial map={torsoTexture} transparent alphaTest={0.01} />
</T.Mesh>

<!-- Head + arms, and legs: upright, never rotating, dangling from the joints
     wherever the torso has carried them. Same flat colour as the torso, so
     the overlap at each joint merges with no seam. -->
<T.Mesh position={[shoulderX, upperY, LIMBS_Z]}>
    <T.PlaneGeometry args={[limbWindow, limbWindow]} />
    <T.MeshBasicMaterial map={upperTexture} transparent alphaTest={0.01} />
</T.Mesh>

<T.Mesh position={[hipX, lowerY, LIMBS_Z]}>
    <T.PlaneGeometry args={[limbWindow, limbWindow]} />
    <T.MeshBasicMaterial map={lowerTexture} transparent alphaTest={0.01} />
</T.Mesh>
