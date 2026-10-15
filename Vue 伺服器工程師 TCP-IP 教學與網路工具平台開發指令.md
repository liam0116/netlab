請幫我建立一個完整的「Server Engineer Network Lab」Web Application。

這個系統主要提供給伺服器工程師學習 TCP/IP、Subnet、Routing、VLAN，以及工作現場快速計算與判斷網路設定是否正確。

請不要只做靜態頁面，要做成可以互動、動畫展示、輸入資料、自動計算、模擬網路封包流向的工具網站。

---

# 一、技術架構

Frontend：

- Vue 3
- Vite
- TypeScript
- Composition API
- Pinia
- Vue Router
- Tailwind CSS
- Lucide Icons
- Mermaid 或 SVG 自製網路拓撲動畫
- Chart.js 可選

程式架構必須：

- Component 化
- 使用 TypeScript Interface
- 可維護
- Responsive Design
- 支援 Desktop / Tablet
- 不要把所有程式寫在 App.vue
- 計算邏輯與 UI 分離
- subnet 計算寫成 utils/network.ts
- 每個工具建立自己的 Vue Component

建議結構：

src/
├── components/
│   ├── network/
│   ├── tutorial/
│   └── common/
├── views/
│   ├── DashboardView.vue
│   ├── TutorialView.vue
│   ├── SubnetCalculatorView.vue
│   ├── NetworkCheckerView.vue
│   └── IPPlannerView.vue
├── stores/
├── utils/
│   └── network.ts
├── types/
│   └── network.ts
├── router/
└── App.vue

---

# 二、首頁 Dashboard

首頁設計成 Server Engineer Toolkit。

顯示主要功能：

TCP/IP Learning
Subnet Calculator
IP Calculator
Network Connection Checker
IP Address Planner
CIDR Converter
Network Topology Simulator
Port Reference
Troubleshooting Guide

UI 希望偏：

Linux / Server Dashboard
專業
深色模式
簡潔
不要過度花俏

---

# 三、TCP/IP 動畫教學

建立互動式教學。

章節：

1. Binary 二進位
2. IPv4
3. Subnet Mask
4. CIDR
5. Network Address
6. Broadcast Address
7. Gateway
8. MAC Address
9. ARP
10. Switch
11. Router
12. VLAN
13. DHCP
14. DNS
15. NAT
16. TCP
17. UDP
18. Port
19. TCP Three-way Handshake
20. Routing

每一章不要只有文字。

必須有：

- 動畫
- Step by Step
- 下一步按鈕
- 上一步按鈕
- 實際例子
- 小測驗

---

# 四、Binary 二進位動畫

例如輸入：

192

畫面顯示：

128 | 64 | 32 | 16 | 8 | 4 | 2 | 1

動畫一步一步：

192 >= 128

所以：

bit = 1

192 - 128 = 64

接著：

64 >= 64

bit = 1

64 - 64 = 0

其他全部：

0

最後顯示：

192

↓

11000000

並視覺化：

128  64  32  16  8  4  2  1
 1    1   0   0   0  0  0  0

= 128 + 64

= 192

也要可以反向輸入：

11000000

自動計算：

128 + 64 = 192

---

# 五、Subnet Mask 動畫

例如：

255.255.255.224

顯示：

11111111.11111111.11111111.11100000

動畫把所有 1 標記為 Network bits。

計算：

8 + 8 + 8 + 3

=

27

最後顯示：

255.255.255.224

=

/27

使用不同視覺區分：

Network Bits

Host Bits

---

# 六、Subnet Calculator

提供輸入：

IP Address

例如：

192.168.50.137

CIDR：

/27

按 Calculate。

自動顯示：

IP Address
Subnet Mask
CIDR
Network Address
Broadcast Address
First Host
Last Host
Total IP Addresses
Usable Hosts
Host Bits
Network Bits
Wildcard Mask
Binary IP
Binary Mask

例如：

IP:
192.168.50.137

CIDR:
/27

結果：

Subnet Mask:
255.255.255.224

Network:
192.168.50.128

Broadcast:
192.168.50.159

First Host:
192.168.50.129

Last Host:
192.168.50.158

Total:
32

Usable:
30

並且顯示計算過程：

256 - 224 = 32

Subnet：

0-31
32-63
64-95
96-127
128-159
160-191
192-223
224-255

137 位於：

128-159

所以：

Network = 128
Broadcast = 159

---

# 七、同網段判斷工具

提供：

Device A

IP:
192.168.1.10

CIDR:
/24

Device B

IP:
192.168.1.20

CIDR:
/24

按：

Check

顯示：

✓ Same Subnet

並說明：

Device A Network:
192.168.1.0/24

Device B Network:
192.168.1.0/24

因此兩台可以在 Layer 2 網路直接通訊。

如果：

192.168.1.10/24

與：

192.168.2.10/24

則顯示：

Different Subnet

需要：

Router / Layer 3 Switch / Gateway

---

# 八、Gateway Validator

輸入：

Server IP:
10.20.30.150

Mask:
/26

Gateway:
10.20.30.129

系統自動判斷 Gateway 是否在 Server 所屬 subnet。

正確：

✓ Gateway is in the same subnet.

錯誤例如：

Server:
192.168.10.50/24

Gateway:
192.168.20.1

顯示：

⚠ Gateway is outside the local subnet.

並列出：

Server Network:
192.168.10.0/24

Gateway Network:
192.168.20.0/24

---

# 九、IP Address Planner

這個是實際工作工具。

可以輸入：

Project Name

例如：

DGX Spark Lab

需要建立：

Management VLAN
Server VLAN
Storage VLAN
VM VLAN

每個 VLAN 輸入：

VLAN ID
需要多少台 Host

例如：

Management
VLAN 10
20 Hosts

Server
VLAN 20
50 Hosts

Storage
VLAN 30
30 Hosts

系統可以自動產生適合的 CIDR。

例如：

需要 20 Hosts

建議：

/27

因為：

2^5 - 2 = 30 Hosts

然後自動產生：

VLAN 10
Network:
10.10.10.0/27

Gateway:
10.10.10.1

Usable:
10.10.10.2 - 10.10.10.30

Broadcast:
10.10.10.31

---

# 十、一鍵 IP Plan Generator

提供：

Base Network

例如：

10.10.0.0/16

輸入：

Management: 20
Server: 100
Storage: 50
VM: 200
Backup: 20

系統使用 VLSM 自動規劃。

由需求最大的 subnet 開始配置。

自動產生：

Network
CIDR
Subnet Mask
Gateway
First IP
Last IP
Broadcast
Total Hosts
Available Hosts

並提供：

Copy

Export JSON

Export CSV

---

# 十一、Network Topology Simulator

讓使用者新增：

Server
Switch
Router
Firewall
Storage
Client
Internet

例如建立：

Internet
↓
Firewall
↓
Core Switch
↓
Access Switch
↓
Server

每個設備可以設定：

Name
IP
CIDR
Gateway
VLAN
MAC Address

連線後系統自動檢查基本設定。

例如：

Server A

IP:
10.10.20.50/24

Gateway:
10.10.20.1

VLAN:
20

Switch Port VLAN:
30

則顯示：

⚠ VLAN mismatch

並提示可能無法正常通訊。

---

# 十二、封包動畫

例如：

Server A

192.168.1.10/24

要連：

192.168.1.20

動畫：

Server A

↓

檢查 Subnet

↓

Same Network

↓

ARP Request

「Who has 192.168.1.20?」

↓

取得 MAC Address

↓

Switch

↓

Server B

---

另外一個例子：

Server A

192.168.1.10/24

連：

8.8.8.8

動畫：

Server

↓

Check Destination

↓

Not Local Subnet

↓

ARP Default Gateway

↓

Gateway

↓

Router

↓

NAT

↓

Internet

↓

8.8.8.8

每個步驟都要可以暫停及下一步。

---

# 十三、TCP Three-Way Handshake 動畫

動畫：

Client

→ SYN →

Server

← SYN ACK ←

Client

→ ACK →

Server

最後：

TCP Connection Established

然後可以模擬：

HTTP 80

HTTPS 443

SSH 22

MySQL 3306

---

# 十四、常用 Port 工具

建立搜尋工具：

輸入：

SSH

顯示：

TCP 22

輸入：

443

顯示：

HTTPS
TCP
443

內建：

20 FTP Data
21 FTP
22 SSH
23 Telnet
25 SMTP
53 DNS
67 DHCP Server
68 DHCP Client
80 HTTP
123 NTP
443 HTTPS
445 SMB
1433 MSSQL
3306 MySQL
3389 RDP
5432 PostgreSQL

---

# 十五、Network Troubleshooting Wizard

做成一步一步故障排查。

問題：

「Server 無法上網」

Step 1：

Network Interface 是否 UP？

Linux：

ip link

Step 2：

有沒有 IP？

ip addr

Step 3：

Routing 正確嗎？

ip route

Step 4：

可以 Ping Gateway 嗎？

ping <gateway>

Step 5：

可以 Ping Public IP 嗎？

ping 8.8.8.8

Step 6：

DNS 是否正常？

nslookup google.com

或：

dig google.com

結果判斷：

Gateway 不通：

可能：

NIC
Cable
Switch
VLAN
IP
Subnet Mask

Gateway 通但 8.8.8.8 不通：

可能：

Routing
Firewall
NAT
ISP

8.8.8.8 通但 google.com 不通：

可能：

DNS

---

# 十六、Linux Command Toolkit

建立 Server Engineer Commands 頁面。

分類：

Network
CPU
Memory
Disk
Storage
Process
Systemd
Logs
Docker
DNS
Routing
Port
Hardware

Network：

ip addr
ip link
ip route
ip neigh
ping
traceroute
tracepath
ss
dig
nslookup
ethtool
nmcli
tcpdump

每個指令都提供：

用途
範例
正常結果
異常結果
常見問題

例如：

ip route

正常：

default via 192.168.1.1 dev eth0

說明：

Default Gateway = 192.168.1.1

---

# 十七、真正的 Network Checker

注意：

Browser 無法直接執行 ICMP ping、traceroute 或任意 TCP socket。

所以這部分請設計 Backend API。

建議：

Node.js
Express 或 Fastify
TypeScript

API：

POST /api/network/ping

POST /api/network/port-check

POST /api/network/traceroute

POST /api/network/dns

POST /api/network/ip-info

例如：

POST /api/network/ping

Body：

{
  "host": "192.168.1.100"
}

Backend 執行系統 ping。

回傳：

{
  "success": true,
  "packetLoss": 0,
  "latency": 1.2
}

Frontend 顯示：

✓ Reachable

Latency:
1.2 ms

Packet Loss:
0%

---

# 十八、TCP Port Checker

輸入：

Host:
192.168.1.100

Port:
22

按：

Test

Backend 嘗試 TCP connection。

結果：

✓ TCP 22 reachable

或：

✗ Connection refused

或：

Timeout

並解釋差異：

Connection Refused：
Host 可以到，但該 Port 沒有服務 Listening，或被主機明確拒絕。

Timeout：
可能是 Firewall、Routing、ACL 或網路中斷。

---

# 十九、安全限制

Network Checker 不可以設計成任意掃描整個 Internet 的工具。

用途限定：

本人管理或已授權的 Server / Lab / Internal Network。

Backend 必須加入：

Input Validation
Command Injection Protection
Timeout
Rate Limit
Private Network Allowlist

不要直接把使用者輸入字串串進：

exec()

盡量使用：

spawn()

並嚴格驗證：

IPv4
IPv6
Hostname
Port

---

# 二十、工作模式

加入：

Learning Mode

與：

Engineer Mode

Learning Mode：

大量動畫
說明
提示
計算步驟

Engineer Mode：

快速工具
少說明
直接結果

例如 Subnet Calculator 在 Engineer Mode：

192.168.50.137/27

直接顯示：

Network      192.168.50.128
First Host   192.168.50.129
Last Host    192.168.50.158
Broadcast    192.168.50.159
Mask         255.255.255.224
Hosts        30

---

# 二十一、第一階段先完成

不要一次把所有功能寫完。

Phase 1：

1. 建立 Vue 3 專案
2. Router
3. Layout
4. Dark Mode
5. Dashboard
6. Binary Calculator
7. CIDR Converter
8. Subnet Calculator
9. Same Subnet Checker
10. Gateway Validator

完成 Phase 1 後：

確保：

npm install

npm run dev

可以正常執行。

TypeScript 不可以有 error。

---

# 二十二、第二階段

Phase 2：

Network Topology Simulator

Packet Flow Animation

TCP Three-Way Handshake

DNS / DHCP / NAT Tutorial

VLAN Tutorial

Routing Tutorial

---

# 二十三、第三階段

Phase 3：

建立 Node.js Backend。

完成：

Ping
DNS Lookup
TCP Port Check
Traceroute

Frontend 與 Backend 串接。

---

# 二十四、第四階段

Phase 4：

IP Address Planner
VLSM Calculator
VLAN Planner
一鍵 IP Plan Generator
CSV Export
JSON Export

---

# 二十五、UI 設計

整體風格：

Server / Network Engineering Dashboard

左側 Sidebar：

Dashboard

Learn
  Binary
  IPv4
  Subnet
  Routing
  VLAN
  TCP/IP

Tools
  Subnet Calculator
  CIDR Converter
  Same Subnet
  Gateway Checker
  IP Planner
  Port Checker

Lab
  Network Simulator
  Packet Simulator

Reference
  Linux Commands
  Port Reference
  Troubleshooting

右上：

Learning Mode / Engineer Mode

Dark / Light Mode

---

最重要：

這不是單純的教學網站。

目標是做成：

「Server Engineer 每天都能打開使用的 Network Toolkit」。

所有 Network 計算必須使用真正的 IPv4 binary / bitwise calculation，不要 hardcode 答案。

每一個計算 function 都加入 Unit Test。

例如測試：

192.168.50.137/27

必須得到：

Network:
192.168.50.128

Broadcast:
192.168.50.159

First:
192.168.50.129

Last:
192.168.50.158

Usable:
30

請先從 Phase 1 開始實作，完成後列出：

1. Project Structure
2. 已完成功能
3. 如何啟動
4. 關鍵程式碼位置
5. 下一階段建議

不要一次產生大量無法執行的假程式碼。
每完成一個模組都確認可以 build。