<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>
<svg viewBox="0 0 24 24" width={size} height={size} fill={color} focusable="false">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
</svg>
