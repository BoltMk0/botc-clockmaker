<script lang="ts">
    import gothicWindowCircle from '$lib/assets/gothic-window-circle-2.png';

     let {
        windowSize = 0.85,
        progress = undefined
    } : {
        windowSize: number;
        progress?: number;
    } = $props();

    let wedgeAngle = $derived(progress !== undefined ? Math.min(Math.max(1-progress, 0), 1) * 360 : 360);

</script>

<style>

    @property --wedge-angle {
        syntax: '<angle>';
        inherits: true;
        initial-value: 0deg;
    }

    .window-light {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        transition: all 1s;
    }

    .window-light.background {
        background-color: var(--hue-dark);
    }

    .window-light.foreground {
        inset: calc((1 - var(--window-size)) * 50%);
        background-color: var(--hue-alt);
        opacity: 0.8;
        mask-image: conic-gradient(from 0deg, black 0deg, black var(--wedge-angle), transparent var(--wedge-angle), transparent 360deg);
        -webkit-mask-image: conic-gradient(from 0deg, black 0deg, black var(--wedge-angle), transparent var(--wedge-angle), transparent 360deg);
        transition: mask-image 1s linear, -webkit-mask-image 1s linear;
    }

    .window {
        position: absolute;
        inset: calc((1 - var(--window-size)) * 50%);
        width: calc(var(--window-size) * 100%);
        height: calc(var(--window-size) * 100%);
        object-fit: contain;
        border-radius: 50%;
        overflow: hidden;
        transition: background-color 1s ease;
        box-shadow: 0 0 30px inset black;
        opacity: 0.15;
    }
</style>

<div style="position:relative; width: 100%; height: 100%; --window-size: {windowSize}; --wedge-angle: {wedgeAngle}deg; --hue-alt: hsl(from var(--hue) h calc(s * 0.5) calc(l * 0.8))">
    <div style="position: absolute; inset: 0;">
        <div class="window-light background"></div>
        <div class="window-light foreground"></div>
        <img src="{gothicWindowCircle}" class="window" alt="Gothic Window Circle"/>
    </div>
</div>