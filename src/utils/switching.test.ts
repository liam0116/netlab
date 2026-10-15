import { describe, expect, it } from 'vitest'
import { processFrames } from './switching'
import { BROADCAST_MAC } from './mac'

const A = 'aa:aa:aa:aa:aa:aa'
const B = 'bb:bb:bb:bb:bb:bb'
const PORTS = [1, 2, 3, 4]

describe('processFrames (MAC learning)', () => {
  it('floods unknown destinations, learns sources, then forwards', () => {
    const [first, reply, again] = processFrames(
      [
        { inPort: 1, srcMac: A, dstMac: B },
        { inPort: 2, srcMac: B, dstMac: A },
        { inPort: 1, srcMac: A, dstMac: B },
      ],
      PORTS,
    )
    expect(first).toMatchObject({ learned: { mac: A, port: 1 }, action: 'flood', outPorts: [2, 3, 4] })
    expect([...first!.table]).toEqual([[A, 1]])
    expect(reply).toMatchObject({ learned: { mac: B, port: 2 }, action: 'forward', outPorts: [1] })
    expect(again).toMatchObject({ learned: null, action: 'forward', outPorts: [2] })
  })

  it('always floods broadcast', () => {
    const [, bcast] = processFrames(
      [
        { inPort: 2, srcMac: B, dstMac: A },
        { inPort: 1, srcMac: A, dstMac: BROADCAST_MAC },
      ],
      PORTS,
    )
    expect(bcast).toMatchObject({ action: 'flood', outPorts: [2, 3, 4] })
  })

  it('filters frames whose destination is on the ingress port and relearns moved MACs', () => {
    const r = processFrames(
      [
        { inPort: 1, srcMac: A, dstMac: B },
        { inPort: 1, srcMac: B, dstMac: A },
        { inPort: 3, srcMac: A, dstMac: B },
      ],
      PORTS,
    )
    expect(r[1]).toMatchObject({ action: 'filter', outPorts: [] })
    expect(r[2]!.learned).toEqual({ mac: A, port: 3 })
  })
})
