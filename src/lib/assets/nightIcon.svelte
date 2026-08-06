<script lang="ts">
    let { size = 16, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} focusable="false">
    <path d="M20.742 13.045a8.088 8.088 0 0 1-2.077.273c-4.612 0-8.35-3.738-8.35-8.35 0-1.514.407-2.933 1.117-4.155A9.5 9.5 0 1 0 22.05 15.31a8.043 8.043 0 0 1-1.308-2.265z" />
</svg>
