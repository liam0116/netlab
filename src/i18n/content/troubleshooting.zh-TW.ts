import type { TroubleshootingText } from './types'

const troubleZhTW: TroubleshootingText = {
  steps: {
    link: {
      question: '網卡（Network Interface）是否 UP？',
      explain: '先確認實體層：網卡有沒有啟用、線路有沒有訊號。這一步不通，後面全部都不會通。',
      normal: '看到 `state UP` 與 `LOWER_UP`。',
      abnormal: '看到 `NO-CARRIER` 或 `state DOWN`。',
    },
    addr: {
      question: '網卡有沒有拿到 IP？',
      explain: '確認網卡上有正確的 IPv4 位址與 Mask。',
      normal: '有 `inet` 而且是預期網段的位址，例如 `192.168.1.10/24`。',
      abnormal: '沒有 `inet`，或只有 `169.254.x.x`（DHCP 失敗）。',
    },
    route: {
      question: 'Routing 正確嗎？有沒有 Default Gateway？',
      explain: '要去別的網段（包含 Internet），路由表裡必須有一條 `default via`。',
      normal: '有 `default via <Gateway>`，而且 Gateway 在本機網段內。',
      abnormal: '沒有 `default` 這一行，或 Gateway 不在本機網段。',
    },
    gateway: {
      question: '可以 Ping Gateway 嗎？',
      explain: 'Gateway 在同一個網段，ping 得到代表 Layer 1 ~ 3 的本地網路都正常。',
      normal: '`0% packet loss`。',
      abnormal: '`Destination Host Unreachable` 或 100% packet loss。',
    },
    public: {
      question: '可以 Ping Public IP（8.8.8.8）嗎？',
      explain: '直接用 IP 測試，排除 DNS，確認封包能不能經過 Router / Firewall / NAT 出到 Internet。',
      normal: '收到 `64 bytes from 8.8.8.8` 的回應。',
      abnormal: '100% packet loss。',
    },
    dns: {
      question: 'DNS 是否正常？',
      explain: '用名稱查詢，確認 DNS Server 有回應。也可以用 `nslookup google.com`。',
      normal: '`status: NOERROR` 並有 `ANSWER SECTION`。',
      abnormal: '`timed out`、`no servers could be reached` 或 `SERVFAIL`。',
    },
  },
  diagnoses: {
    link: {
      title: '實體連線問題：網卡沒有 Link',
      causes: ['網路線或光纖模組故障、沒插好', 'Switch Port 被 shutdown 或 err-disabled', '網卡被停用（`ip link set eth0 down`）', '網卡驅動或韌體異常'],
      next: ['`ethtool eth0` 確認 `Link detected`', '`dmesg -T | grep -i eth0` 看 Link up / down 紀錄', '換一條線或換一個 Switch Port 測試', '`ip link set eth0 up` 啟用網卡'],
    },
    addr: {
      title: 'IP 設定問題：沒有正確的 IP 位址',
      causes: ['DHCP Server 沒有回應（169.254 位址）', 'Switch Port 的 VLAN 設錯，到不了 DHCP Server', '靜態 IP 設定檔寫錯或沒有套用'],
      next: ['`nmcli con show <name>` 檢查 ipv4.method 與 ipv4.addresses', '`dhclient -v eth0` 或 `nmcli con up <name>` 重新取得 IP', '請網路管理員確認 Switch Port 的 VLAN'],
    },
    route: {
      title: '路由問題：沒有 Default Gateway',
      causes: ['DHCP 沒有發 Gateway', '靜態設定漏掉 Gateway', 'Gateway 設在不同網段，核心不接受'],
      next: ['`ip route add default via <gateway>` 暫時加入測試', '用本站的 Gateway Checker 確認 Gateway 是否在網段內', '寫入設定檔：`nmcli con mod <name> ipv4.gateway <gateway>`'],
    },
    gateway: {
      title: '本地網路問題：Gateway 不通',
      causes: ['NIC', 'Cable', 'Switch', 'VLAN', 'IP', 'Subnet Mask'],
      next: ['`ip neigh` 看 Gateway 的 ARP 是 `FAILED` 還是有 MAC', '`tcpdump -ni eth0 arp` 確認有沒有收到 ARP Reply', '用 Same Subnet Checker 確認 IP / Mask 與 Gateway 在同一網段', '確認 Switch Port 的 VLAN 與 Server 一致'],
    },
    public: {
      title: '出口問題：Gateway 通，但 Internet 不通',
      causes: ['Routing（Router 上缺少往 Internet 的路由）', 'Firewall 擋住對外流量', 'NAT 沒有設定或規則錯誤', 'ISP 線路中斷'],
      next: ['`traceroute -n 8.8.8.8` 看封包停在哪一跳', '`curl -I https://1.1.1.1` 確認不是只擋 ICMP', '請網路 / 防火牆管理員檢查出口規則與 NAT'],
    },
    dns: {
      title: 'DNS 問題：IP 通，但名稱解析失敗',
      causes: ['DNS'],
      next: ['`cat /etc/resolv.conf` 確認有 nameserver', '`dig @8.8.8.8 google.com` 比較外部 DNS', '確認防火牆允許 UDP / TCP 53'],
    },
    ok: {
      title: '網路正常',
      causes: ['網路層都正常，問題可能在應用程式、Proxy 設定或特定服務'],
      next: ['`curl -v https://目標網站` 看 HTTP / TLS 細節', '檢查 `http_proxy` / `https_proxy` 環境變數', '用 Port Reference 與 `nc -zv` 測試特定服務的 Port'],
    },
  },
}

export default troubleZhTW
