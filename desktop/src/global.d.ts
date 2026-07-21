import type { MeetingChannelPayload, SdkEventPayload } from "./ipcEvents";

declare global {
  interface Window {
    recall: {
      on(channel: "sdk-event", callback: (payload: SdkEventPayload) => void): () => void;
      on(channel: "meeting", callback: (payload: MeetingChannelPayload) => void): () => void;
    };
  }
}

export {};
