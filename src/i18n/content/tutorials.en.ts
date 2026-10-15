import type { TutorialChapterText } from '@/types/tutorial'
import { EX_CIDR, EX_IP } from '@/data/tutorials'
import { calculateSubnet, cidrToMask, getUsableHosts } from '@/utils/network'

const ex = calculateSubnet(EX_IP, EX_CIDR)
const common = [24, 25, 26, 27, 28, 29, 30, 32].map((c) => `\`/${c} = ${cidrToMask(c)} → ${getUsableHosts(c)} hosts\``)

const tutorialsEn: Record<string, TutorialChapterText> = {
  binary: {
    title: 'Binary',
    summary: 'Turn decimal into 8 bits by subtracting place values, then add them back.',
    steps: [
      {
        title: 'One octet = 8 bits',
        body: [
          'Each part (octet) of an IPv4 address is 8 bits, and each bit is either 0 or 1.',
          'From left to right the place values are 128, 64, 32, 16, 8, 4, 2, 1; each is double the one to its right.',
          'All 8 bits set = 128+64+32+16+8+4+2+1 = 255, which is why an octet never exceeds 255.',
        ],
      },
      { title: 'Example: 192 to binary', body: ['Start at 128 on the left and check, one by one, whether the remaining number fits.'] },
      { title: '192 >= 128 → bit = 1', body: ['192 is at least 128, so the 128 bit is 1. 192 − 128 = 64 remains; keep going right.'] },
      { title: '64 >= 64 → bit = 1', body: ['The remaining 64 equals 64, so this bit is 1 too. 64 − 64 = 0.'] },
      {
        title: 'Nothing left, the rest are 0',
        body: ['The remainder is 0, so 32, 16, 8, 4, 2 and 1 do not fit and are all 0.', 'Result: 192 = `11000000` = 128 + 64.'],
      },
      { title: 'Reverse: binary → decimal', body: ['Add up the place values whose bit is 1. `11000000` → 128 + 64 = 192.'] },
      {
        title: 'One more: 168',
        body: ['168 ≥ 128 → 1, 40 left; 40 < 64 → 0; 40 ≥ 32 → 1, 8 left; 8 < 16 → 0; 8 ≥ 8 → 1, 0 left; the rest are 0.'],
        example: 'The first two octets of 192.168.x.x are 11000000.10101000',
      },
    ],
  },
  ipv4: {
    title: 'IPv4',
    summary: '32 bits, 4 octets, private and special addresses.',
    steps: [
      {
        title: 'An IPv4 address is 32 bits',
        body: [
          'An IPv4 address is really one 32-bit number. For humans it is split into 4 groups of 8 bits, each written in decimal and joined with dots: dotted decimal.',
        ],
      },
      {
        title: 'Every octet is 0–255',
        body: ['With only 8 bits per octet, the range is 00000000 (0) to 11111111 (255). An address like `192.168.1.256` does not exist.'],
      },
      {
        title: 'Network part + host part',
        body: [
          'The subnet mask splits the 32 bits in two: the leading network bits say "which network", the trailing host bits say "which device on it".',
          'With /24, the first 24 bits (192.168.1) are the network and the last 8 bits (.10) the host.',
        ],
      },
      {
        title: 'Private IPs (RFC 1918)',
        body: [
          'These three ranges are reserved for internal networks, are not routed on the Internet, and need NAT to get online:',
          '`10.0.0.0/8`   `172.16.0.0/12` (172.16–172.31)   `192.168.0.0/16`',
        ],
        example: '172.32.0.1 is NOT private: 172.16.0.0/12 ends at 172.31.255.255.',
      },
      {
        title: 'Special addresses to recognize',
        body: [
          '`127.0.0.1` loopback: the host talking to itself, for testing local services.',
          '`169.254.x.x` link-local (APIPA): usually means DHCP failed and the server got no IP.',
          '`0.0.0.0` is the default route in a routing table, and "all interfaces" in `ss -lnt`.',
          '`255.255.255.255` is the limited broadcast.',
        ],
        example: 'Seeing `inet 169.254.23.7/16` means this NIC did not get an address from DHCP.',
      },
    ],
  },
  'subnet-mask': {
    title: 'Subnet Mask',
    summary: 'A mask marks network bits with contiguous 1s and host bits with 0s.',
    steps: [
      {
        title: 'The mask sets the network / host boundary',
        body: ['A subnet mask is also 32 bits. Positions with 1 are network bits; positions with 0 are host bits.', 'For example `255.255.255.224`:'],
      },
      { title: 'Count network bits: first three octets', body: ['255 = 11111111, eight 1s each. The first three octets give 8 + 8 + 8 = 24.'] },
      { title: 'Count network bits: fourth octet', body: ['224 = 11100000, which has three 1s.'] },
      {
        title: '255.255.255.224 = /27',
        body: ['8 + 8 + 8 + 3 = 27, so in CIDR this mask is /27, leaving 32 − 27 = 5 host bits.'],
      },
      {
        title: 'Mask bits must be contiguous',
        body: [
          'A mask is always "contiguous 1s on the left + contiguous 0s on the right", so an octet can only be:',
          '`0` `128` `192` `224` `240` `248` `252` `254` `255`',
          '`255.255.0.255` and `255.255.255.100` are invalid masks.',
        ],
      },
    ],
  },
  cidr: {
    title: 'CIDR',
    summary: '/n means the first n bits are network bits, and how to count hosts.',
    steps: [
      {
        title: 'CIDR is shorthand for the mask',
        body: [
          'CIDR (Classless Inter-Domain Routing) writes `/n` for a mask with n contiguous 1s.',
          `\`${EX_IP}/${EX_CIDR}\` means IP ${EX_IP} with mask ${ex.subnetMask}.`,
        ],
      },
      {
        title: 'Counting hosts',
        body: [
          `Host bits = 32 − ${EX_CIDR} = ${ex.hostBits}; total addresses = 2^${ex.hostBits} = ${ex.totalAddresses}.`,
          `Minus the network and broadcast addresses: usable hosts = ${ex.totalAddresses} − 2 = ${ex.usableHosts}.`,
        ],
      },
      {
        title: 'Common prefixes',
        body: [
          'Each network bit you remove doubles the address count:',
          ...common,
          '`/31` is for point-to-point links (RFC 3021, both addresses usable); `/32` is a single host.',
        ],
      },
    ],
  },
  'network-address': {
    title: 'Network Address',
    summary: 'IP AND mask, plus the block size shortcut.',
    steps: [
      {
        title: 'IP AND mask = network address',
        body: [
          'AND gives 1 only when both bits are 1. Where the mask is 1 the IP bit is kept; where it is 0 the bit becomes 0.',
          `${EX_IP} AND ${ex.subnetMask} = ${ex.networkAddress}`,
        ],
      },
      {
        title: 'The block size shortcut',
        body: [
          'At work you rarely convert to binary: find the mask octet that is not 255, and 256 minus it is the block size.',
          'Whichever block the IP octet falls into, that block’s start is the network.',
        ],
      },
      {
        title: 'The network address is not assignable',
        body: [
          `${ex.networkAddress} means "the whole subnet". It appears in routing tables, e.g. \`${ex.networkAddress}/${EX_CIDR} dev eth0\`, and is never configured on an interface.`,
        ],
      },
    ],
  },
  'broadcast-address': {
    title: 'Broadcast Address',
    summary: 'All host bits set to 1, plus first and last host.',
    steps: [
      {
        title: 'All host bits become 1',
        body: [
          'Broadcast = network OR wildcard. The wildcard is the inverted mask (host bits are 1), so OR sets every host bit to 1.',
          `${ex.networkAddress} OR ${ex.wildcardMask} = ${ex.broadcastAddress}`,
        ],
      },
      {
        title: 'What broadcast is for',
        body: [
          'A packet sent to the broadcast address reaches every device on the subnet. ARP requests and DHCP discovers rely on it.',
          'Shortcut: broadcast = next block’s network − 1.',
        ],
      },
      {
        title: 'First host / last host',
        body: [
          `First host = network + 1 = ${ex.firstHost}`,
          `Last host = broadcast − 1 = ${ex.lastHost}`,
          `Only these ${ex.usableHosts} addresses can be given to servers, switch management interfaces and gateways.`,
        ],
      },
    ],
  },
  gateway: {
    title: 'Gateway',
    summary: 'Traffic to other networks goes to the gateway, which must be on the local subnet.',
    steps: [
      {
        title: 'Other networks go via the gateway',
        body: [
          'Before sending, a server checks if the destination is on its own subnet. If not, the packet goes to the default gateway (usually a router or L3 switch interface).',
        ],
      },
      {
        title: 'The gateway must be on the same subnet',
        body: [
          'The server ARPs "who is the gateway?" to learn its MAC, and ARP only works inside the subnet.',
          '10.20.30.150/26 → network 10.20.30.128, usable .129–.190; gateway .129 is in range ✓',
        ],
      },
      {
        title: 'A broken example',
        body: [
          'Server 192.168.10.50/24, but the gateway is set to 192.168.20.1.',
          'Server network = 192.168.10.0/24, gateway network = 192.168.20.0/24: the gateway is not local, so packets cannot leave.',
        ],
      },
      {
        title: 'Checking the gateway on Linux',
        body: ['`default via` in `ip route` is the default gateway. Then `ping` it to see if it answers.'],
        example: 'Default gateway = 10.20.30.129',
      },
    ],
  },
  'mac-address': {
    title: 'MAC Address',
    summary: 'Layer 2 addresses: 48 bits, OUI and NIC part, unicast and broadcast.',
    steps: [
      {
        title: 'MAC = the NIC’s hardware address',
        body: [
          'A MAC address is the Layer 2 (Ethernet) address: 48 bits written as 6 hex pairs, e.g. `3c:ec:ef:12:34:56`.',
          'It is usually burned into the NIC at the factory. Within a network segment, switches use MACs to decide which port a frame goes to.',
        ],
      },
      {
        title: 'Vendor half, serial half',
        body: [
          'The first 3 bytes are the OUI (Organizationally Unique Identifier), assigned to the vendor by the IEEE; the vendor assigns the last 3 bytes to each NIC.',
          'Looking up the OUI tells you who made the NIC, handy when working out "what device is this IP?".',
        ],
        example: 'An unfamiliar MAC in the switch table: look up its first 3 bytes to tell Dell, Supermicro or a virtual machine apart.',
      },
      {
        title: 'Two special bits in the first byte',
        body: [
          'I/G bit (lowest): 0 is unicast, 1 is multicast. `ff:ff:ff:ff:ff:ff` is all ones: broadcast.',
          'U/L bit (second lowest): 1 means a locally administered address, not burned in by a vendor. Docker and KVM virtual NICs often start with `02:`.',
        ],
      },
      {
        title: 'IP is end to end, MAC is next hop only',
        body: [
          'IP addresses stay the same from source to destination; MAC addresses only matter within one Layer 2 segment and change at every router.',
          'On Linux, the `link/ether` line of `ip link` is the MAC.',
        ],
      },
    ],
  },
  arp: {
    title: 'ARP',
    summary: 'Know the IP but not the MAC? Broadcast "Who has …?".',
    steps: [
      {
        title: 'Why ARP is needed',
        body: [
          'Server A wants to send to 192.168.1.20. It knows the IP, but an Ethernet frame needs the MAC.',
          'ARP (Address Resolution Protocol) turns an IP into a MAC.',
        ],
      },
      {
        title: 'ARP request: broadcast question',
        body: ['Server A broadcasts to `ff:ff:ff:ff:ff:ff`: "Who has 192.168.1.20? Tell 192.168.1.10".'],
      },
      {
        title: 'The switch floods the broadcast',
        body: ['The broadcast reaches every device in the VLAN. Each one checks: is that my IP?'],
      },
      {
        title: 'ARP reply: unicast answer',
        body: ['Only 192.168.1.20 answers, unicast straight back to Server A: "192.168.1.20 is at 3c:ec:ef:aa:bb:cc".'],
      },
      {
        title: 'MAC known, data flows',
        body: ['Server A stores the mapping in its ARP table, and following frames go straight to that MAC without asking again.'],
      },
      {
        title: 'The ARP table (ARP cache)',
        body: [
          '`ip neigh` shows the current mappings. `REACHABLE` was confirmed recently, `STALE` is idle but kept, `FAILED` means nobody answered.',
          'A `FAILED` gateway almost always means Layer 2 is broken: cable, VLAN or a wrong IP.',
        ],
      },
      {
        title: 'For the Internet, ARP asks for the gateway',
        body: [
          'When the destination is not local, the server does not ARP for it; it ARPs for the default gateway’s MAC and hands the packet over.',
          '`tcpdump -ni eth0 arp` shows the requests and replies directly.',
        ],
        example: 'Only repeated requests and never a reply means the peer is not on this Layer 2 segment.',
      },
    ],
  },
  switch: {
    title: 'Switch',
    summary: 'MAC table, learning, flooding, forwarding.',
    steps: [
      {
        title: 'Switches forward frames by MAC',
        body: [
          'A switch works at Layer 2. It ignores IPs and only reads frame MACs.',
          'It keeps a MAC address table: which MAC sits on which port. After boot the table is empty.',
        ],
      },
      {
        title: 'Learn the source, flood unknown destinations',
        body: [
          'Host A on port 1 sends a frame to B. The switch first records "A is on port 1" (learning from the source MAC).',
          'It does not know where B is yet, so it sends the frame out of every port except port 1 (flooding).',
        ],
      },
      {
        title: 'B replies, the switch learns again',
        body: ['B answers A from port 2. The switch learns "B is on port 2", and since it already knows A is on port 1, it sends only there.'],
      },
      {
        title: 'From now on, direct forwarding',
        body: ['When A sends to B again, both are known: the switch sends only to port 2 and other ports never see the frame.'],
      },
      {
        title: 'Looking at the MAC table on a switch',
        body: [
          'Broadcast frames are always flooded; idle MAC entries age out (often after 300 seconds).',
          'To find which port a server is on, look up its MAC on the switch.',
        ],
      },
    ],
  },
  router: {
    title: 'Router',
    summary: 'Connects networks, forwards by routing table, new MACs and TTL − 1 at each hop.',
    steps: [
      {
        title: 'Routers connect different networks',
        body: [
          'A router works at Layer 3 and each interface is in a different subnet. Traffic between subnets must pass a router (or L3 switch).',
          'A host’s default gateway is the router’s interface IP in that host’s subnet.',
        ],
      },
      {
        title: 'The routing table picks the next hop',
        body: ['The router looks up the destination IP; among matching routes it picks the longest prefix. Try changing the destination above.'],
      },
      {
        title: 'New MACs each hop, same IPs',
        body: [
          'Server A’s frame is addressed to the router’s MAC; the router re-frames it with Server C’s MAC.',
          'Source and destination IPs stay the same (without NAT), but TTL drops by one.',
        ],
      },
      {
        title: 'TTL and traceroute',
        body: ['When TTL reaches 0 the router drops the packet and replies ICMP Time Exceeded. traceroute starts at TTL = 1 to reveal the path hop by hop.'],
      },
    ],
  },
  vlan: {
    title: 'VLAN',
    summary: 'One switch, several networks: access, trunk, 802.1Q.',
    steps: [
      {
        title: 'One switch, several isolated networks',
        body: [
          'VLANs split one physical switch into isolated broadcast domains. A VLAN 10 broadcast never reaches VLAN 20.',
          'Usually each VLAN maps to one IP subnet, e.g. separate Management, Server and Storage VLANs.',
        ],
      },
      {
        title: 'Access ports',
        body: ['Ports for ordinary servers are access ports in one VLAN. Frames carry no VLAN tag, so the server does not even know its VLAN.'],
      },
      {
        title: 'Trunk ports',
        body: [
          'Links between switches, to routers or to hypervisors carry several VLANs, so they are trunks.',
          'Frames on a trunk carry an 802.1Q tag with the VLAN ID; untagged frames belong to the native VLAN.',
        ],
      },
      {
        title: 'The 802.1Q tag',
        body: ['The 4-byte tag is inserted after the source MAC. The VID is 12 bits, so usable VLAN IDs are 1–4094.'],
      },
      {
        title: 'Between VLANs you need Layer 3',
        body: [
          'Different VLANs are different subnets; talking across them needs a router or L3 switch (SVI).',
          'Linux can handle tagged frames itself: create a VLAN sub-interface like `eth0.20`, common on KVM / Proxmox hosts.',
        ],
      },
      {
        title: 'The classic mistake: VLAN mismatch',
        body: [
          'The server’s subnet lives in VLAN 20 but its switch port is VLAN 30: link up, IP correct, yet the gateway never answers and ARP stays `FAILED`.',
          'Reproduce it in the Network Simulator.',
        ],
      },
    ],
  },
  dhcp: {
    title: 'DHCP',
    summary: 'DORA: Discover, Offer, Request, Ack.',
    steps: [
      { title: 'Network settings automatically', body: ['DHCP gives a booting host its IP, mask, gateway and DNS. The four steps are called DORA.'] },
      {
        title: 'Discover (broadcast)',
        body: ['The client has no IP yet, so it sends from `0.0.0.0` to broadcast `255.255.255.255`: "Is there a DHCP server?"'],
      },
      { title: 'Offer', body: ['The DHCP server picks an address from its pool and offers it, e.g. 192.168.1.50.'] },
      {
        title: 'Request (broadcast)',
        body: ['The client broadcasts "I’ll take 192.168.1.50". Broadcasting lets any other DHCP servers know which offer it chose.'],
      },
      { title: 'Ack', body: ['The server confirms and includes the mask, router (gateway), DNS and lease time. The client starts using the IP.'] },
      {
        title: 'Watching DHCP on Linux',
        body: [
          '`dhclient -v` shows the full DORA. No offer means a 169.254.x.x address.',
          'DHCP is broadcast and does not cross subnets; with the server in another VLAN, the router needs a DHCP relay (ip helper-address).',
        ],
      },
    ],
  },
  dns: {
    title: 'DNS',
    summary: 'Names → IPs: resolver, root, TLD, authoritative.',
    steps: [
      {
        title: 'Names into IPs',
        body: ['People remember names, networks use IPs. DNS turns `www.example.com` into an IP. `/etc/resolv.conf` sets which resolver a host asks.'],
      },
      { title: 'The client asks its resolver', body: ['The client sends a recursive query to the resolver: "please find me the final answer".'] },
      {
        title: 'The resolver starts at the root',
        body: ['Without a cached answer the resolver asks a root server, which does not know but refers it: "ask the .com servers".'],
      },
      { title: 'The TLD points to the authoritative servers', body: ['The .com TLD server answers: "example.com is served by these name servers".'] },
      {
        title: 'Authoritative answer, cached by the resolver',
        body: [
          'example.com’s authoritative name server returns the A record and TTL. The resolver caches it for TTL seconds and answers the client.',
          'The next identical query is answered from cache, very fast.',
        ],
      },
      {
        title: 'Common records and dig',
        body: [
          '`A` = IPv4, `AAAA` = IPv6, `CNAME` = alias, `MX` = mail, `PTR` = reverse.',
          '`dig +noall +answer` shows only the answer; `dig @8.8.8.8` queries a specific server for comparison.',
        ],
      },
    ],
  },
  nat: {
    title: 'NAT',
    summary: 'SNAT / PAT gets the inside out, DNAT lets the outside in.',
    steps: [
      {
        title: 'Private IPs cannot go on the Internet',
        body: ['192.168.1.10 is private and Internet routers will not route it. The edge router / firewall must swap it for a public IP on the way out.'],
      },
      {
        title: 'SNAT / PAT: new source address and port',
        body: [
          'The router rewrites source `192.168.1.10:51000` to `203.0.113.10:62001` and records the mapping in its NAT table.',
          'Each connection gets its own port, so hundreds of hosts can share one public IP (PAT / NAT overload / masquerade).',
        ],
      },
      { title: 'The reply comes to the public IP', body: ['8.8.8.8 answers `203.0.113.10:62001`; it only ever sees the public address.'] },
      {
        title: 'Translate back using the NAT table',
        body: ['The router finds 62001 = 192.168.1.10:51000 in the NAT table, rewrites the destination and forwards it inside.'],
      },
      {
        title: 'DNAT: letting the outside in',
        body: [
          'Port forwarding is the reverse: connections to public-IP:443 are forwarded to the internal web server `10.0.0.20:443`.',
          'On Linux this is iptables / nftables `DNAT` and `MASQUERADE` rules.',
        ],
      },
    ],
  },
  tcp: {
    title: 'TCP',
    summary: 'Reliable delivery: connections, sequence numbers, ACKs, retransmission, close.',
    steps: [
      {
        title: 'Connect first',
        body: ['TCP is connection-oriented: before data, a three-way handshake sets up the connection and both sides exchange initial sequence numbers (ISNs). The next chapters dig in.'],
      },
      {
        title: 'Sequence numbers and ACKs',
        body: [
          'Every byte is numbered. Sending `seq=1001 len=500` means bytes 1001–1500.',
          'The receiver answers `ACK=1501`: "I have everything up to 1500; send 1501 next".',
        ],
      },
      {
        title: 'Lost data is retransmitted',
        body: [
          'The second segment is lost, so no ACK comes back. After a timeout the sender retransmits the same data.',
          'That is how TCP guarantees complete, ordered delivery, at the cost of latency and extra traffic.',
        ],
      },
      { title: 'Closing: FIN', body: ['To finish, each side sends `FIN` and the other ACKs it. The side that closes first sits in `TIME-WAIT` for a while.'] },
      {
        title: 'Connection states in ss',
        body: ['`LISTEN` waiting, `ESTAB` established, `TIME-WAIT` just closed, `SYN-SENT` SYN sent with no answer yet.'],
      },
    ],
  },
  udp: {
    title: 'UDP',
    summary: 'Connectionless and lightweight: DNS, DHCP, NTP all use it.',
    steps: [
      {
        title: 'Just send, no handshake',
        body: [
          'UDP has no connection setup, no acknowledgements and no retransmission. A DNS lookup is one UDP packet out and one back.',
          'If something is lost, the application decides whether to ask again.',
        ],
      },
      { title: 'TCP vs UDP', body: ['Use TCP when you need reliability and order; UDP when latency matters and losses are tolerable or handled by the app.'] },
      {
        title: 'Testing UDP is harder',
        body: [
          'With no handshake, `nc -zvu` saying succeeded only means no ICMP port unreachable came back, not that the service answered.',
          'Test with the service’s own tool instead: `dig`, `ntpdate -q`, `snmpwalk`.',
        ],
      },
    ],
  },
  port: {
    title: 'Port',
    summary: 'Ports tell services on one host apart; a socket is a 5-tuple.',
    steps: [
      {
        title: 'Port: the extension number on a host',
        body: [
          'The IP finds the host, the port finds the program on it. Ports are 16-bit numbers from 0 to 65535.',
          'Servers listen on fixed ports (HTTPS 443); clients connect from a random source port.',
        ],
      },
      {
        title: 'Three ranges',
        body: [
          'Well-known 0–1023: standard services (22, 53, 80, 443); registered 1024–49151: applications (3306, 5432); dynamic 49152–65535.',
          'Linux’s client source port range is in `ip_local_port_range`.',
        ],
      },
      {
        title: 'Socket = 5-tuple',
        body: [
          'A connection is identified by five values: protocol, source IP, source port, destination IP, destination port.',
          'That is why one client can hold many connections to the same server:443 at once, each with a different source port.',
        ],
      },
      {
        title: 'Who is listening?',
        body: ['`ss -tlnp` lists listening TCP ports and their processes. When a service is unreachable, first check that it listens, and on which IP.'],
      },
    ],
  },
  'tcp-handshake': {
    title: 'TCP Three-way Handshake',
    summary: 'SYN → SYN-ACK → ACK, then the first packets of HTTP / HTTPS / SSH / MySQL.',
    steps: [
      { title: 'Before a connection', body: ['To reach a service port, the client must complete the three-way handshake. Switch the simulated service above.'] },
      { title: '① SYN', body: ['The client sends SYN with its initial sequence number `seq = x`. The SYN itself consumes one sequence number.'] },
      {
        title: '② SYN-ACK',
        body: ['The server agrees: it sends its own initial sequence number `seq = y` and acknowledges the client’s SYN with `ack = x + 1`.'],
      },
      {
        title: '③ ACK → Connection Established',
        body: ['The client replies `ack = y + 1`. Both sides have confirmed each other’s sequence numbers; the connection is up and data can flow.'],
      },
      {
        title: 'The application starts talking',
        body: [
          'HTTP clients send `GET` first; HTTPS starts with a TLS ClientHello; SSH and MySQL servers speak first with a banner / greeting.',
          'Notice that after each data segment the peer’s ACK equals "sequence number + length".',
        ],
      },
      {
        title: 'Refused vs timeout',
        body: [
          'Nothing listening: the server replies `RST` → Connection refused (the network works).',
          'A firewall drops the SYN: total silence; the client retries a few times → Connection timed out.',
        ],
      },
    ],
  },
  routing: {
    title: 'Routing',
    summary: 'Routing tables, longest prefix match, default route.',
    steps: [
      {
        title: 'Every host has a routing table',
        body: [
          'Each line: destination network, next hop (`via`), outgoing interface (`dev`).',
          'A packet to 8.8.8.8 only matches `default`, so it goes to 192.168.1.1.',
        ],
      },
      {
        title: 'Longest prefix match',
        body: ['10.20.30.40 matches `default`, `10.0.0.0/8` and `10.20.0.0/16`. Longer prefixes are more specific, so /16 wins: out of eth1 to 172.16.0.1.'],
      },
      {
        title: 'Connected routes',
        body: ['Assigning an IP makes the kernel add a route for the local subnet (`proto kernel scope link`). No `via` means ARP for the destination directly.'],
      },
      {
        title: 'Verify with ip route get',
        body: [
          '`ip route get <IP>` tells you exactly how the kernel will send it: next hop, interface and source IP.',
          'Do not forget the return path: the far side also needs a route back to you, or traffic only works one way.',
        ],
      },
      { title: 'Try it yourself', body: ['Type any destination IP above and see which routes match and which one wins.'] },
    ],
  },
}

export default tutorialsEn
