/**
 * "Server cannot reach the Internet" wizard. Each step is a check; failing a check stops the wizard
 * at the diagnosis with the same id. Text lives in src/i18n/content/troubleshooting.<locale>.ts.
 */
export interface TroubleStep {
  id: 'link' | 'addr' | 'route' | 'gateway' | 'public' | 'dns'
  /** `{gateway}` is replaced with the gateway the user entered. */
  command: string
  normalOutput: string
  abnormalOutput: string
}

export const TROUBLE_STEPS: TroubleStep[] = [
  {
    id: 'link',
    command: 'ip link show',
    normalOutput: '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP',
    abnormalOutput: '2: eth0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 state DOWN',
  },
  {
    id: 'addr',
    command: 'ip -4 addr show',
    normalOutput: 'inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0',
    abnormalOutput: 'inet 169.254.23.7/16 scope link eth0',
  },
  {
    id: 'route',
    command: 'ip route',
    normalOutput: 'default via {gateway} dev eth0 proto static\n192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10',
    abnormalOutput: '192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10',
  },
  {
    id: 'gateway',
    command: 'ping -c 4 {gateway}',
    normalOutput: '4 packets transmitted, 4 received, 0% packet loss',
    abnormalOutput: 'From 192.168.1.10 icmp_seq=1 Destination Host Unreachable\n4 packets transmitted, 0 received, +4 errors, 100% packet loss',
  },
  {
    id: 'public',
    command: 'ping -c 4 8.8.8.8',
    normalOutput: '64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=6.21 ms\n4 packets transmitted, 4 received, 0% packet loss',
    abnormalOutput: '4 packets transmitted, 0 received, 100% packet loss, time 3070ms',
  },
  {
    id: 'dns',
    command: 'dig google.com',
    normalOutput: ';; ->>HEADER<<- opcode: QUERY, status: NOERROR\ngoogle.com.  170  IN  A  142.250.196.206',
    abnormalOutput: ';; communications error to 192.168.1.1#53: timed out\n;; no servers could be reached',
  },
]

export function fillGateway(text: string, gateway: string): string {
  return text.replaceAll('{gateway}', gateway.trim() || '<gateway>')
}
