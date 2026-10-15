/** Device guide sections, in the order a beginner should read them (ids are RACK_TEMPLATES keys). */
export const DEVICE_GROUPS: { key: 'servers' | 'network' | 'storage' | 'other'; ids: string[] }[] = [
  { key: 'servers', ids: ['server-1u', 'server-2u', 'hci-node-2u', 'gpu-8u'] },
  { key: 'network', ids: ['switch-25g', 'switch-100g', 'ib-switch', 'fc-switch', 'mgmt-switch', 'firewall', 'patch-panel'] },
  { key: 'storage', ids: ['nas-12bay', 'san-array-2u', 'disk-shelf-2u', 'storage-2u', 'storage-4u'] },
  { key: 'other', ids: ['ups', 'kvm', 'blank'] },
]
