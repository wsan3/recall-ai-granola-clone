import type { RecallBridgeChannel } from "./preload";

declare global {
  interface Window {
    recall: {
      on: (channel: RecallBridgeChannel, callback: (payload: unknown) => void) => () => void;
    };
  }
}

export {};
