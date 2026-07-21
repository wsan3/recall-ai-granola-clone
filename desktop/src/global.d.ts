import type {
  FinishMeetingRequest,
  FinishMeetingResponse,
  MeetingChannelPayload,
  SdkEventPayload,
} from "./ipcEvents";

declare global {
  interface Window {
    recall: {
      on(channel: "sdk-event", callback: (payload: SdkEventPayload) => void): () => void;
      on(channel: "meeting", callback: (payload: MeetingChannelPayload) => void): () => void;
      finishMeeting(payload: FinishMeetingRequest): Promise<FinishMeetingResponse>;
    };
  }
}

export {};
