/**
 * Transparent bridge (switch) MAC learning: learn the source MAC on the ingress port, then
 * forward to the known port of the destination MAC, or flood when it is unknown / broadcast.
 */
import { BROADCAST_MAC } from './mac'

export interface SwitchFrame {
  inPort: number
  srcMac: string
  dstMac: string
}

export interface SwitchDecision {
  frame: SwitchFrame
  learned: { mac: string; port: number } | null
  action: 'forward' | 'flood' | 'filter'
  outPorts: number[]
  /** MAC table after processing this frame. */
  table: Map<string, number>
}

export function processFrames(frames: SwitchFrame[], ports: number[]): SwitchDecision[] {
  const table = new Map<string, number>()
  return frames.map((frame) => {
    let learned: SwitchDecision['learned'] = null
    if (table.get(frame.srcMac) !== frame.inPort) {
      table.set(frame.srcMac, frame.inPort)
      learned = { mac: frame.srcMac, port: frame.inPort }
    }
    const known = frame.dstMac === BROADCAST_MAC ? undefined : table.get(frame.dstMac)
    let action: SwitchDecision['action']
    let outPorts: number[]
    if (known === undefined) {
      action = 'flood'
      outPorts = ports.filter((p) => p !== frame.inPort)
    } else if (known === frame.inPort) {
      action = 'filter'
      outPorts = []
    } else {
      action = 'forward'
      outPorts = [known]
    }
    return { frame, learned, action, outPorts, table: new Map(table) }
  })
}
