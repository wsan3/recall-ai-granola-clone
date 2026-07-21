import { contextBridge, ipcRenderer } from "electron";
import type { FinishMeetingRequest, FinishMeetingResponse } from "./ipcEvents";

const VALID_CHANNELS = ["sdk-event", "meeting"] as const;
export type RecallBridgeChannel = (typeof VALID_CHANNELS)[number];

contextBridge.exposeInMainWorld("recall", {
  on: (channel: RecallBridgeChannel, callback: (payload: unknown) => void): (() => void) => {
    if (!VALID_CHANNELS.includes(channel)) {
      return () => {
        /* noop: unknown channel, nothing was subscribed */
      };
    }
    const listener = (_event: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  finishMeeting: (payload: FinishMeetingRequest): Promise<FinishMeetingResponse> =>
    ipcRenderer.invoke("finish-meeting", payload),
});
