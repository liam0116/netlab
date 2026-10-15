<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatRoute, lookupRoute, parseIpRoute } from '@/utils/routing'
import { isValidIPv4 } from '@/utils/network'

/** A routing table with a live destination lookup (longest prefix match). */
const props = defineProps<{ routes: string; dst: string }>()
const { t } = useI18n()

const dst = ref(props.dst)
watch(
  () => props.dst,
  (v) => (dst.value = v),
)
const table = computed(() => parseIpRoute(props.routes))
const lookup = computed(() => (isValidIPv4(dst.value) ? lookupRoute(table.value, dst.value) : null))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <label for="rt-dst" class="text-xs text-muted">{{ t('visuals.routing.dst') }}</label>
      <input id="rt-dst" v-model.trim="dst" class="field max-w-48" :class="{ 'field-invalid': !isValidIPv4(dst) }" spellcheck="false" />
    </div>
    <div class="overflow-x-auto rounded-lg border border-line">
      <table class="w-full font-mono text-xs">
        <thead class="bg-surface-2 text-left text-muted">
          <tr>
            <th class="px-3 py-1.5 font-normal">ip route</th>
            <th class="px-3 py-1.5 text-right font-normal">{{ t('visuals.routing.prefix') }}</th>
            <th class="px-3 py-1.5" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(c, i) in lookup?.candidates ?? []"
            :key="i"
            class="border-t border-line transition-colors"
            :class="c.route === lookup?.match ? 'bg-ok-soft text-ok' : c.matches ? 'text-fg' : 'text-muted/60'"
          >
            <td class="px-3 py-1.5 whitespace-nowrap">{{ formatRoute(c.route) }}</td>
            <td class="px-3 py-1.5 text-right">/{{ c.prefix }}</td>
            <td class="px-3 py-1.5 text-right font-sans whitespace-nowrap">
              <span v-if="c.route === lookup?.match">✓ {{ t('visuals.routing.winner') }}</span>
              <span v-else-if="c.matches">{{ t('visuals.routing.matches') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="lookup" class="rounded-md border px-3 py-2 font-mono text-sm" :class="lookup.match ? 'border-ok/40 text-ok' : 'border-err/40 text-err'">
      <template v-if="lookup.match">{{ t('visuals.routing.result') }}: {{ dst }} → {{ lookup.match.via ? `via ${lookup.match.via}` : 'direct' }} dev {{ lookup.match.dev }}</template>
      <template v-else>{{ t('visuals.routing.noRoute') }}</template>
    </div>
  </div>
</template>
