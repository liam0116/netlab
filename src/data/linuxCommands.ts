/**
 * Linux commands for server engineers. Commands and sample terminal output are language-neutral;
 * explanations live in src/i18n/content/linux.<locale>.ts keyed by `id`.
 */
export const COMMAND_CATEGORIES = [
  'network',
  'cpu',
  'memory',
  'disk',
  'storage',
  'process',
  'systemd',
  'logs',
  'docker',
  'dns',
  'routing',
  'port',
  'hardware',
] as const

export type CommandCategory = (typeof COMMAND_CATEGORIES)[number]

export interface LinuxCommand {
  id: string
  category: CommandCategory
  /** Short name shown as the title. */
  name: string
  /** Full example to copy. */
  example: string
  normalOutput: string
  abnormalOutput: string
}

export const LINUX_COMMANDS: LinuxCommand[] = [
  // --- Network ---------------------------------------------------------------
  {
    id: 'ip-addr',
    category: 'network',
    name: 'ip addr',
    example: 'ip addr show eth0',
    normalOutput: `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP qlen 1000
    link/ether 3c:ec:ef:12:34:56 brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0
       valid_lft forever preferred_lft forever`,
    abnormalOutput: `2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP qlen 1000
    link/ether 3c:ec:ef:12:34:56 brd ff:ff:ff:ff:ff:ff
    inet 169.254.23.7/16 brd 169.254.255.255 scope link eth0`,
  },
  {
    id: 'ip-link',
    category: 'network',
    name: 'ip link',
    example: 'ip link show',
    normalOutput: `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP mode DEFAULT qlen 1000
    link/ether 3c:ec:ef:12:34:56 brd ff:ff:ff:ff:ff:ff`,
    abnormalOutput: `2: eth0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc mq state DOWN mode DEFAULT qlen 1000
    link/ether 3c:ec:ef:12:34:56 brd ff:ff:ff:ff:ff:ff`,
  },
  {
    id: 'ip-route',
    category: 'network',
    name: 'ip route',
    example: 'ip route',
    normalOutput: `default via 192.168.1.1 dev eth0 proto static metric 100
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10 metric 100`,
    abnormalOutput: `192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.10 metric 100`,
  },
  {
    id: 'ip-neigh',
    category: 'network',
    name: 'ip neigh',
    example: 'ip neigh show dev eth0',
    normalOutput: `192.168.1.1 lladdr 00:1a:2b:3c:4d:5e REACHABLE
192.168.1.20 lladdr 3c:ec:ef:aa:bb:cc STALE`,
    abnormalOutput: `192.168.1.1 FAILED
192.168.1.20 INCOMPLETE`,
  },
  {
    id: 'ping',
    category: 'network',
    name: 'ping',
    example: 'ping -c 4 192.168.1.1',
    normalOutput: `64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=0.412 ms
64 bytes from 192.168.1.1: icmp_seq=2 ttl=64 time=0.398 ms
--- 192.168.1.1 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3055ms
rtt min/avg/max/mdev = 0.398/0.420/0.451/0.020 ms`,
    abnormalOutput: `From 192.168.1.10 icmp_seq=1 Destination Host Unreachable
From 192.168.1.10 icmp_seq=2 Destination Host Unreachable
--- 192.168.1.1 ping statistics ---
4 packets transmitted, 0 received, +4 errors, 100% packet loss, time 3062ms`,
  },
  {
    id: 'traceroute',
    category: 'network',
    name: 'traceroute',
    example: 'traceroute -n 8.8.8.8',
    normalOutput: `traceroute to 8.8.8.8, 30 hops max, 60 byte packets
 1  192.168.1.1  0.512 ms  0.488 ms  0.471 ms
 2  100.64.0.1  3.102 ms  3.087 ms  3.051 ms
 3  72.14.215.85  5.873 ms  5.802 ms  5.794 ms
 4  8.8.8.8  6.211 ms  6.190 ms  6.172 ms`,
    abnormalOutput: `traceroute to 8.8.8.8, 30 hops max, 60 byte packets
 1  192.168.1.1  0.512 ms  0.488 ms  0.471 ms
 2  * * *
 3  * * *
 4  * * *`,
  },
  {
    id: 'tracepath',
    category: 'network',
    name: 'tracepath',
    example: 'tracepath -n 10.20.0.5',
    normalOutput: ` 1?: [LOCALHOST]                      pmtu 9000
 1:  192.168.1.1                       0.420ms
 2:  10.20.0.5                         0.881ms reached
     Resume: pmtu 9000 hops 2 back 2`,
    abnormalOutput: ` 1?: [LOCALHOST]                      pmtu 9000
 1:  192.168.1.1                       0.420ms pmtu 1500
 2:  10.20.0.5                         0.902ms reached
     Resume: pmtu 1500 hops 2 back 2`,
  },
  {
    id: 'ss',
    category: 'network',
    name: 'ss',
    example: 'ss -tan',
    normalOutput: `State   Recv-Q Send-Q  Local Address:Port   Peer Address:Port
LISTEN  0      128           0.0.0.0:22          0.0.0.0:*
ESTAB   0      0       192.168.1.10:22     192.168.1.50:51022
ESTAB   0      0       192.168.1.10:41870    10.0.0.9:3306`,
    abnormalOutput: `State     Recv-Q Send-Q  Local Address:Port   Peer Address:Port
SYN-SENT  0      1       192.168.1.10:41872    10.0.0.9:3306
SYN-SENT  0      1       192.168.1.10:41874    10.0.0.9:3306`,
  },
  {
    id: 'dig',
    category: 'network',
    name: 'dig',
    example: 'dig google.com',
    normalOutput: `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 4012
;; ANSWER SECTION:
google.com.        170   IN   A   142.250.196.206
;; Query time: 12 msec
;; SERVER: 192.168.1.1#53(192.168.1.1) (UDP)`,
    abnormalOutput: `;; communications error to 192.168.1.1#53: timed out
;; communications error to 192.168.1.1#53: timed out
;; no servers could be reached`,
  },
  {
    id: 'nslookup',
    category: 'network',
    name: 'nslookup',
    example: 'nslookup google.com',
    normalOutput: `Server:   192.168.1.1
Address:  192.168.1.1#53

Non-authoritative answer:
Name:     google.com
Address:  142.250.196.206`,
    abnormalOutput: `Server:   192.168.1.1
Address:  192.168.1.1#53

** server can't find google.cm: NXDOMAIN`,
  },
  {
    id: 'ethtool',
    category: 'network',
    name: 'ethtool',
    example: 'ethtool eth0',
    normalOutput: `Settings for eth0:
    Speed: 25000Mb/s
    Duplex: Full
    Auto-negotiation: on
    Link detected: yes`,
    abnormalOutput: `Settings for eth0:
    Speed: 1000Mb/s
    Duplex: Full
    Auto-negotiation: on
    Link detected: yes`,
  },
  {
    id: 'nmcli',
    category: 'network',
    name: 'nmcli',
    example: 'nmcli device status',
    normalOutput: `DEVICE  TYPE      STATE      CONNECTION
eth0    ethernet  connected  System eth0
lo      loopback  unmanaged  --`,
    abnormalOutput: `DEVICE  TYPE      STATE         CONNECTION
eth0    ethernet  disconnected  --
eth1    ethernet  unavailable   --`,
  },
  {
    id: 'tcpdump',
    category: 'network',
    name: 'tcpdump',
    example: "tcpdump -ni eth0 'arp or icmp'",
    normalOutput: `10:15:01.100 ARP, Request who-has 192.168.1.1 tell 192.168.1.10, length 28
10:15:01.101 ARP, Reply 192.168.1.1 is-at 00:1a:2b:3c:4d:5e, length 46
10:15:01.102 IP 192.168.1.10 > 192.168.1.1: ICMP echo request, id 7, seq 1
10:15:01.103 IP 192.168.1.1 > 192.168.1.10: ICMP echo reply, id 7, seq 1`,
    abnormalOutput: `10:15:01.100 ARP, Request who-has 192.168.1.1 tell 192.168.1.10, length 28
10:15:02.120 ARP, Request who-has 192.168.1.1 tell 192.168.1.10, length 28
10:15:03.144 ARP, Request who-has 192.168.1.1 tell 192.168.1.10, length 28`,
  },

  // --- CPU ---------------------------------------------------------------------
  {
    id: 'uptime',
    category: 'cpu',
    name: 'uptime',
    example: 'uptime && nproc',
    normalOutput: ` 10:20:11 up 42 days,  3:12,  2 users,  load average: 1.20, 0.95, 0.88
16`,
    abnormalOutput: ` 10:20:11 up 42 days,  3:12,  2 users,  load average: 48.31, 39.77, 25.02
16`,
  },
  {
    id: 'top',
    category: 'cpu',
    name: 'top',
    example: 'top -b -n 1 | head -12',
    normalOutput: `%Cpu(s):  6.2 us,  1.1 sy,  0.0 ni, 92.4 id,  0.2 wa,  0.0 hi,  0.1 si
MiB Mem :  64215.4 total,  38102.7 free,  12011.9 used,  14100.8 buff/cache
    PID USER      %CPU  %MEM COMMAND
   1834 mysql     12.5   8.1 mysqld`,
    abnormalOutput: `%Cpu(s):  4.0 us,  2.1 sy,  0.0 ni, 30.2 id, 63.5 wa,  0.0 hi,  0.2 si
MiB Mem :  64215.4 total,    210.3 free,  61002.2 used,   3002.9 buff/cache
    PID USER      %CPU  %MEM COMMAND
   1834 mysql     98.0  91.2 mysqld`,
  },
  {
    id: 'mpstat',
    category: 'cpu',
    name: 'mpstat',
    example: 'mpstat -P ALL 1 1',
    normalOutput: `CPU    %usr   %sys  %iowait   %idle
all    8.12   1.40     0.10   90.31
  0    9.00   1.00     0.00   90.00
  1    7.92   1.98     0.00   90.10`,
    abnormalOutput: `CPU    %usr   %sys  %iowait   %idle
all   12.40   2.10     0.00   85.50
  0    2.00  97.00     0.00    1.00
  1    1.00   1.00     0.00   98.00`,
  },
  {
    id: 'lscpu',
    category: 'cpu',
    name: 'lscpu',
    example: 'lscpu',
    normalOutput: `Architecture:          x86_64
CPU(s):                64
Thread(s) per core:    2
Core(s) per socket:    16
Socket(s):             2
NUMA node(s):          2
Model name:            AMD EPYC 7313 16-Core Processor`,
    abnormalOutput: `Architecture:          x86_64
CPU(s):                32
Thread(s) per core:    1
Core(s) per socket:    16
Socket(s):             2
NUMA node(s):          2`,
  },

  // --- Memory -------------------------------------------------------------------
  {
    id: 'free',
    category: 'memory',
    name: 'free',
    example: 'free -h',
    normalOutput: `               total        used        free      shared  buff/cache   available
Mem:            62Gi        12Gi        36Gi       1.0Gi        14Gi        49Gi
Swap:          8.0Gi          0B       8.0Gi`,
    abnormalOutput: `               total        used        free      shared  buff/cache   available
Mem:            62Gi        60Gi       210Mi       1.0Gi       1.8Gi       512Mi
Swap:          8.0Gi       7.9Gi        98Mi`,
  },
  {
    id: 'vmstat',
    category: 'memory',
    name: 'vmstat',
    example: 'vmstat 1 5',
    normalOutput: `procs ---------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 1  0      0 37012k  2048k 14000k    0    0     2    10  820 1500  6  1 93  0  0`,
    abnormalOutput: `procs ---------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 9  6 8102k   204k    12k  1800k  3200 4100  9000  8800 4200 9100  5  9 22 64  0`,
  },
  {
    id: 'oom',
    category: 'memory',
    name: 'OOM killer',
    example: "dmesg -T | grep -i -E 'out of memory|killed process'",
    normalOutput: '(no output)',
    abnormalOutput: `[Tue Oct  1 03:12:44 2026] Out of memory: Killed process 1834 (mysqld) total-vm:68012345kB, anon-rss:61022120kB
[Tue Oct  1 03:12:44 2026] oom_reaper: reaped process 1834 (mysqld)`,
  },

  // --- Disk --------------------------------------------------------------------
  {
    id: 'df',
    category: 'disk',
    name: 'df -h',
    example: 'df -h',
    normalOutput: `Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p2  200G   61G  139G  31% /
/dev/nvme1n1    3.5T  1.2T  2.3T  35% /data`,
    abnormalOutput: `Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p2  200G  200G     0 100% /
/dev/nvme1n1    3.5T  1.2T  2.3T  35% /data`,
  },
  {
    id: 'df-inodes',
    category: 'disk',
    name: 'df -i',
    example: 'df -i /var',
    normalOutput: `Filesystem       Inodes  IUsed    IFree IUse% Mounted on
/dev/nvme0n1p2 13107200 412044 12695156    4% /`,
    abnormalOutput: `Filesystem       Inodes    IUsed IFree IUse% Mounted on
/dev/nvme0n1p2 13107200 13107200     0  100% /`,
  },
  {
    id: 'du',
    category: 'disk',
    name: 'du',
    example: 'du -xh --max-depth=1 /var | sort -h | tail -5',
    normalOutput: `120M  /var/cache
410M  /var/lib
1.1G  /var/log
1.7G  /var`,
    abnormalOutput: `410M  /var/lib
1.2G  /var/cache
96G   /var/log
98G   /var`,
  },
  {
    id: 'iostat',
    category: 'disk',
    name: 'iostat',
    example: 'iostat -xz 1 3',
    normalOutput: `Device     r/s     w/s   rkB/s   wkB/s  r_await  w_await  aqu-sz  %util
nvme0n1   12.0    40.0   480.0  2100.0     0.12     0.30    0.02    3.10`,
    abnormalOutput: `Device     r/s     w/s   rkB/s   wkB/s  r_await  w_await  aqu-sz  %util
sda      180.0   220.0 22000.0 31000.0    85.40   140.20   42.10  100.00`,
  },

  // --- Storage -------------------------------------------------------------------
  {
    id: 'lsblk',
    category: 'storage',
    name: 'lsblk',
    example: 'lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT',
    normalOutput: `NAME          SIZE TYPE FSTYPE MOUNTPOINT
nvme0n1     238.5G disk
├─nvme0n1p1     1G part vfat   /boot/efi
└─nvme0n1p2 237.5G part ext4   /
nvme1n1       3.5T disk xfs    /data`,
    abnormalOutput: `NAME          SIZE TYPE FSTYPE MOUNTPOINT
nvme0n1     238.5G disk
├─nvme0n1p1     1G part vfat   /boot/efi
└─nvme0n1p2 237.5G part ext4   /
nvme1n1       3.5T disk xfs`,
  },
  {
    id: 'findmnt',
    category: 'storage',
    name: 'findmnt',
    example: 'findmnt -t nfs4,xfs,ext4',
    normalOutput: `TARGET  SOURCE                   FSTYPE OPTIONS
/       /dev/nvme0n1p2           ext4   rw,relatime
/data   /dev/nvme1n1             xfs    rw,relatime
/mnt/nfs 10.0.30.10:/export/data nfs4   rw,relatime,vers=4.2`,
    abnormalOutput: `TARGET  SOURCE                   FSTYPE OPTIONS
/       /dev/nvme0n1p2           ext4   ro,relatime
/data   /dev/nvme1n1             xfs    rw,relatime`,
  },
  {
    id: 'blkid',
    category: 'storage',
    name: 'blkid',
    example: 'blkid /dev/nvme1n1',
    normalOutput: '/dev/nvme1n1: UUID="5f1c2a7e-9d0b-4c55-8a1e-2b6f0c3d9e11" BLOCK_SIZE="4096" TYPE="xfs"',
    abnormalOutput: '(no output)',
  },
  {
    id: 'lvs',
    category: 'storage',
    name: 'lvs',
    example: 'vgs && lvs',
    normalOutput: `  VG     #PV #LV #SN Attr   VSize  VFree
  datavg   2   1   0 wz--n- <7.00t 1.00t
  LV     VG     Attr       LSize
  datalv datavg -wi-ao---- 6.00t`,
    abnormalOutput: `  WARNING: Couldn't find device with uuid 3bX1kQ-xxxx-xxxx.
  VG     #PV #LV #SN Attr   VSize  VFree
  datavg   2   1   0 wz-pn- <7.00t 1.00t`,
  },

  // --- Process ---------------------------------------------------------------------
  {
    id: 'ps',
    category: 'process',
    name: 'ps',
    example: 'ps aux --sort=-%cpu | head -5',
    normalOutput: `USER   PID %CPU %MEM    VSZ   RSS STAT START   TIME COMMAND
mysql 1834 12.5  8.1 2.1g  5.2g Ssl  Sep01  95:12 /usr/sbin/mysqld
root   912  0.3  0.1 120m   60m Ss   Sep01   2:01 /usr/sbin/sshd -D`,
    abnormalOutput: `USER   PID %CPU %MEM    VSZ   RSS STAT START   TIME COMMAND
app   4410 99.8  0.4 1.2g  250m R    10:01  80:12 /opt/app/worker
app   4411  0.0  0.0    0     0 Z    10:01   0:00 [worker] <defunct>`,
  },
  {
    id: 'pgrep-kill',
    category: 'process',
    name: 'pgrep / kill',
    example: 'pgrep -a nginx && kill -TERM <PID>',
    normalOutput: `912 nginx: master process /usr/sbin/nginx
913 nginx: worker process`,
    abnormalOutput: '(no output)',
  },
  {
    id: 'lsof',
    category: 'process',
    name: 'lsof',
    example: 'lsof -i :8080',
    normalOutput: `COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
java    2210  app   45u  IPv6  51022      0t0  TCP *:8080 (LISTEN)`,
    abnormalOutput: `COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
python  5120 dev     3u  IPv4  61873      0t0  TCP 127.0.0.1:8080 (LISTEN)`,
  },

  // --- Systemd ---------------------------------------------------------------------
  {
    id: 'systemctl-status',
    category: 'systemd',
    name: 'systemctl status',
    example: 'systemctl status nginx',
    normalOutput: `● nginx.service - A high performance web server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)
     Active: active (running) since Tue 2026-09-01 08:00:01 UTC; 1 month ago
   Main PID: 912 (nginx)`,
    abnormalOutput: `× nginx.service - A high performance web server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)
     Active: failed (Result: exit-code) since Wed 2026-10-01 10:02:11 UTC; 5s ago
    Process: 4100 ExecStartPre=/usr/sbin/nginx -t (code=exited, status=1/FAILURE)`,
  },
  {
    id: 'systemctl-enable',
    category: 'systemd',
    name: 'systemctl enable --now',
    example: 'systemctl enable --now chronyd',
    normalOutput: 'Created symlink /etc/systemd/system/multi-user.target.wants/chronyd.service → /usr/lib/systemd/system/chronyd.service.',
    abnormalOutput: 'Failed to enable unit: Unit file chronyd.service does not exist.',
  },
  {
    id: 'systemctl-failed',
    category: 'systemd',
    name: 'systemctl --failed',
    example: 'systemctl --failed',
    normalOutput: `  UNIT LOAD ACTIVE SUB DESCRIPTION
0 loaded units listed.`,
    abnormalOutput: `  UNIT                  LOAD   ACTIVE SUB    DESCRIPTION
● data.mount            loaded failed failed /data
● nfs-client.target     loaded failed failed NFS client services
2 loaded units listed.`,
  },

  // --- Logs --------------------------------------------------------------------------
  {
    id: 'journalctl-unit',
    category: 'logs',
    name: 'journalctl -u',
    example: 'journalctl -u nginx --since "10 min ago" --no-pager',
    normalOutput: `Oct 01 10:00:01 web01 systemd[1]: Starting nginx.service...
Oct 01 10:00:01 web01 systemd[1]: Started nginx.service.`,
    abnormalOutput: `Oct 01 10:02:11 web01 nginx[4100]: nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)
Oct 01 10:02:11 web01 systemd[1]: nginx.service: Failed with result 'exit-code'.`,
  },
  {
    id: 'journalctl-err',
    category: 'logs',
    name: 'journalctl -p err',
    example: 'journalctl -p err -b --no-pager',
    normalOutput: '-- No entries --',
    abnormalOutput: `Oct 01 03:12:44 db01 kernel: Out of memory: Killed process 1834 (mysqld)
Oct 01 03:15:02 db01 kernel: nvme nvme1: I/O 412 QID 7 timeout, aborting`,
  },
  {
    id: 'tail-log',
    category: 'logs',
    name: 'tail -f',
    example: 'tail -f /var/log/nginx/error.log',
    normalOutput: '(waiting for new lines…)',
    abnormalOutput: `2026/10/01 10:05:12 [error] 913#913: *51 connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://127.0.0.1:8080/"`,
  },
  {
    id: 'dmesg',
    category: 'logs',
    name: 'dmesg',
    example: 'dmesg -T --level=err,warn',
    normalOutput: '(no output)',
    abnormalOutput: `[Wed Oct  1 09:58:40 2026] mlx5_core 0000:41:00.0 eth0: Link down
[Wed Oct  1 09:58:42 2026] mlx5_core 0000:41:00.0 eth0: Link up
[Wed Oct  1 09:58:44 2026] mlx5_core 0000:41:00.0 eth0: Link down`,
  },

  // --- Docker ------------------------------------------------------------------------
  {
    id: 'docker-ps',
    category: 'docker',
    name: 'docker ps',
    example: 'docker ps -a',
    normalOutput: `CONTAINER ID   IMAGE          STATUS                  PORTS                  NAMES
a1b2c3d4e5f6   nginx:1.27     Up 3 days (healthy)     0.0.0.0:8080->80/tcp   web`,
    abnormalOutput: `CONTAINER ID   IMAGE          STATUS                       PORTS   NAMES
a1b2c3d4e5f6   nginx:1.27     Restarting (1) 4 seconds ago         web
b2c3d4e5f6a7   app:latest     Exited (137) 2 minutes ago           api`,
  },
  {
    id: 'docker-logs',
    category: 'docker',
    name: 'docker logs',
    example: 'docker logs --tail 50 -f web',
    normalOutput: `172.17.0.1 - - [01/Oct/2026:10:00:01 +0000] "GET / HTTP/1.1" 200 615`,
    abnormalOutput: `nginx: [emerg] host not found in upstream "api:3000" in /etc/nginx/conf.d/default.conf:12`,
  },
  {
    id: 'docker-network',
    category: 'docker',
    name: 'docker network inspect',
    example: "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{.Gateway}}{{end}}' web",
    normalOutput: '172.18.0.3 172.18.0.1',
    abnormalOutput: '(no output)',
  },
  {
    id: 'docker-exec',
    category: 'docker',
    name: 'docker exec',
    example: 'docker exec -it web sh -c "wget -qO- http://api:3000/health"',
    normalOutput: '{"status":"ok"}',
    abnormalOutput: 'wget: bad address \'api:3000\'',
  },

  // --- DNS ---------------------------------------------------------------------------
  {
    id: 'resolv-conf',
    category: 'dns',
    name: '/etc/resolv.conf',
    example: 'cat /etc/resolv.conf',
    normalOutput: `nameserver 127.0.0.53
options edns0 trust-ad
search corp.example.com`,
    abnormalOutput: `# Generated by NetworkManager
# (no nameserver lines)`,
  },
  {
    id: 'resolvectl',
    category: 'dns',
    name: 'resolvectl status',
    example: 'resolvectl status eth0',
    normalOutput: `Link 2 (eth0)
    Current Scopes: DNS
  Current DNS Server: 192.168.1.1
         DNS Servers: 192.168.1.1 8.8.8.8
          DNS Domain: corp.example.com`,
    abnormalOutput: `Link 2 (eth0)
    Current Scopes: none`,
  },
  {
    id: 'getent-hosts',
    category: 'dns',
    name: 'getent hosts',
    example: 'getent hosts db01.corp.example.com',
    normalOutput: '10.0.20.15      db01.corp.example.com',
    abnormalOutput: '(no output, exit code 2)',
  },
  {
    id: 'dig-server',
    category: 'dns',
    name: 'dig @server',
    example: 'dig @8.8.8.8 example.com +short',
    normalOutput: '93.184.215.14',
    abnormalOutput: `;; communications error to 8.8.8.8#53: timed out
;; no servers could be reached`,
  },

  // --- Routing -------------------------------------------------------------------------
  {
    id: 'ip-route-get',
    category: 'routing',
    name: 'ip route get',
    example: 'ip route get 10.20.30.40',
    normalOutput: '10.20.30.40 via 192.168.1.254 dev eth0 src 192.168.1.10 uid 0',
    abnormalOutput: 'RTNETLINK answers: Network is unreachable',
  },
  {
    id: 'ip-route-add',
    category: 'routing',
    name: 'ip route add',
    example: 'ip route add 10.20.0.0/16 via 192.168.1.254 dev eth0',
    normalOutput: '(no output = success)',
    abnormalOutput: 'Error: Nexthop has invalid gateway.',
  },
  {
    id: 'ip-rule',
    category: 'routing',
    name: 'ip rule',
    example: 'ip rule show',
    normalOutput: `0:      from all lookup local
32766:  from all lookup main
32767:  from all lookup default`,
    abnormalOutput: `0:      from all lookup local
100:    from 10.0.50.0/24 lookup 200
32766:  from all lookup main`,
  },

  // --- Port --------------------------------------------------------------------------------
  {
    id: 'ss-listen',
    category: 'port',
    name: 'ss -tlnp',
    example: 'ss -tlnp',
    normalOutput: `State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      511          0.0.0.0:80         0.0.0.0:*     users:(("nginx",pid=912,fd=6))
LISTEN 0      128          0.0.0.0:22         0.0.0.0:*     users:(("sshd",pid=880,fd=3))`,
    abnormalOutput: `State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process
LISTEN 0      80         127.0.0.1:3306       0.0.0.0:*     users:(("mysqld",pid=1834,fd=21))`,
  },
  {
    id: 'nc',
    category: 'port',
    name: 'nc -zv',
    example: 'nc -zv -w 3 10.0.0.9 3306',
    normalOutput: 'Connection to 10.0.0.9 3306 port [tcp/mysql] succeeded!',
    abnormalOutput: `nc: connect to 10.0.0.9 port 3306 (tcp) failed: Connection refused
nc: connect to 10.0.0.9 port 3306 (tcp) timed out: Operation now in progress`,
  },
  {
    id: 'curl-v',
    category: 'port',
    name: 'curl -v',
    example: 'curl -v --max-time 5 http://10.0.0.20:8080/health',
    normalOutput: `*   Trying 10.0.0.20:8080...
* Connected to 10.0.0.20 (10.0.0.20) port 8080
> GET /health HTTP/1.1
< HTTP/1.1 200 OK`,
    abnormalOutput: `*   Trying 10.0.0.20:8080...
* connect to 10.0.0.20 port 8080 failed: Connection refused
curl: (7) Failed to connect to 10.0.0.20 port 8080 after 2 ms: Couldn't connect to server`,
  },

  // --- Hardware ------------------------------------------------------------------------------
  {
    id: 'lspci',
    category: 'hardware',
    name: 'lspci',
    example: "lspci | grep -i -E 'ethernet|infiniband'",
    normalOutput: `41:00.0 Ethernet controller: Mellanox Technologies MT2892 Family [ConnectX-6 Dx]
41:00.1 Ethernet controller: Mellanox Technologies MT2892 Family [ConnectX-6 Dx]`,
    abnormalOutput: '41:00.0 Ethernet controller: Mellanox Technologies MT2892 Family [ConnectX-6 Dx]',
  },
  {
    id: 'dmidecode',
    category: 'hardware',
    name: 'dmidecode',
    example: 'dmidecode -t system',
    normalOutput: `System Information
    Manufacturer: Supermicro
    Product Name: SYS-2029U-TR4
    Serial Number: S123456X9A01234`,
    abnormalOutput: '/dev/mem: Permission denied',
  },
  {
    id: 'ipmitool',
    category: 'hardware',
    name: 'ipmitool',
    example: 'ipmitool lan print 1',
    normalOutput: `IP Address Source       : Static Address
IP Address              : 10.0.10.21
Subnet Mask             : 255.255.255.0
Default Gateway IP      : 10.0.10.1`,
    abnormalOutput: `IP Address Source       : DHCP Address
IP Address              : 0.0.0.0
Subnet Mask             : 0.0.0.0
Default Gateway IP      : 0.0.0.0`,
  },
  {
    id: 'nvidia-smi',
    category: 'hardware',
    name: 'nvidia-smi',
    example: 'nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used --format=csv',
    normalOutput: `index, name, temperature.gpu, utilization.gpu [%], memory.used [MiB]
0, NVIDIA H100 80GB HBM3, 41, 87 %, 61022 MiB
1, NVIDIA H100 80GB HBM3, 43, 85 %, 60987 MiB`,
    abnormalOutput: `NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver.
Make sure that the latest NVIDIA driver is installed and running.`,
  },
]

/** English category names (the terms used at work); localized names come from linuxPage.categories. */
export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  network: 'Network',
  cpu: 'CPU',
  memory: 'Memory',
  disk: 'Disk',
  storage: 'Storage',
  process: 'Process',
  systemd: 'Systemd',
  logs: 'Logs',
  docker: 'Docker',
  dns: 'DNS',
  routing: 'Routing',
  port: 'Port',
  hardware: 'Hardware',
}
