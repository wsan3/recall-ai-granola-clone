import type {
  DeleteMeetingResult,
  FinishMeetingRequest,
  FinishMeetingResponse,
  GetMeetingResult,
  ListMeetingsResult,
  MeetingChannelPayload,
  SdkEventPayload,
  UpdateMeetingTitleResult,
} from "./ipcEvents";

declare global {
  interface Window {
    recall: {
      on(channel: "sdk-event", callback: (payload: SdkEventPayload) => void): () => void;
      on(channel: "meeting", callback: (payload: MeetingChannelPayload) => void): () => void;
      finishMeeting(payload: FinishMeetingRequest): Promise<FinishMeetingResponse>;
      listMeetings(): Promise<ListMeetingsResult>;
      getMeeting(meetingId: string): Promise<GetMeetingResult>;
      updateMeetingTitle(
        meetingId: string,
        meetingTitle: string
      ): Promise<UpdateMeetingTitleResult>;
      deleteMeeting(meetingId: string): Promise<DeleteMeetingResult>;
    };
  }
}

export {};
