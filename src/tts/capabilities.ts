export function threadingCapabilities() {
  let sharedMemory = false;
  let wasmThreads = false;
  let channel: MessageChannel | undefined;
  try {
    channel = new MessageChannel();
    channel.port1.postMessage(new SharedArrayBuffer(4));
    sharedMemory = true;
    wasmThreads = WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11,
    ]));
  } catch { /* Report unsupported capabilities without throwing. */ }
  finally { channel?.port1.close(); channel?.port2.close(); }
  return { isolated: globalThis.crossOriginIsolated === true, secure: globalThis.isSecureContext === true,
    sharedMemory, wasmThreads, logicalCores: navigator.hardwareConcurrency || 1 };
}

export function requestedThreadCount(value: unknown, capabilities: { isolated: boolean; sharedMemory: boolean; wasmThreads: boolean }) {
  const requested = typeof value === "number" && [1, 2, 4].includes(value) ? value : 1;
  return capabilities.isolated && capabilities.sharedMemory && capabilities.wasmThreads ? requested : 1;
}
