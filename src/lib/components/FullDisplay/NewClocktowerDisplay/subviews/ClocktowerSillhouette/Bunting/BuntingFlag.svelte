<script lang="ts">
    import { getNewClocktowerThemeContext } from "../../../model/theme";

    let {
        x,
        y,
        width,
        height,
        color,
        rotate=undefined,
        style = '',
        flapDelay = 0,
        flapDuration = 3.1
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
        style?: string;
        rotate?: string|number;
        flapDelay?: number;
        flapDuration?: number;
    } = $props();


    const theme = getNewClocktowerThemeContext()

    const rotateDeg = $derived(
        typeof rotate === 'number' ? rotate : rotate !== undefined ? parseFloat(rotate) : undefined
    );

</script>

<svg
    viewBox="0 0 100 100"
    x="{x}"
    y="{y}"
    width="{width}"
    height="{height}"
    preserveAspectRatio="none"
    class="flapping"
    style="fill: {color}; transform-origin: 50% 0%; animation-delay: {flapDelay}s; animation-duration: {flapDuration}s; {style};"
    transform={rotateDeg !== undefined ? `rotate(${rotateDeg} ${x + width / 2} ${y})` : undefined}
>
    <polygon points="0,0 50,100 100,0" style="fill: {theme.baseSecondary}"/>
    <polygon points="3,0 97,0 50,94"/>
</svg>

<style>
    .flapping {
        animation-name: bunting-flap;
        animation-timing-function: ease-in-out;
        animation-iteration-count: infinite;
    }

    @keyframes bunting-flap {
        0% {
            transform: skewX(0deg) scaleY(1);
        }
        11% {
            transform: skewX(3deg) scaleY(0.99);
        }
        21% {
            transform: skewX(-2deg) scaleY(1.01);
        }
        30% {
            transform: skewX(5deg) scaleY(0.98);
        }
        40% {
            transform: skewX(-4deg) scaleY(1.01);
        }
        50% {
            transform: skewX(1deg) scaleY(0.99);
        }
        62% {
            transform: skewX(-3deg) scaleY(1.02);
        }
        73% {
            transform: skewX(4deg) scaleY(0.98);
        }
        84% {
            transform: skewX(-1deg) scaleY(1);
        }
        93% {
            transform: skewX(2deg) scaleY(0.99);
        }
        100% {
            transform: skewX(0deg) scaleY(1);
        }
    }
</style>