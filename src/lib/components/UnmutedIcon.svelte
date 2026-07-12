<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} focusable="false">
    <path d="M4 9v6h4l5 5V4L8 9H4z" />
    <path d="M16.5 12c0-1.77-.77-3.36-2-4.47v8.94a5.99 5.99 0 0 0 2-4.47z" />
    <path d="M14.5 4.86v2.06c2.09.94 3.5 2.99 3.5 5.08s-1.41 4.14-3.5 5.08v2.06c3.14-.98 5.5-3.91 5.5-7.14s-2.36-6.16-5.5-7.14z" />
</svg>
