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

<polygon points='{x},{y} {vertical ? x+width/2 : x+width},{vertical ? y+height : y + height*1.5/2} {vertical ? x + width : x},{vertical ? y : y+height}' {fill} style="transition: fill 0.5s ease;"/>