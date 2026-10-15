import type { TroubleshootingText } from './types'

const troubleEn: TroubleshootingText = {
  steps: {
    link: {
      question: 'Is the network interface UP?',
      explain: 'Start at the physical layer: is the NIC enabled and does the cable have signal? If not, nothing else will work.',
      normal: '`state UP` with `LOWER_UP`.',
      abnormal: '`NO-CARRIER` or `state DOWN`.',
    },
    addr: {
      question: 'Does the interface have an IP?',
      explain: 'Make sure the NIC has the correct IPv4 address and mask.',
      normal: 'An `inet` address in the expected network, e.g. `192.168.1.10/24`.',
      abnormal: 'No `inet`, or only `169.254.x.x` (DHCP failed).',
    },
    route: {
      question: 'Is routing correct? Is there a default gateway?',
      explain: 'To reach other networks (including the Internet) the routing table needs a `default via` line.',
      normal: '`default via <gateway>` with the gateway inside the local subnet.',
      abnormal: 'No `default` line, or the gateway is outside the local subnet.',
    },
    gateway: {
      question: 'Can you ping the gateway?',
      explain: 'The gateway is on the same subnet; reaching it proves local Layers 1–3 work.',
      normal: '`0% packet loss`.',
      abnormal: '`Destination Host Unreachable` or 100% packet loss.',
    },
    public: {
      question: 'Can you ping a public IP (8.8.8.8)?',
      explain: 'Test by IP to rule out DNS and check that packets get through the router / firewall / NAT to the Internet.',
      normal: 'Replies `64 bytes from 8.8.8.8`.',
      abnormal: '100% packet loss.',
    },
    dns: {
      question: 'Does DNS work?',
      explain: 'Look up a name to confirm the DNS server answers. `nslookup google.com` works too.',
      normal: '`status: NOERROR` with an `ANSWER SECTION`.',
      abnormal: '`timed out`, `no servers could be reached` or `SERVFAIL`.',
    },
  },
  diagnoses: {
    link: {
      title: 'Physical problem: no link on the NIC',
      causes: ['Faulty or unplugged cable / transceiver', 'Switch port shut down or err-disabled', 'NIC disabled (`ip link set eth0 down`)', 'NIC driver or firmware problem'],
      next: ['`ethtool eth0` to check `Link detected`', '`dmesg -T | grep -i eth0` for link up / down events', 'Try another cable or switch port', '`ip link set eth0 up` to enable the NIC'],
    },
    addr: {
      title: 'Addressing problem: no valid IP address',
      causes: ['DHCP server not answering (169.254 address)', 'Wrong VLAN on the switch port, so DHCP is unreachable', 'Static IP config wrong or not applied'],
      next: ['`nmcli con show <name>` to check ipv4.method and ipv4.addresses', '`dhclient -v eth0` or `nmcli con up <name>` to request an IP again', 'Ask the network team to verify the switch port VLAN'],
    },
    route: {
      title: 'Routing problem: no default gateway',
      causes: ['DHCP did not provide a gateway', 'The static config is missing the gateway', 'The gateway is in another subnet, so the kernel rejects it'],
      next: ['`ip route add default via <gateway>` to test temporarily', 'Use the Gateway Checker to confirm the gateway is in the subnet', 'Persist it: `nmcli con mod <name> ipv4.gateway <gateway>`'],
    },
    gateway: {
      title: 'Local network problem: the gateway does not answer',
      causes: ['NIC', 'Cable', 'Switch', 'VLAN', 'IP', 'Subnet Mask'],
      next: ['`ip neigh` to see whether the gateway ARP entry is `FAILED` or has a MAC', '`tcpdump -ni eth0 arp` to see if ARP replies arrive', 'Use the Same Subnet Checker to confirm IP / mask and gateway share a subnet', 'Confirm the switch port VLAN matches the server'],
    },
    public: {
      title: 'Egress problem: gateway OK, Internet unreachable',
      causes: ['Routing (no route to the Internet on the router)', 'Firewall blocking outbound traffic', 'NAT missing or misconfigured', 'ISP outage'],
      next: ['`traceroute -n 8.8.8.8` to see which hop it stops at', '`curl -I https://1.1.1.1` to make sure only ICMP is not blocked', 'Ask the network / firewall team to check egress rules and NAT'],
    },
    dns: {
      title: 'DNS problem: IPs work, names do not',
      causes: ['DNS'],
      next: ['`cat /etc/resolv.conf` to confirm a nameserver is set', '`dig @8.8.8.8 google.com` to compare with external DNS', 'Make sure the firewall allows UDP / TCP 53'],
    },
    ok: {
      title: 'The network is fine',
      causes: ['All network layers work; the problem is likely the application, proxy settings or a specific service'],
      next: ['`curl -v https://target-site` for HTTP / TLS details', 'Check the `http_proxy` / `https_proxy` environment variables', 'Test the specific service port with Port Reference and `nc -zv`'],
    },
  },
}

export default troubleEn
