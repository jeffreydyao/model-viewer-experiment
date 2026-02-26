declare module 'react-native-zeroconf' {
  export const ImplType: {
    NSD: string;
    DNSSD: string;
  };

  export default class Zeroconf {
    scan(type?: string, protocol?: string, domain?: string, implType?: string): void;
    stop(implType?: string): void;
    getServices(): Record<string, unknown>;
    publishService(type: string, protocol: string, domain: string, name: string, port: number, txt?: Record<string, string>, implType?: string): void;
    unpublishService(name: string, implType?: string): void;
    removeDeviceListeners(): void;
    on(event: string, callback: (...args: unknown[]) => void): void;
  }
}
