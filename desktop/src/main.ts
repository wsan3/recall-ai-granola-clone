import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import RecallAiSdk, { type MeetingDetectedEvent } from "@recallai/desktop-sdk";
import { BACKEND_URL, RECALL_API_URL } from "./config";
import type {
  FinishMeetingRequest,
  FinishMeetingResponse,
  GetMeetingResult,
  ListMeetingsResult,
  MeetingChannelPayload,
  MeetingDetail,
  MeetingSummary,
  SdkEventPayload,
  UpdateMeetingTitleResult,
} from "./ipcEvents";

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function send(channel: "sdk-event", payload: SdkEventPayload): void;
function send(channel: "meeting", payload: MeetingChannelPayload): void;
function send(channel: string, payload: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.webContents.openDevTools();
};

/**
 * Requests an upload token from our own backend (which holds the Recall API
 * key) and starts the Desktop SDK recording for the detected meeting window.
 */
async function startRecordingForMeeting(evt: MeetingDetectedEvent) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/sdk-uploads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        windowId: evt.window.id,
        title: evt.window.title,
        url: evt.window.url,
        platform: evt.window.platform,
      }),
    });
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    const { upload_token, meeting_id } = (await response.json()) as {
      upload_token: string;
      meeting_id: string;
    };

    send("meeting", { type: "meeting-started", meetingId: meeting_id, window: evt.window });

    await RecallAiSdk.startRecording({ windowId: evt.window.id, uploadToken: upload_token });
  } catch (error) {
    console.error("[main] Failed to start recording", error);
    send("meeting", { type: "start-recording-failed", message: String(error) });
  }
}

/**
 * Called by the renderer (useRecallSession) once a meeting has ended and it
 * has assembled the full client-side transcript. Proxies to our backend's
 * POST /api/meetings/:id/finish, which persists the transcript and runs the
 * OpenAI synthesis pass.
 */
function registerIpcHandlers() {
  ipcMain.handle("finish-meeting", async (_event, req: FinishMeetingRequest): Promise<FinishMeetingResponse> => {
    try {
      const { meetingId, ...body } = req;
      const response = await fetch(`${BACKEND_URL}/api/meetings/${meetingId}/finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as { synthesisFailed?: boolean };
      return { status: "ok", synthesisFailed: data.synthesisFailed };
    } catch (error) {
      console.error("[main] Failed to finish meeting", error);
      return { status: "error", error: String(error) };
    }
  });

  ipcMain.handle("list-meetings", async (): Promise<ListMeetingsResult> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings`);
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as { meetings: MeetingSummary[] };
      return { status: "ok", meetings: data.meetings };
    } catch (error) {
      console.error("[main] Failed to list meetings", error);
      return { status: "error", error: String(error) };
    }
  });

  ipcMain.handle("get-meeting", async (_event, meetingId: string): Promise<GetMeetingResult> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/meetings/${meetingId}`);
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as { meeting: MeetingDetail };
      return { status: "ok", meeting: data.meeting };
    } catch (error) {
      console.error("[main] Failed to get meeting", error);
      return { status: "error", error: String(error) };
    }
  });

  ipcMain.handle(
    "update-meeting-title",
    async (_event, meetingId: string, meetingTitle: string): Promise<UpdateMeetingTitleResult> => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ meetingTitle }),
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
        }
        return { status: "ok" };
      } catch (error) {
        console.error("[main] Failed to update meeting title", error);
        return { status: "error", error: String(error) };
      }
    }
  );
}

function registerSdkListeners() {
  RecallAiSdk.addEventListener("permissions-granted", () => {
    send("sdk-event", { type: "permissions-granted" });
  });

  RecallAiSdk.addEventListener("permission-status", (evt) => {
    send("sdk-event", {
      type: "permission-status",
      permission: evt.permission,
      status: evt.status,
    });
  });

  RecallAiSdk.addEventListener("meeting-detected", async (evt) => {
    send("sdk-event", { type: "meeting-detected", window: evt.window });
    await startRecordingForMeeting(evt);
  });

  RecallAiSdk.addEventListener("meeting-updated", (evt) => {
    send("sdk-event", { type: "meeting-updated", window: evt.window });
  });

  RecallAiSdk.addEventListener("meeting-closed", (evt) => {
    send("sdk-event", { type: "meeting-closed", window: evt.window });
  });

  RecallAiSdk.addEventListener("recording-started", (evt) => {
    send("sdk-event", { type: "recording-started", window: evt.window });
  });

  RecallAiSdk.addEventListener("recording-ended", (evt) => {
    send("sdk-event", { type: "recording-ended", window: evt.window });
  });

  RecallAiSdk.addEventListener("realtime-event", (evt) => {
    send("sdk-event", {
      type: "realtime-event",
      event: evt.event,
      window: evt.window,
      data: evt.data,
    });
  });

  RecallAiSdk.addEventListener("media-capture-status", (evt) => {
    send("sdk-event", {
      type: "media-capture-status",
      window: evt.window,
      mediaType: evt.type,
      capturing: evt.capturing,
    });
  });

  RecallAiSdk.addEventListener("error", (evt) => {
    console.error("[recall-sdk] error", evt);
    send("sdk-event", {
      type: "error",
      window: evt.window,
      errorType: evt.type,
      message: evt.message,
    });
  });

  RecallAiSdk.addEventListener("network-status", (evt) => {
    send("sdk-event", { type: "network-status", status: evt.status });
  });

  RecallAiSdk.addEventListener("shutdown", (evt) => {
    send("sdk-event", { type: "shutdown", code: evt.code, signal: evt.signal });
  });
}

app.on("ready", async () => {
  createWindow();
  registerIpcHandlers();
  registerSdkListeners();

  await RecallAiSdk.init({ apiUrl: RECALL_API_URL });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
