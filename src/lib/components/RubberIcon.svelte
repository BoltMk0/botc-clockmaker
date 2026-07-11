<script lang="ts">
    let { color, style = "" }: { color: string; style?: string } = $props();
</script>

<svg viewBox="0 0 24 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="{style}">
    <rect x="2" y="2" width="20" height="38" ry="3" fill="{color}" transform="rotate(10 12 20)"/>
</svg>
