<script lang="ts">
    import * as THREE from "three";
    import { untrack } from "svelte";
    import { T } from "@threlte/core";
    import { useTexture } from "@threlte/extras";
    import minuteHandUrl from "$lib/assets/clockhand.png";
    import hourHandUrl from "$lib/assets/clockhand3.png";

    // Same asset-specific constants as ClockFace.svelte - kept in sync with
    // it so the numerals/hands land on the dial it draws rather than an
    // independently-guessed size. Update both if the clockface art changes.
    const TOWER_IMAGE_PIXEL_HEIGHT = 4096;
    const CLOCKFACE_IMAGE_PIXEL_HEIGHT = 463;

    let {
        progress,
        totalTime,
        towerPlaneHeight,
        horizontalOffset
    }: {
        progress: number;
        totalTime: number;
        towerPlaneHeight: number;
        horizontalOffset: number;
    } = $props();

    const dialPlaneHeight = $derived(
        (CLOCKFACE_IMAGE_PIXEL_HEIGHT / TOWER_IMAGE_PIXEL_HEIGHT) * towerPlaneHeight
    );

    // Same "current time" math as the 2D clocktower display's ClockFace.svelte:
    // a continuously wrapping fraction rather than clamped 0-1, so the hands
    // sweep round and round like a real clock instead of just tracking the
    // whole game's start-to-end arc once.
    // Not rounded to whole seconds - keeping it continuous lets the hands
    // sweep smoothly instead of ticking once per second.
    const timeRemaining = $derived(totalTime * (1 - progress));
    const minutesRemaining = $derived(timeRemaining / 60);
    const minuteHandProgress = $derived(minutesRemaining);
    const hourHandProgress = $derived(minutesRemaining / 12);

    // A clock hand image points right at rotation 0, pivoting near its left
    // end (the same `transform-origin` convention as the 2D display) -
    // shifting the plane geometry so that point sits at the local origin is
    // what makes rotating the mesh pivot around it like a real hand, instead
    // of around the image's center.
    function handRotationZ(handProgress: number) {
        return ((90 - handProgress * 360) * Math.PI) / 180;
    }

    function useHandTexture(url: string) {
        return useTexture(untrack(() => url));
    }

    const minuteTexture = useHandTexture(minuteHandUrl);
    const hourTexture = useHandTexture(hourHandUrl);

    $effect(() => {
        if ($minuteTexture && $minuteTexture.colorSpace !== THREE.SRGBColorSpace) {
            $minuteTexture.colorSpace = THREE.SRGBColorSpace;
        }
        if ($hourTexture && $hourTexture.colorSpace !== THREE.SRGBColorSpace) {
            $hourTexture.colorSpace = THREE.SRGBColorSpace;
        }
    });

    // How far each hand reaches across the dial, and where (as a fraction of
    // its own image width) it pivots - matches the 2D display's `max-width:
    // 50%` hands and their `transform-origin` percentages.
    const MINUTE_HAND_LENGTH_FRACTION = 0.42;
    const MINUTE_HAND_PIVOT_FRACTION = 0.07;
    const HOUR_HAND_LENGTH_FRACTION = 0.32;
    const HOUR_HAND_PIVOT_FRACTION = 0.065;

    function handGeometry(
        texture: THREE.Texture | undefined,
        lengthFraction: number,
        pivotFraction: number,
        dialHeight: number
    ) {
        const image = texture?.image as { width: number; height: number } | undefined;
        const aspect = image ? image.width / image.height : 512 / 80;
        const width = dialHeight * lengthFraction;
        const height = width / aspect;
        const geometry = new THREE.PlaneGeometry(width, height);
        // Shift vertices so the pivot point (a fraction of the way across
        // the image from its left edge) becomes the local origin.
        geometry.translate(width * (0.5 - pivotFraction), 0, 0);
        return geometry;
    }

    const minuteGeometry = $derived(
        handGeometry($minuteTexture, MINUTE_HAND_LENGTH_FRACTION, MINUTE_HAND_PIVOT_FRACTION, dialPlaneHeight)
    );
    const hourGeometry = $derived(
        handGeometry($hourTexture, HOUR_HAND_LENGTH_FRACTION, HOUR_HAND_PIVOT_FRACTION, dialPlaneHeight)
    );

    // A touch further forward than the dial (z=0.05) so the hands sit on
    // top of it, and the numerals a hair further forward still so they sit
    // on top of the hands' bases without fighting the dial for depth.
    const HANDS_Z = 0.07;
    const NUMERALS_Z = 0.09;

    // The 12 hour numerals, drawn onto a single canvas rather than as 12
    // separate meshes - same technique used for the sky/halo gradients
    // elsewhere in the scene. Upright at every position (not rotated to
    // follow the radius), matching the 2D display's numerals.
    const NUMERAL_TEXTURE_SIZE = 1024;
    const NUMERAL_RADIUS_FRACTION = 0.66;
    const NUMERAL_FONT_SIZE = 112;
    // Nudges every numeral down from where the radius/angle math alone would
    // put it - they read as sitting too high otherwise.
    const NUMERAL_Y_OFFSET = 18;
    const NUMERAL_COLOR = "#33291c";
    const ROMAN_NUMERALS = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ", "Ⅺ", "Ⅻ"];

    const numeralCanvas: HTMLCanvasElement = document.createElement("canvas");
    numeralCanvas.width = NUMERAL_TEXTURE_SIZE;
    numeralCanvas.height = NUMERAL_TEXTURE_SIZE;
    const numeralTexture = new THREE.CanvasTexture(numeralCanvas);
    numeralTexture.colorSpace = THREE.SRGBColorSpace;

    (() => {
        const ctx = numeralCanvas.getContext("2d");
        if (!ctx) return;
        const center = NUMERAL_TEXTURE_SIZE / 2;
        const radius = center * NUMERAL_RADIUS_FRACTION;
        ctx.font = `${NUMERAL_FONT_SIZE}px "Times New Roman", Times, serif`;
        ctx.fillStyle = NUMERAL_COLOR;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = 0; i < 12; i++) {
            const clockAngle = ((i + 1) * Math.PI) / 6; // 30° per hour, 0 = 12 o'clock
            const x = center + radius * Math.sin(clockAngle);
            const y = center - radius * Math.cos(clockAngle) + NUMERAL_Y_OFFSET;
            ctx.fillText(ROMAN_NUMERALS[i], x, y);
        }
        numeralTexture.needsUpdate = true;
    })();
</script>

<T.Mesh position={[horizontalOffset, 0, NUMERALS_Z]}>
    <T.PlaneGeometry args={[dialPlaneHeight, dialPlaneHeight]} />
    <T.MeshBasicMaterial map={numeralTexture} transparent alphaTest={0.01} />
</T.Mesh>

{#if $minuteTexture}
    <T.Mesh position={[horizontalOffset, 0, HANDS_Z]} rotation.z={handRotationZ(minuteHandProgress)}>
        <T is={minuteGeometry} attach="geometry" />
        <T.MeshBasicMaterial map={$minuteTexture} transparent alphaTest={0.01} />
    </T.Mesh>
{/if}

{#if $hourTexture}
    <T.Mesh position={[horizontalOffset, 0, HANDS_Z - 0.001]} rotation.z={handRotationZ(hourHandProgress)}>
        <T is={hourGeometry} attach="geometry" />
        <T.MeshBasicMaterial map={$hourTexture} transparent alphaTest={0.01} />
    </T.Mesh>
{/if}
