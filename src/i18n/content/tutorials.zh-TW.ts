import type { TutorialChapterText } from '@/types/tutorial'
import { EX_CIDR, EX_IP } from '@/data/tutorials'
import { calculateSubnet, cidrToMask, getUsableHosts } from '@/utils/network'

const ex = calculateSubnet(EX_IP, EX_CIDR)
const common = [24, 25, 26, 27, 28, 29, 30, 32].map((c) => `\`/${c} = ${cidrToMask(c)} → ${getUsableHosts(c)} hosts\``)

const tutorialsZhTW: Record<string, TutorialChapterText> = {
  binary: {
    title: 'Binary 二進位',
    summary: '用「位值減法」把十進位轉成 8 個 bit，再反向加回來。',
    steps: [
      {
        title: '一個 Octet = 8 個 bit',
        body: [
          'IPv4 的每一段（Octet）都是 8 個 bit，每個 bit 只能是 0 或 1。',
          '從左到右的位值（Place Value）是 128、64、32、16、8、4、2、1，每一格都是右邊那格的 2 倍。',
          '8 個 bit 全部是 1 時 = 128+64+32+16+8+4+2+1 = 255，所以每一段 IP 最大就是 255。',
        ],
      },
      { title: '例子：把 192 轉成二進位', body: ['從最左邊的 128 開始，一格一格比較「剩下的數字」能不能放進這個位值。'] },
      { title: '192 >= 128 → bit = 1', body: ['192 比 128 大，所以 128 這格放 1，然後 192 − 128 = 64，剩下 64 繼續往右比。'] },
      { title: '64 >= 64 → bit = 1', body: ['剩下的 64 剛好等於 64，所以這格也是 1。64 − 64 = 0。'] },
      {
        title: '剩 0，其他全部是 0',
        body: ['剩餘已經是 0，後面的 32、16、8、4、2、1 都放不下，全部填 0。', '結果：192 = `11000000` = 128 + 64。'],
      },
      { title: '反向：二進位 → 十進位', body: ['把 bit 為 1 的位值加起來即可。`11000000` → 128 + 64 = 192。'] },
      {
        title: '再一個例子：168',
        body: ['168 ≥ 128 → 1，剩 40；40 < 64 → 0；40 ≥ 32 → 1，剩 8；8 < 16 → 0；8 ≥ 8 → 1，剩 0；其餘為 0。'],
        example: '192.168.x.x 的前兩段就是 11000000.10101000',
      },
    ],
  },
  ipv4: {
    title: 'IPv4',
    summary: '32 bits、4 個 Octet、私有 IP 與特殊位址。',
    steps: [
      {
        title: 'IPv4 位址 = 32 個 bit',
        body: [
          'IPv4 位址其實是一個 32-bit 的數字。為了方便人類閱讀，把它切成 4 段，每段 8 bit 轉成十進位，再用「.」連起來，稱為 Dotted Decimal。',
        ],
      },
      {
        title: '每一段都是 0 ~ 255',
        body: ['因為每段只有 8 bit，範圍就是 00000000（0）到 11111111（255）。`192.168.1.256` 這種位址是不存在的。'],
      },
      {
        title: 'Network 部分 + Host 部分',
        body: [
          '32 個 bit 會被 Subnet Mask 分成兩部分：前面的 Network Bits 代表「哪個網段」，後面的 Host Bits 代表「網段裡的哪台設備」。',
          '以 /24 為例：前 24 bit（192.168.1）是網段，最後 8 bit（.10）是主機。',
        ],
      },
      {
        title: '私有 IP（RFC 1918）',
        body: [
          '以下三個範圍保留給內部網路使用，不會在 Internet 上路由，要上網必須經過 NAT：',
          '`10.0.0.0/8`　`172.16.0.0/12`（172.16 ~ 172.31）　`192.168.0.0/16`',
        ],
        example: '172.32.0.1 不是私有 IP！172.16.0.0/12 只到 172.31.255.255。',
      },
      {
        title: '一定要認得的特殊位址',
        body: [
          '`127.0.0.1` Loopback：自己連自己，測試本機服務。',
          '`169.254.x.x` Link-local（APIPA）：通常代表 DHCP 失敗，Server 沒拿到 IP。',
          '`0.0.0.0` 在路由表代表 Default Route；在 `ss -lnt` 代表 Listen 所有介面。',
          '`255.255.255.255` 受限廣播。',
        ],
        example: '看到 `inet 169.254.23.7/16` 就代表這張網卡沒有從 DHCP 拿到位址。',
      },
    ],
  },
  'subnet-mask': {
    title: 'Subnet Mask',
    summary: 'Mask 用連續的 1 標記 Network Bits，用 0 標記 Host Bits。',
    steps: [
      {
        title: 'Mask 決定 Network / Host 的分界',
        body: ['Subnet Mask 也是 32 bit。值為 1 的位置是 Network Bits，值為 0 的位置是 Host Bits。', '例如 `255.255.255.224`：'],
      },
      { title: '數 Network Bits：前三段', body: ['255 = 11111111，每段 8 個 1。前三段共 8 + 8 + 8 = 24。'] },
      { title: '數 Network Bits：第四段', body: ['224 = 11100000，有 3 個 1。'] },
      {
        title: '255.255.255.224 = /27',
        body: ['8 + 8 + 8 + 3 = 27，所以這個 Mask 寫成 CIDR 就是 /27，剩下 32 − 27 = 5 個 Host Bits。'],
      },
      {
        title: 'Mask 的 1 必須連續',
        body: [
          'Mask 一定是「左邊連續的 1 + 右邊連續的 0」。所以每一段只可能是：',
          '`0` `128` `192` `224` `240` `248` `252` `254` `255`',
          '`255.255.0.255` 或 `255.255.255.100` 都是無效的 Mask。',
        ],
      },
    ],
  },
  cidr: {
    title: 'CIDR',
    summary: '/n 表示前 n 個 bit 是 Network，以及如何算 Host 數量。',
    steps: [
      {
        title: 'CIDR = Mask 的簡寫',
        body: [
          'CIDR（Classless Inter-Domain Routing）用 `/n` 表示 Mask 有 n 個連續的 1。',
          `\`${EX_IP}/${EX_CIDR}\` 就等於 IP ${EX_IP}、Mask ${ex.subnetMask}。`,
        ],
      },
      {
        title: '算 Host 數量',
        body: [
          `Host Bits = 32 − ${EX_CIDR} = ${ex.hostBits}，總位址數 = 2^${ex.hostBits} = ${ex.totalAddresses}。`,
          `扣掉 Network 與 Broadcast 兩個位址，可用 Host = ${ex.totalAddresses} − 2 = ${ex.usableHosts}。`,
        ],
      },
      {
        title: '常用 CIDR 速記',
        body: [
          '每少 1 個 Network Bit，位址數就翻倍：',
          ...common,
          '`/31` 用在點對點鏈路（RFC 3021，2 個位址都可用），`/32` 代表單一主機。',
        ],
      },
    ],
  },
  'network-address': {
    title: 'Network Address',
    summary: 'IP AND Mask，以及 Block Size 速算法。',
    steps: [
      {
        title: 'IP AND Mask = Network Address',
        body: [
          'AND 運算：兩邊都是 1 結果才是 1。Mask 為 1 的位置保留 IP 原本的 bit，Mask 為 0 的位置全部變成 0。',
          `${EX_IP} AND ${ex.subnetMask} = ${ex.networkAddress}`,
        ],
      },
      {
        title: 'Block Size 速算法',
        body: [
          '工作現場不用每次轉二進位：找到 Mask 不是 255 的那一段，256 減掉它就是區塊大小。',
          '這段 IP 的值落在哪個區塊，區塊的起點就是 Network。',
        ],
      },
      {
        title: 'Network Address 不能給設備用',
        body: [
          `${ex.networkAddress} 代表「整個網段」，會出現在路由表裡，例如 \`${ex.networkAddress}/${EX_CIDR} dev eth0\`，不能設定在任何介面上。`,
        ],
      },
    ],
  },
  'broadcast-address': {
    title: 'Broadcast Address',
    summary: 'Host Bits 全部設為 1，以及 First / Last Host。',
    steps: [
      {
        title: 'Host Bits 全部變成 1',
        body: [
          'Broadcast = Network OR Wildcard。Wildcard 是 Mask 反過來（Host Bits 為 1），OR 之後 Host Bits 全部變成 1。',
          `${ex.networkAddress} OR ${ex.wildcardMask} = ${ex.broadcastAddress}`,
        ],
      },
      {
        title: 'Broadcast 的用途',
        body: [
          '送到 Broadcast Address 的封包，同網段所有設備都會收到。ARP Request、DHCP Discover 都依賴廣播。',
          '速算：Broadcast = 下一個區塊的 Network − 1。',
        ],
      },
      {
        title: 'First Host / Last Host',
        body: [
          `First Host = Network + 1 = ${ex.firstHost}`,
          `Last Host = Broadcast − 1 = ${ex.lastHost}`,
          `中間這 ${ex.usableHosts} 個位址才能分配給 Server、Switch 管理介面、Gateway。`,
        ],
      },
    ],
  },
  gateway: {
    title: 'Gateway',
    summary: '要去別的網段時交給 Gateway，而 Gateway 必須在本地子網路內。',
    steps: [
      {
        title: '不同網段要交給 Gateway',
        body: [
          'Server 送封包前會先判斷目的地是不是在自己的網段。不是的話，就把封包交給 Default Gateway（通常是 Router 或 L3 Switch 的介面）。',
        ],
      },
      {
        title: 'Gateway 必須在同一個子網路',
        body: [
          'Server 用 ARP 問「誰是 Gateway？」來取得它的 MAC，而 ARP 只在同網段有效。',
          '10.20.30.150/26 → Network 10.20.30.128，可用 .129 ~ .190，Gateway .129 在範圍內 ✓',
        ],
      },
      {
        title: '錯誤例子',
        body: [
          'Server 192.168.10.50/24，Gateway 卻設成 192.168.20.1。',
          'Server Network = 192.168.10.0/24，Gateway Network = 192.168.20.0/24，Gateway 不在本地網段，封包出不去。',
        ],
      },
      {
        title: '在 Linux 上確認 Gateway',
        body: ['`ip route` 的 `default via` 就是 Default Gateway。接著用 `ping` 確認 Gateway 通不通。'],
        example: 'Default Gateway = 10.20.30.129',
      },
    ],
  },
  'mac-address': {
    title: 'MAC Address',
    summary: 'Layer 2 位址：48 bit、OUI 與網卡序號、單播與廣播。',
    steps: [
      {
        title: 'MAC = 網卡的實體位址',
        body: [
          'MAC Address 是 Layer 2（Ethernet）用的位址，長度 48 bit，寫成 6 組 16 進位，例如 `3c:ec:ef:12:34:56`。',
          '它通常在網卡出廠時就燒錄好了。同一個網段裡，Switch 就是靠 MAC 決定 Frame 要送到哪個 Port。',
        ],
      },
      {
        title: '前半是廠商，後半是序號',
        body: [
          '前 3 Bytes 是 OUI（Organizationally Unique Identifier），由 IEEE 分配給廠商；後 3 Bytes 由廠商自己分配給每張網卡。',
          '查 OUI 就能知道是哪家廠商的網卡，排查「這個 IP 是什麼設備」時很好用。',
        ],
        example: '在 Switch 的 MAC Table 看到陌生的 MAC，用前 3 Bytes 查 OUI 就知道是 Dell、Supermicro 還是虛擬機。',
      },
      {
        title: '第一個 Byte 的兩個特殊 bit',
        body: [
          'I/G bit（最低位）：0 是單播，1 是群播。`ff:ff:ff:ff:ff:ff` 全部是 1，就是廣播。',
          'U/L bit（次低位）：1 代表「本地設定」的位址，不是廠商燒錄的。Docker、KVM 等虛擬網卡常用 `02:` 開頭的 MAC。',
        ],
      },
      {
        title: 'IP 端到端，MAC 只到下一跳',
        body: [
          'IP 位址從來源到目的都不變；MAC 位址只在同一個 Layer 2 網段有效，每經過一個 Router 就會換。',
          '在 Linux 用 `ip link` 看 `link/ether` 那一行就是 MAC。',
        ],
      },
    ],
  },
  arp: {
    title: 'ARP',
    summary: '知道 IP、不知道 MAC 時，用廣播問「Who has …?」。',
    steps: [
      {
        title: '為什麼需要 ARP',
        body: [
          'Server A 要送封包給 192.168.1.20，它知道對方的 IP，但 Ethernet Frame 需要對方的 MAC。',
          'ARP（Address Resolution Protocol）就是用來把 IP 換成 MAC 的。',
        ],
      },
      {
        title: 'ARP Request：廣播詢問',
        body: ['Server A 送出目的 MAC 為 `ff:ff:ff:ff:ff:ff` 的廣播：「Who has 192.168.1.20? Tell 192.168.1.10」。'],
      },
      {
        title: 'Switch 把廣播送到所有 Port',
        body: ['廣播會被送到同一個 VLAN 的所有設備。每台設備都會看一下：問的是不是我的 IP？'],
      },
      {
        title: 'ARP Reply：單播回覆',
        body: ['只有 192.168.1.20 會回覆，而且直接單播回給 Server A：「192.168.1.20 is at 3c:ec:ef:aa:bb:cc」。'],
      },
      {
        title: '取得 MAC，開始傳資料',
        body: ['Server A 把對應存進 ARP 表，接下來的 Frame 直接送到這個 MAC，不必每次都問。'],
      },
      {
        title: 'ARP 表（ARP Cache）',
        body: [
          '`ip neigh` 顯示目前的對應。`REACHABLE` 是最近確認過，`STALE` 是一陣子沒用但還在，`FAILED` 代表問不到。',
          'Gateway 顯示 `FAILED` 時，幾乎可以確定是 Layer 2 不通：線、VLAN 或 IP 設錯。',
        ],
      },
      {
        title: '連 Internet 時 ARP 問的是 Gateway',
        body: [
          '目的地不在本地網段時，Server 不會 ARP 目的地，而是 ARP Default Gateway 的 MAC，再把封包交給它。',
          '用 `tcpdump -ni eth0 arp` 可以直接看到 Request 與 Reply。',
        ],
        example: '只看到一直重複的 Request 而沒有 Reply，就是對方不在這個 Layer 2 網段。',
      },
    ],
  },
  switch: {
    title: 'Switch',
    summary: 'MAC Table、Learning、Flooding、Forwarding。',
    steps: [
      {
        title: 'Switch 依 MAC 轉送 Frame',
        body: [
          'Switch 工作在 Layer 2，它不看 IP，只看 Frame 的 MAC。',
          '它維護一張 MAC Address Table：哪個 MAC 接在哪個 Port。剛開機時這張表是空的。',
        ],
      },
      {
        title: '學習來源 MAC，未知目的就 Flood',
        body: [
          'Host A 從 Port 1 送 Frame 給 B。Switch 先記下「A 在 Port 1」（用來源 MAC 學習）。',
          '它還不知道 B 在哪，只好送往除了 Port 1 以外的所有 Port（Flooding）。',
        ],
      },
      {
        title: 'B 回覆，Switch 再學一筆',
        body: ['B 從 Port 2 回覆給 A。Switch 學到「B 在 Port 2」，而且已經知道 A 在 Port 1，所以只送往 Port 1。'],
      },
      {
        title: '之後直接轉送',
        body: ['A 再送給 B 時，兩邊都已知道，Switch 只送往 Port 2，其他 Port 完全看不到這個 Frame。'],
      },
      {
        title: '在 Switch 上查看 MAC Table',
        body: [
          '廣播 Frame 永遠會 Flood；MAC Table 的項目閒置一段時間（常見 300 秒）會被清除。',
          '要找某台 Server 接在哪個 Port，就在 Switch 上查它的 MAC。',
        ],
      },
    ],
  },
  router: {
    title: 'Router',
    summary: '連接不同網段，依路由表轉送，每一跳換 MAC、TTL 減 1。',
    steps: [
      {
        title: 'Router 連接不同網段',
        body: [
          'Router 工作在 Layer 3，每個介面屬於不同網段。不同網段之間的流量一定要經過 Router（或 L3 Switch）。',
          '主機的 Default Gateway 就是 Router 在它那個網段的介面 IP。',
        ],
      },
      {
        title: '查路由表決定下一跳',
        body: ['Router 用目的 IP 查路由表，符合的路由中選 Prefix 最長的（Longest Prefix Match）。可以改上面的目的 IP 試試看。'],
      },
      {
        title: '每一跳換 MAC，IP 不變',
        body: [
          'Server A 送出的 Frame 目的 MAC 是 Router；Router 轉送時重新封裝，目的 MAC 換成 Server C。',
          '來源與目的 IP 不變（沒有 NAT 時），但 TTL 減 1。',
        ],
      },
      {
        title: 'TTL 與 traceroute',
        body: ['TTL 減到 0 時 Router 丟棄封包並回 ICMP Time Exceeded。traceroute 從 TTL = 1 開始送，就能一跳一跳列出路徑。'],
      },
    ],
  },
  vlan: {
    title: 'VLAN',
    summary: '一台 Switch 切成多個網路：Access、Trunk、802.1Q。',
    steps: [
      {
        title: '一台 Switch，多個獨立網路',
        body: [
          'VLAN 把一台實體 Switch 切成多個互相隔離的廣播網域。VLAN 10 的廣播不會跑到 VLAN 20。',
          '通常一個 VLAN 對應一個 IP 網段，例如 Management、Server、Storage 各一個 VLAN。',
        ],
      },
      {
        title: 'Access Port',
        body: ['接一般 Server 的 Port 設成 Access，只屬於一個 VLAN。Frame 不帶 VLAN Tag，Server 完全不知道自己在哪個 VLAN。'],
      },
      {
        title: 'Trunk Port',
        body: [
          'Switch 之間、Switch 到 Router 或到虛擬化主機的線，要承載多個 VLAN，就設成 Trunk。',
          'Trunk 上的 Frame 會加上 802.1Q Tag 標示 VLAN ID；未加 Tag 的 Frame 屬於 Native VLAN。',
        ],
      },
      {
        title: '802.1Q Tag',
        body: ['Tag 插在來源 MAC 後面，共 4 Bytes。VID 有 12 bit，所以可用的 VLAN ID 是 1 ~ 4094。'],
      },
      {
        title: 'VLAN 之間要靠 Layer 3',
        body: [
          '不同 VLAN 是不同網段，要互通必須經過 Router 或 L3 Switch（SVI）。',
          'Linux 也能直接處理 Tagged Frame：建立 `eth0.20` 這種 VLAN 子介面，常用於 KVM / Proxmox 主機。',
        ],
      },
      {
        title: '最常見的錯誤：VLAN mismatch',
        body: [
          'Server 的網段屬於 VLAN 20，但 Switch Port 設成 VLAN 30：網卡有 Link、IP 也對，卻 ping 不到 Gateway，ARP 一直 `FAILED`。',
          '可以在 Network Simulator 裡重現這個情境。',
        ],
      },
    ],
  },
  dhcp: {
    title: 'DHCP',
    summary: 'DORA：Discover、Offer、Request、Ack。',
    steps: [
      {
        title: '自動取得網路設定',
        body: ['DHCP 讓主機開機時自動拿到 IP、Mask、Gateway 與 DNS。流程有 4 步，簡稱 DORA。'],
      },
      {
        title: 'Discover（廣播）',
        body: ['Client 還沒有 IP，所以來源是 `0.0.0.0`，目的是廣播 `255.255.255.255`，問：「有沒有 DHCP Server？」'],
      },
      { title: 'Offer', body: ['DHCP Server 從 Pool 挑一個位址提供給 Client，例如 192.168.1.50。'] },
      {
        title: 'Request（廣播）',
        body: ['Client 用廣播回覆「我要 192.168.1.50」。用廣播是為了讓其他 DHCP Server 知道它選了誰。'],
      },
      {
        title: 'Ack',
        body: ['Server 確認，並附上 Mask、Router（Gateway）、DNS 與租約時間。Client 開始使用這個 IP。'],
      },
      {
        title: '在 Linux 上觀察 DHCP',
        body: [
          '`dhclient -v` 可以看到完整的 DORA。沒有收到 Offer 會拿到 169.254.x.x。',
          'DHCP 是廣播，不會跨網段；DHCP Server 在別的 VLAN 時，Router 要設定 DHCP Relay（ip helper-address）。',
        ],
      },
    ],
  },
  dns: {
    title: 'DNS',
    summary: '名稱 → IP：Resolver、Root、TLD、Authoritative。',
    steps: [
      {
        title: '名稱轉換成 IP',
        body: ['人記名稱，網路用 IP。DNS 負責把 `www.example.com` 換成 IP。主機在 `/etc/resolv.conf` 設定要問哪台 Resolver。'],
      },
      {
        title: 'Client 問 Resolver',
        body: ['Client 送遞迴查詢（Recursive Query）給 Resolver：「請幫我查到最後的答案」。'],
      },
      {
        title: 'Resolver 從 Root 開始問',
        body: ['Resolver 沒有快取時先問 Root Server，Root 不知道答案，但會指引：「去問 .com 的 Server」。'],
      },
      {
        title: 'TLD 指向權威伺服器',
        body: ['.com 的 TLD Server 回覆：「example.com 由這幾台 Name Server 負責」。'],
      },
      {
        title: '權威伺服器給答案，Resolver 快取',
        body: [
          'example.com 的權威 Name Server 回覆 A 記錄與 TTL。Resolver 把結果快取 TTL 秒，再回給 Client。',
          '下次同樣的查詢就直接從快取回答，非常快。',
        ],
      },
      {
        title: '常見記錄與 dig',
        body: [
          '`A` = IPv4、`AAAA` = IPv6、`CNAME` = 別名、`MX` = 郵件、`PTR` = 反查。',
          '`dig +noall +answer` 只顯示答案；`dig @8.8.8.8` 指定 DNS Server 比較結果。',
        ],
      },
    ],
  },
  nat: {
    title: 'NAT',
    summary: 'SNAT / PAT 讓內網上網，DNAT 讓外部連進來。',
    steps: [
      {
        title: '私有 IP 不能直接上 Internet',
        body: ['192.168.1.10 是私有 IP，Internet 上的 Router 不會路由它。出去之前，出口 Router / Firewall 要把它換成公有 IP。'],
      },
      {
        title: 'SNAT / PAT：換來源位址與 Port',
        body: [
          'Router 把來源 `192.168.1.10:51000` 換成 `203.0.113.10:62001`，並把這組對應記在 NAT 表。',
          '每條連線用不同的 Port，所以上百台主機可以共用一個公有 IP（PAT / NAT Overload / Masquerade）。',
        ],
      },
      { title: '回覆送到公有 IP', body: ['8.8.8.8 回覆給 `203.0.113.10:62001`，它只看得到公有位址。'] },
      {
        title: '查 NAT 表換回去',
        body: ['Router 查 NAT 表，知道 62001 是 192.168.1.10:51000，把目的位址換回去再送進內網。'],
      },
      {
        title: 'DNAT：讓外部連進來',
        body: [
          'Port Forwarding 是反方向：送到公有 IP:443 的連線，轉給內部 Web Server `10.0.0.20:443`。',
          'Linux 上用 iptables / nftables 的 `DNAT` 與 `MASQUERADE` 規則實作。',
        ],
      },
    ],
  },
  tcp: {
    title: 'TCP',
    summary: '可靠傳輸：連線、序號、ACK、重送、關閉連線。',
    steps: [
      {
        title: '先建立連線',
        body: ['TCP 是連線導向的：傳資料前先用三向交握建立連線，雙方交換初始序號（ISN）。下一章會詳細拆解。'],
      },
      {
        title: '序號與 ACK',
        body: [
          '每個 byte 都有序號。送出 `seq=1001 len=500` 代表第 1001 ~ 1500 byte。',
          '接收端回 `ACK=1501`：意思是「1500 以前都收到了，下一個要 1501」。',
        ],
      },
      {
        title: '遺失就重送',
        body: [
          '第二段資料在路上遺失，接收端沒有回 ACK。傳送端等到 Timeout 後重送同樣的資料。',
          '所以 TCP 能保證資料完整、依序送達；代價是延遲與額外的流量。',
        ],
      },
      {
        title: '關閉連線：FIN',
        body: ['結束時雙方各送一次 `FIN` 並互相 ACK。主動關閉的一方會進入 `TIME-WAIT` 一段時間。'],
      },
      {
        title: '用 ss 看連線狀態',
        body: ['`LISTEN` 等待連線、`ESTAB` 已建立、`TIME-WAIT` 剛關閉、`SYN-SENT` 送了 SYN 還沒收到回應。'],
      },
    ],
  },
  udp: {
    title: 'UDP',
    summary: '無連線、低開銷：DNS、DHCP、NTP 都用它。',
    steps: [
      {
        title: '直接送，不握手',
        body: [
          'UDP 不建立連線、不確認、不重送。DNS 查詢就是一個 UDP 封包問、一個 UDP 封包答。',
          '遺失了就由應用程式自己決定要不要重問。',
        ],
      },
      { title: 'TCP vs UDP', body: ['需要可靠與順序的用 TCP；重視即時、可以容忍少量遺失或自己處理重送的用 UDP。'] },
      {
        title: '測試 UDP 比較難',
        body: [
          'UDP 沒有握手，`nc -zvu` 顯示 succeeded 只代表沒收到 ICMP Port Unreachable，不保證服務真的有回應。',
          '最好用該服務自己的工具測試，例如 `dig`、`ntpdate -q`、`snmpwalk`。',
        ],
      },
    ],
  },
  port: {
    title: 'Port',
    summary: 'Port 區分同一台主機上的不同服務；Socket 是 5-tuple。',
    steps: [
      {
        title: 'Port：主機上的「門牌分機」',
        body: [
          'IP 找到主機，Port 找到主機上的哪個程式。Port 是 16 bit 數字，範圍 0 ~ 65535。',
          'Server 在固定的 Port Listen（HTTPS 443），Client 用一個隨機的來源 Port 連過去。',
        ],
      },
      {
        title: '三個範圍',
        body: [
          'Well-known 0 ~ 1023：標準服務（22、53、80、443）；Registered 1024 ~ 49151：應用程式（3306、5432）；Dynamic 49152 ~ 65535。',
          'Linux 的 Client 來源 Port 範圍可以在 `ip_local_port_range` 看到。',
        ],
      },
      {
        title: 'Socket = 5-tuple',
        body: [
          '一條連線由 5 個值唯一識別：協定、來源 IP、來源 Port、目的 IP、目的 Port。',
          '所以同一台 Client 可以同時開很多條連到同一個 Server:443 的連線，只要來源 Port 不同。',
        ],
      },
      {
        title: '查看誰在 Listen',
        body: ['`ss -tlnp` 列出 Listen 中的 TCP Port 與程序。服務連不上時，先確認它有沒有 Listen、聽在哪個 IP。'],
      },
    ],
  },
  'tcp-handshake': {
    title: 'TCP Three-way Handshake',
    summary: 'SYN → SYN-ACK → ACK，以及 HTTP / HTTPS / SSH / MySQL 的第一個封包。',
    steps: [
      {
        title: '建立連線之前',
        body: ['Client 要連 Server 的服務 Port，先要完成三向交握。上方可以切換要模擬的服務。'],
      },
      {
        title: '① SYN',
        body: ['Client 送出 SYN，附上自己的初始序號 `seq = x`。SYN 本身佔用 1 個序號。'],
      },
      {
        title: '② SYN-ACK',
        body: ['Server 同意連線：送出自己的初始序號 `seq = y`，並以 `ack = x + 1` 確認收到 Client 的 SYN。'],
      },
      {
        title: '③ ACK → Connection Established',
        body: ['Client 回 `ack = y + 1`。雙方都確認了對方的序號，連線建立，開始傳資料。'],
      },
      {
        title: '應用程式開始說話',
        body: [
          'HTTP 由 Client 先送 `GET`；HTTPS 先送 TLS ClientHello；SSH 與 MySQL 則是 Server 先送 Banner / Greeting。',
          '注意每一段資料後，對方的 ACK 都等於「序號 + 長度」。',
        ],
      },
      {
        title: 'Refused 與 Timeout',
        body: [
          'Port 沒有服務：Server 回 `RST` → Connection refused（網路是通的）。',
          '防火牆丟棄 SYN：完全沒有回應，Client 重送幾次後 → Connection timed out。',
        ],
      },
    ],
  },
  routing: {
    title: 'Routing',
    summary: '路由表、Longest Prefix Match、Default Route。',
    steps: [
      {
        title: '每台主機都有路由表',
        body: [
          '路由表每一行：目的網段、下一跳（`via`）、從哪張網卡出去（`dev`）。',
          '送往 8.8.8.8 的封包只符合 `default`，所以交給 192.168.1.1。',
        ],
      },
      {
        title: 'Longest Prefix Match',
        body: [
          '10.20.30.40 同時符合 `default`、`10.0.0.0/8`、`10.20.0.0/16`。Prefix 越長越精確，所以選 /16，從 eth1 送給 172.16.0.1。',
        ],
      },
      {
        title: '直連路由（Connected Route）',
        body: ['設定 IP 時核心自動加入本機網段的路由（`proto kernel scope link`），沒有 `via`，代表直接 ARP 目的地。'],
      },
      {
        title: '用 ip route get 驗證',
        body: [
          '`ip route get <IP>` 直接告訴你核心會怎麼送：下一跳、網卡、來源 IP。',
          '別忘了回程路徑：對方也要有路由回到你的網段，否則就是單向不通。',
        ],
      },
      {
        title: '自己試試看',
        body: ['在上方輸入任何目的 IP，看看哪幾條路由符合、最後選了哪一條。'],
      },
    ],
  },
}

export default tutorialsZhTW
