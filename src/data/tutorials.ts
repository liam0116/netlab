/**
 * Language-independent chapter structure. Text lives in src/i18n/content/tutorials.<locale>.ts
 * and is merged in by useTutorials(); step i of the text uses visuals[i] here.
 */
import type { SequenceMessage, TutorialChapterDef, TutorialVisual } from '@/types/tutorial'
import { cidrToMask } from '@/utils/network'
import {
  binaryToDecimalQuiz,
  broadcastAddressQuiz,
  cidrToMaskQuiz,
  decimalToBinaryQuiz,
  gatewayQuiz,
  invalidMaskQuiz,
  maskToCidrQuiz,
  networkAddressQuiz,
  privateIpQuiz,
  usableHostsQuiz,
  validIpQuiz,
  ackQuiz,
  handshakeAckQuiz,
  ouiQuiz,
  portToServiceQuiz,
  routingLpmQuiz,
  serviceToPortQuiz,
  staticQuiz,
} from '@/utils/quiz'

/** Running example used across chapters (spec example). */
export const EX_IP = '192.168.50.137'
export const EX_CIDR = 27

const phase1: TutorialChapterDef[] = [
  {
    id: 'binary',
    number: 1,
    phase: 1,
    visuals: [
      { kind: 'binary-sum', binary: '11111111' },
      { kind: 'binary-octet', value: 192, step: 0 },
      { kind: 'binary-octet', value: 192, step: 1 },
      { kind: 'binary-octet', value: 192, step: 2 },
      { kind: 'binary-octet', value: 192, step: 9 },
      { kind: 'binary-sum', binary: '11000000' },
      { kind: 'binary-octet', value: 168, step: 9 },
    ],
    quiz: [decimalToBinaryQuiz, binaryToDecimalQuiz, decimalToBinaryQuiz],
  },
  {
    id: 'ipv4',
    number: 2,
    phase: 1,
    visuals: [
      { kind: 'ip-octets', ip: '192.168.1.10' },
      { kind: 'bit-grid', ip: '192.168.1.10' },
      { kind: 'bit-grid', ip: '192.168.1.10', cidr: 24 },
      { kind: 'ip-octets', ip: '172.20.10.5', highlight: 1 },
      { kind: 'terminal', command: 'ip -4 addr show eth0', output: 'inet 169.254.23.7/16 scope link eth0' },
    ],
    quiz: [validIpQuiz, privateIpQuiz, binaryToDecimalQuiz],
  },
  {
    id: 'subnet-mask',
    number: 3,
    phase: 1,
    visuals: [
      { kind: 'mask-bits', cidr: 27, step: 0 },
      { kind: 'mask-bits', cidr: 27, step: 3 },
      { kind: 'mask-bits', cidr: 27, step: 4 },
      { kind: 'mask-bits', cidr: 27, step: 5 },
      { kind: 'bit-grid', ip: '255.255.255.240', cidr: 28 },
    ],
    quiz: [maskToCidrQuiz, invalidMaskQuiz, maskToCidrQuiz],
  },
  {
    id: 'cidr',
    number: 4,
    phase: 1,
    visuals: [
      { kind: 'mask-bits', cidr: EX_CIDR, step: 5 },
      { kind: 'subnet-range', ip: EX_IP, cidr: EX_CIDR, highlight: 'hosts' },
      { kind: 'bit-grid', ip: cidrToMask(24), cidr: 24, label: '/24' },
    ],
    quiz: [cidrToMaskQuiz, usableHostsQuiz, usableHostsQuiz],
  },
  {
    id: 'network-address',
    number: 5,
    phase: 1,
    visuals: [
      { kind: 'bitwise', ip: EX_IP, cidr: EX_CIDR, op: 'and' },
      { kind: 'subnet-blocks', ip: EX_IP, cidr: EX_CIDR },
      { kind: 'subnet-range', ip: EX_IP, cidr: EX_CIDR, highlight: 'network' },
    ],
    quiz: [networkAddressQuiz, networkAddressQuiz, networkAddressQuiz],
  },
  {
    id: 'broadcast-address',
    number: 6,
    phase: 1,
    visuals: [
      { kind: 'bitwise', ip: EX_IP, cidr: EX_CIDR, op: 'or' },
      { kind: 'subnet-range', ip: EX_IP, cidr: EX_CIDR, highlight: 'broadcast' },
      { kind: 'subnet-range', ip: EX_IP, cidr: EX_CIDR, highlight: 'hosts' },
    ],
    quiz: [broadcastAddressQuiz, broadcastAddressQuiz, usableHostsQuiz],
  },
  {
    id: 'gateway',
    number: 7,
    phase: 1,
    visuals: [
      {
        kind: 'link',
        a: { name: 'Server', ip: '10.20.30.150/26' },
        b: { name: 'Internet', ip: '8.8.8.8' },
        via: 'router',
        viaLabel: 'GW 10.20.30.129',
      },
      { kind: 'subnet-range', ip: '10.20.30.150', cidr: 26, highlight: 'hosts', gateway: '10.20.30.129' },
      {
        kind: 'link',
        a: { name: 'Server', ip: '192.168.10.50/24' },
        b: { name: 'Internet', ip: '8.8.8.8' },
        via: 'blocked',
        viaLabel: 'GW 192.168.20.1 ?',
      },
      {
        kind: 'terminal',
        command: 'ip route',
        output: 'default via 10.20.30.129 dev eth0 proto static\n10.20.30.128/26 dev eth0 proto kernel scope link src 10.20.30.150',
      },
    ],
    quiz: [gatewayQuiz, gatewayQuiz, networkAddressQuiz],
  },
]

// --- Phase 2 chapters ---------------------------------------------------------------------

const ROUTES = `default via 192.168.1.1 dev eth0 metric 100
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10
10.0.0.0/8 via 192.168.1.254 dev eth0
10.20.0.0/16 via 172.16.0.1 dev eth1
172.16.0.0/30 dev eth1 proto kernel scope link src 172.16.0.2`

const seq = (actors: string[], messages: SequenceMessage[]) => (step: number): TutorialVisual => ({
  kind: 'sequence',
  actors,
  messages,
  step,
})

const arpSeq = seq(
  ['Server A', 'Switch', 'Server B'],
  [
    { from: 0, to: 1, label: 'ARP Request (broadcast)', detail: 'Who has 192.168.1.20? Tell 192.168.1.10', tone: 'host' },
    { from: 1, to: 2, label: 'flood → all ports', detail: 'dst ff:ff:ff:ff:ff:ff', tone: 'host' },
    { from: 2, to: 0, label: 'ARP Reply (unicast)', detail: '192.168.1.20 is at 3c:ec:ef:aa:bb:cc', tone: 'ok' },
    { from: 0, to: 2, label: 'IPv4 → 3c:ec:ef:aa:bb:cc', detail: '192.168.1.10 → 192.168.1.20', tone: 'accent' },
  ],
)

const dhcpSeq = seq(
  ['Client', 'DHCP Server'],
  [
    { from: 0, to: 1, label: 'DHCP Discover', detail: '0.0.0.0:68 → 255.255.255.255:67', tone: 'host' },
    { from: 1, to: 0, label: 'DHCP Offer', detail: 'your IP: 192.168.1.50', tone: 'accent' },
    { from: 0, to: 1, label: 'DHCP Request', detail: 'requested: 192.168.1.50 (broadcast)', tone: 'host' },
    { from: 1, to: 0, label: 'DHCP Ack', detail: 'mask /24 · router .1 · dns .1 · lease 24h', tone: 'ok' },
  ],
)

const dnsSeq = seq(
  ['Client', 'Resolver', 'Root', '.com TLD', 'example.com'],
  [
    { from: 0, to: 1, label: 'A? www.example.com', detail: 'recursive', tone: 'accent' },
    { from: 1, to: 2, label: 'A? www…', tone: 'host' },
    { from: 2, to: 1, label: 'go ask .com', tone: 'warn' },
    { from: 1, to: 3, label: 'A? www…', tone: 'host' },
    { from: 3, to: 1, label: 'go ask example.com', tone: 'warn' },
    { from: 1, to: 4, label: 'A? www…', tone: 'host' },
    { from: 4, to: 1, label: 'A 93.184.215.14', detail: 'TTL 300', tone: 'ok' },
    { from: 1, to: 0, label: 'A 93.184.215.14', detail: 'cached', tone: 'ok' },
  ],
)

const routerSeq = seq(
  ['Server A', 'Router', 'Server C'],
  [
    { from: 0, to: 1, label: 'dst MAC = Router', detail: 'IP 10.0.1.10 → 10.0.2.20 · TTL 64', tone: 'accent' },
    { from: 1, to: 2, label: 'dst MAC = Server C', detail: 'IP 10.0.1.10 → 10.0.2.20 · TTL 63', tone: 'accent' },
  ],
)

const tcpDataSeq = seq(
  ['Client', 'Server'],
  [
    { from: 0, to: 1, label: 'seq=1001 len=500', tone: 'accent' },
    { from: 1, to: 0, label: 'ACK ack=1501', tone: 'ok' },
    { from: 0, to: 1, label: 'seq=1501 len=500', detail: 'lost', tone: 'err', lost: true },
    { from: 0, to: 1, label: 'seq=1501 len=500', detail: 'retransmit after timeout', tone: 'warn' },
    { from: 1, to: 0, label: 'ACK ack=2001', tone: 'ok' },
  ],
)

const tcpCloseSeq = seq(
  ['Client', 'Server'],
  [
    { from: 0, to: 1, label: 'FIN, ACK seq=2001', tone: 'host' },
    { from: 1, to: 0, label: 'ACK ack=2002', tone: 'ok' },
    { from: 1, to: 0, label: 'FIN, ACK seq=8001', tone: 'host' },
    { from: 0, to: 1, label: 'ACK ack=8002', tone: 'ok' },
  ],
)

const udpSeq = seq(
  ['Client :53211', 'DNS Server :53'],
  [
    { from: 0, to: 1, label: 'UDP  A? example.com', tone: 'accent' },
    { from: 1, to: 0, label: 'UDP  A 93.184.215.14', tone: 'ok' },
  ],
)

const failSeq = seq(
  ['Client', 'Server :3306'],
  [
    { from: 0, to: 1, label: 'SYN', detail: 'nothing listening', tone: 'host' },
    { from: 1, to: 0, label: 'RST, ACK', detail: 'Connection refused', tone: 'err' },
    { from: 0, to: 1, label: 'SYN', detail: 'firewall drops', tone: 'host', lost: true },
    { from: 0, to: 1, label: 'SYN (retry 1s, 3s…)', detail: 'Connection timed out', tone: 'err', lost: true },
  ],
)

const phase2: TutorialChapterDef[] = [
  {
    id: 'mac-address',
    number: 8,
    phase: 2,
    visuals: [
      { kind: 'mac-address', mac: '3c:ec:ef:12:34:56' },
      { kind: 'mac-address', mac: '3c:ec:ef:12:34:56', highlight: 'oui' },
      { kind: 'mac-address', mac: '02:42:ac:11:00:02', highlight: 'bits' },
      { kind: 'terminal', command: 'ip link show eth0', output: '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    link/ether 3c:ec:ef:12:34:56 brd ff:ff:ff:ff:ff:ff' },
    ],
    quiz: [staticQuiz('macBits'), ouiQuiz, staticQuiz('broadcastMac')],
  },
  {
    id: 'arp',
    number: 9,
    phase: 2,
    visuals: [
      arpSeq(0),
      arpSeq(1),
      arpSeq(2),
      arpSeq(3),
      arpSeq(4),
      { kind: 'terminal', command: 'ip neigh', output: '192.168.1.1 dev eth0 lladdr 00:1a:2b:3c:4d:5e REACHABLE\n192.168.1.20 dev eth0 lladdr 3c:ec:ef:aa:bb:cc STALE' },
      { kind: 'terminal', command: 'tcpdump -ni eth0 arp', output: 'ARP, Request who-has 192.168.1.1 tell 192.168.1.10, length 28\nARP, Reply 192.168.1.1 is-at 00:1a:2b:3c:4d:5e, length 46' },
    ],
    quiz: [staticQuiz('arpBroadcast'), staticQuiz('arpGateway'), staticQuiz('arpCommand')],
  },
  {
    id: 'switch',
    number: 10,
    phase: 2,
    visuals: [
      { kind: 'mac-table', step: 0 },
      { kind: 'mac-table', step: 1 },
      { kind: 'mac-table', step: 2 },
      { kind: 'mac-table', step: 3 },
      {
        kind: 'terminal',
        command: 'show mac address-table',
        output: 'Vlan  Mac Address       Type     Ports\n----  ----------------  -------  -----\n  20  3c:ec:ef:12:34:56  DYNAMIC  Gi1/0/5\n  20  00:1a:2b:3c:4d:5e  DYNAMIC  Gi1/0/48',
      },
    ],
    quiz: [staticQuiz('switchFlood'), staticQuiz('switchLearn'), staticQuiz('broadcastMac')],
  },
  {
    id: 'router',
    number: 11,
    phase: 2,
    visuals: [
      { kind: 'link', a: { name: 'Server A', ip: '10.0.1.10/24' }, b: { name: 'Server C', ip: '10.0.2.20/24' }, via: 'router', viaLabel: 'Router' },
      { kind: 'routing-table', routes: ROUTES, dst: '10.20.30.40' },
      routerSeq(2),
      { kind: 'terminal', command: 'traceroute -n 10.0.2.20', output: ' 1  10.0.1.1  0.412 ms  0.398 ms  0.377 ms\n 2  10.0.2.20  0.851 ms  0.832 ms  0.820 ms' },
    ],
    quiz: [staticQuiz('routerTtl'), staticQuiz('routerMac'), routingLpmQuiz],
  },
  {
    id: 'vlan',
    number: 12,
    phase: 2,
    visuals: [
      { kind: 'vlan-switch', highlight: 'access' },
      { kind: 'vlan-frame', tagged: false },
      { kind: 'vlan-switch', highlight: 'trunk' },
      { kind: 'vlan-frame', tagged: true },
      {
        kind: 'terminal',
        command: 'ip link add link eth0 name eth0.20 type vlan id 20',
        output: '$ ip addr add 10.0.20.5/24 dev eth0.20 && ip link set eth0.20 up\n$ ip -d link show eth0.20\n5: eth0.20@eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n    vlan protocol 802.1Q id 20',
      },
      { kind: 'link', a: { name: 'Server', ip: 'VLAN 20' }, b: { name: 'Gateway', ip: 'VLAN 20' }, via: 'blocked', viaLabel: 'Port VLAN 30' },
    ],
    quiz: [staticQuiz('vlanRange'), staticQuiz('vlanTrunk'), staticQuiz('vlanInter')],
  },
  {
    id: 'dhcp',
    number: 13,
    phase: 2,
    visuals: [
      dhcpSeq(0),
      dhcpSeq(1),
      dhcpSeq(2),
      dhcpSeq(3),
      dhcpSeq(4),
      {
        kind: 'terminal',
        command: 'dhclient -v eth0',
        output: 'DHCPDISCOVER on eth0 to 255.255.255.255 port 67 interval 3\nDHCPOFFER of 192.168.1.50 from 192.168.1.1\nDHCPREQUEST for 192.168.1.50 on eth0 to 255.255.255.255 port 67\nDHCPACK of 192.168.1.50 from 192.168.1.1\nbound to 192.168.1.50 -- renewal in 41211 seconds.',
      },
    ],
    quiz: [staticQuiz('doraOrder'), staticQuiz('dhcpPorts'), staticQuiz('apipa')],
  },
  {
    id: 'dns',
    number: 14,
    phase: 2,
    visuals: [
      dnsSeq(0),
      dnsSeq(1),
      dnsSeq(3),
      dnsSeq(5),
      dnsSeq(8),
      {
        kind: 'terminal',
        command: 'dig www.example.com +noall +answer',
        output: 'www.example.com.   300   IN   A   93.184.215.14',
      },
    ],
    quiz: [staticQuiz('dnsPort'), staticQuiz('dnsA'), staticQuiz('dnsPtr')],
  },
  {
    id: 'nat',
    number: 15,
    phase: 2,
    visuals: [
      { kind: 'nat-table', step: 0 },
      { kind: 'nat-table', step: 1 },
      { kind: 'nat-table', step: 2 },
      { kind: 'nat-table', step: 3 },
      {
        kind: 'terminal',
        command: 'iptables -t nat -S',
        output: '-A PREROUTING -d 203.0.113.10/32 -p tcp --dport 443 -j DNAT --to-destination 10.0.0.20:443\n-A POSTROUTING -s 192.168.1.0/24 -o wan0 -j MASQUERADE',
      },
    ],
    quiz: [staticQuiz('natWhy'), staticQuiz('natPat'), staticQuiz('natDnat')],
  },
  {
    id: 'tcp',
    number: 16,
    phase: 2,
    visuals: [
      { kind: 'handshake', step: 3 },
      tcpDataSeq(2),
      tcpDataSeq(5),
      tcpCloseSeq(4),
      {
        kind: 'terminal',
        command: 'ss -tan',
        output: 'State      Recv-Q Send-Q  Local Address:Port   Peer Address:Port\nLISTEN     0      128           0.0.0.0:22          0.0.0.0:*\nESTAB      0      0          10.0.0.5:51544     10.0.0.20:443\nTIME-WAIT  0      0          10.0.0.5:51530     10.0.0.20:443',
      },
    ],
    quiz: [staticQuiz('tcpReliable'), ackQuiz, staticQuiz('tcpRst')],
  },
  {
    id: 'udp',
    number: 17,
    phase: 2,
    visuals: [
      udpSeq(2),
      { kind: 'tcp-udp' },
      { kind: 'terminal', command: 'nc -zvu 10.0.0.53 53', output: 'Connection to 10.0.0.53 53 port [udp/domain] succeeded!' },
    ],
    quiz: [staticQuiz('udpHandshake'), staticQuiz('udpUse'), staticQuiz('dhcpPorts')],
  },
  {
    id: 'port',
    number: 18,
    phase: 2,
    visuals: [
      { kind: 'socket' },
      { kind: 'terminal', command: 'cat /proc/sys/net/ipv4/ip_local_port_range', output: '32768\t60999' },
      { kind: 'socket' },
      {
        kind: 'terminal',
        command: 'ss -tlnp',
        output: 'State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\nLISTEN 0      128          0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=880,fd=3))\nLISTEN 0      511          0.0.0.0:443        0.0.0.0:*     users:(("nginx",pid=912,fd=7))',
      },
    ],
    quiz: [serviceToPortQuiz, portToServiceQuiz, staticQuiz('portRange')],
  },
  {
    id: 'tcp-handshake',
    number: 19,
    phase: 2,
    visuals: [
      { kind: 'handshake', step: 0 },
      { kind: 'handshake', step: 1 },
      { kind: 'handshake', step: 2 },
      { kind: 'handshake', step: 3 },
      { kind: 'handshake', step: 5 },
      failSeq(4),
    ],
    quiz: [staticQuiz('handshakeOrder'), handshakeAckQuiz, staticQuiz('handshakeTimeout')],
  },
  {
    id: 'routing',
    number: 20,
    phase: 2,
    visuals: [
      { kind: 'routing-table', routes: ROUTES, dst: '8.8.8.8' },
      { kind: 'routing-table', routes: ROUTES, dst: '10.20.30.40' },
      { kind: 'routing-table', routes: ROUTES, dst: '192.168.1.50' },
      {
        kind: 'terminal',
        command: 'ip route get 10.20.30.40',
        output: '10.20.30.40 via 172.16.0.1 dev eth1 src 172.16.0.2 uid 0',
      },
      { kind: 'routing-table', routes: ROUTES, dst: '10.99.1.1' },
    ],
    quiz: [routingLpmQuiz, routingLpmQuiz, staticQuiz('defaultRoute')],
  },
]

export const chapterDefs: TutorialChapterDef[] = [...phase1, ...phase2]
