<script setup lang="ts">
import { computed } from 'vue'
import type { TutorialVisual } from '@/types/tutorial'
import BinaryOctetAnimator from '@/components/network/BinaryOctetAnimator.vue'
import BinarySumView from '@/components/network/BinarySumView.vue'
import IpOctets from '@/components/network/IpOctets.vue'
import BitGrid from '@/components/network/BitGrid.vue'
import BitLegend from '@/components/network/BitLegend.vue'
import MaskBitsAnimator from '@/components/network/MaskBitsAnimator.vue'
import BitwiseOperation from '@/components/network/BitwiseOperation.vue'
import SubnetRangeBar from '@/components/network/SubnetRangeBar.vue'
import SubnetBlocksList from '@/components/network/SubnetBlocksList.vue'
import DeviceLinkDiagram from '@/components/network/DeviceLinkDiagram.vue'
import TerminalBlock from '@/components/common/TerminalBlock.vue'
import SequenceDiagram from './visuals/SequenceDiagram.vue'
import HandshakeVisual from './visuals/HandshakeVisual.vue'
import MacAddressVisual from './visuals/MacAddressVisual.vue'
import MacTableVisual from './visuals/MacTableVisual.vue'
import VlanFrameVisual from './visuals/VlanFrameVisual.vue'
import VlanSwitchVisual from './visuals/VlanSwitchVisual.vue'
import NatTableVisual from './visuals/NatTableVisual.vue'
import RoutingTableVisual from './visuals/RoutingTableVisual.vue'
import SocketVisual from './visuals/SocketVisual.vue'
import TcpUdpVisual from './visuals/TcpUdpVisual.vue'
import { calculateSubnet, ipToInt } from '@/utils/network'

const props = defineProps<{ visual: TutorialVisual }>()

const rangeInfo = computed(() =>
  props.visual.kind === 'subnet-range' ? calculateSubnet(props.visual.ip, props.visual.cidr) : null,
)
</script>

<template>
  <BinaryOctetAnimator v-if="visual.kind === 'binary-octet'" :value="visual.value" :step="visual.step" />
  <BinarySumView v-else-if="visual.kind === 'binary-sum'" :binary="visual.binary" />
  <IpOctets v-else-if="visual.kind === 'ip-octets'" :ip="visual.ip" :highlight="visual.highlight" />
  <div v-else-if="visual.kind === 'bit-grid'" class="flex flex-col items-center gap-3">
    <BitGrid :value="ipToInt(visual.ip)" :cidr="visual.cidr" :label="visual.label" />
    <BitLegend v-if="visual.cidr !== undefined" :network-bits="visual.cidr" />
  </div>
  <MaskBitsAnimator v-else-if="visual.kind === 'mask-bits'" :cidr="visual.cidr" :step="visual.step" />
  <BitwiseOperation v-else-if="visual.kind === 'bitwise'" :ip="visual.ip" :cidr="visual.cidr" :op="visual.op" />
  <SubnetRangeBar
    v-else-if="visual.kind === 'subnet-range' && rangeInfo"
    :info="rangeInfo"
    :highlight="visual.highlight"
    :gateway="visual.gateway"
  />
  <SubnetBlocksList v-else-if="visual.kind === 'subnet-blocks'" :ip="visual.ip" :cidr="visual.cidr" />
  <DeviceLinkDiagram
    v-else-if="visual.kind === 'link'"
    :a="visual.a"
    :b="visual.b"
    :via="visual.via"
    :via-label="visual.viaLabel"
  />
  <TerminalBlock v-else-if="visual.kind === 'terminal'" :command="visual.command" :output="visual.output" />
  <SequenceDiagram v-else-if="visual.kind === 'sequence'" :actors="visual.actors" :messages="visual.messages" :step="visual.step" />
  <HandshakeVisual v-else-if="visual.kind === 'handshake'" :step="visual.step" />
  <MacAddressVisual v-else-if="visual.kind === 'mac-address'" :mac="visual.mac" :highlight="visual.highlight" />
  <MacTableVisual v-else-if="visual.kind === 'mac-table'" :step="visual.step" />
  <VlanFrameVisual v-else-if="visual.kind === 'vlan-frame'" :tagged="visual.tagged" />
  <VlanSwitchVisual v-else-if="visual.kind === 'vlan-switch'" :highlight="visual.highlight" />
  <NatTableVisual v-else-if="visual.kind === 'nat-table'" :step="visual.step" />
  <RoutingTableVisual v-else-if="visual.kind === 'routing-table'" :routes="visual.routes" :dst="visual.dst" />
  <SocketVisual v-else-if="visual.kind === 'socket'" />
  <TcpUdpVisual v-else-if="visual.kind === 'tcp-udp'" />
</template>
