<script lang="ts">
    let {
        x,
        y,
        width,
        height,
        fill,
        vertical = false
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
        fill: string;
        vertical?: boolean;
    } = $props()
</script>

<polygon
    points='{x},{y} {vertical ? x+width/2 : x+width},{vertical ? y+height : y + height*1.5/2} {vertical ? x + width : x},{vertical ? y : y+height}'
    {fill}
    class={vertical ? '' : 'flapping'}
    style="transition: fill 0.5s ease; transform-origin: {x}px {y}px;"
/>

<style>
    .flapping {
        animation: flap 3.1s ease-in-out infinite;
    }

    @keyframes flap {
        0% {
            transform: skewY(0deg) scaleX(1);
        }
        9% {
            transform: skewY(3deg) scaleX(0.99);
        }
        17% {
            transform: skewY(-2deg) scaleX(1.01);
        }
        24% {
            transform: skewY(5deg) scaleX(0.97);
        }
        33% {
            transform: skewY(-4deg) scaleX(1.01);
        }
        41% {
            transform: skewY(1deg) scaleX(0.99);
        }
        52% {
            transform: skewY(-3deg) scaleX(1.02);
        }
        61% {
            transform: skewY(4deg) scaleX(0.98);
        }
        68% {
            transform: skewY(-1deg) scaleX(1);
        }
        77% {
            transform: skewY(2deg) scaleX(0.99);
        }
        86% {
            transform: skewY(-4deg) scaleX(1.01);
        }
        94% {
            transform: skewY(1deg) scaleX(0.99);
        }
        100% {
            transform: skewY(0deg) scaleX(1);
        }
    }
</style>
