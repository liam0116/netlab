import { ref } from 'vue'
import { randomIsn, type TcpService } from '@/utils/tcp'

// Module-level state: tutorial steps remount the visual, but the session (ISNs and service)
// must stay the same from SYN to the data exchange.
const service = ref<TcpService>('https')
const clientIsn = ref(randomIsn())
const serverIsn = ref(randomIsn())

export function useHandshakeState() {
  function regenerate(): void {
    clientIsn.value = randomIsn()
    serverIsn.value = randomIsn()
  }
  return { service, clientIsn, serverIsn, regenerate }
}
