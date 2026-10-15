<script setup lang="ts">
defineProps<{ networkBits: number }>()
</script>

<template>
  <div class="flex flex-wrap gap-4 text-xs">
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded border border-net/50 bg-net-soft" />
      Network Bits <span class="font-mono text-net">{{ networkBits }}</span>
    </span>
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded border border-host/50 bg-host-soft" />
      Host Bits <span class="font-mono text-host">{{ 32 - networkBits }}</span>
    </span>
  </div>
</template>
