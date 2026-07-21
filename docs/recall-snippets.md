# Recall.ai feature map

Every Recall.ai capability this demo uses, and exactly where it's wired up in
the codebase. See [`docs/architecture.md`](./architecture.md) for the bigger
picture of how these pieces fit together end to end.

## 1. Desktop SDK init

The Electron main process boots the native Desktop SDK once, on app start.

```233:239:desktop/src/main.ts
app.on("ready", async () => {
  createWindow();
  registerIpcHandlers();
  registerSdkListeners();

  await RecallAiSdk.init({ apiUrl: RECALL_API_URL });
});
```

## 2. Meeting detection

The SDK watches for meeting apps/tabs opening and fires `meeting-detected`
with the window that was recognized (Zoom, Meet, Teams, etc.).

```174:178:desktop/src/main.ts
  RecallAiSdk.addEventListener("meeting-detected", async (evt) => {
    send("sdk-event", { type: "meeting-detected", window: evt.window });
    await startRecordingForMeeting(evt);
  });
```

## 3. Create Desktop SDK Upload (server-side)

Before recording can start, our backend calls Recall's Create Desktop SDK
Upload endpoint to get an `upload_token`. This keeps `RECALL_API_KEY`
server-side - the desktop app never sees it. The `recording_config` also
declares which real-time transcript/participant events we want streamed
straight into the Electron process (see #5 below).

```81:114:backend/src/lib/recall.ts
export async function createSdkUpload(): Promise<CreateSdkUploadResponse> {
  // E2E_TEST lets the Playwright suite exercise the full create -> finish ->
  // webhook -> ready flow against a live `next dev` server without real
  // Recall credentials. Never set in production - see docs/architecture.md.
  if (process.env.E2E_TEST === "1") {
    return { id: `e2e_upload_${crypto.randomUUID()}`, upload_token: "e2e_upload_token" };
  }

  const response = await recallFetch("/api/v1/sdk_upload/", {
    method: "POST",
    body: {
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {},
          },
        },
        // desktop_sdk_callback delivers these events directly into the Electron
        // process via the SDK's own `realtime-event` listener - no webhook hop.
        realtime_endpoints: [
          {
            type: "desktop_sdk_callback",
            events: [
              "transcript.data",
              "transcript.partial_data",
              "participant_events.join",
              "participant_events.update",
              "participant_events.speech_on",
              "participant_events.speech_off",
            ],
          },
        ],
      },
    },
  });
```

The desktop app calls this indirectly, via its own backend, right after
`meeting-detected`:

```53:78:desktop/src/main.ts
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
```

## 4. Start recording

Once we have an `upload_token`, the SDK is told to actually start capturing
the detected window.

```77:77:desktop/src/main.ts
    await RecallAiSdk.startRecording({ windowId: evt.window.id, uploadToken: upload_token });
```

## 5. Real-time transcription + participant events (`desktop_sdk_callback`)

Because `recording_config.transcript.provider.realtime_endpoints` (see #3)
was configured with `type: "desktop_sdk_callback"`, Recall streams
transcript and participant events directly into the Electron process as
`realtime-event` SDK events - no backend/webhook round trip needed for the
live UI.

```195:202:desktop/src/main.ts
  RecallAiSdk.addEventListener("realtime-event", (evt) => {
    send("sdk-event", {
      type: "realtime-event",
      event: evt.event,
      window: evt.window,
      data: evt.data,
    });
  });
```

The renderer's reducer turns `transcript.data` / `transcript.partial_data`
into transcript lines (partial lines get replaced in place, live, as the
speaker keeps talking), and `participant_events.*` into join/speech
tracking used for the participant list and activity indicators:

```170:224:desktop/src/useRecallSession.ts
      case "realtime-event": {
        if (payload.event === "transcript.data" || payload.event === "transcript.partial_data") {
          const parsed = extractTranscriptPayload(payload.data);
          if (!parsed || !parsed.text) {
            return { ...state, debugLog };
          }
          const isPartial = payload.event === "transcript.partial_data";
          const line: TranscriptLine = {
            id: `line-${nextLineId++}`,
            participant: parsed.participant,
            text: parsed.text,
            isPartial,
            atMs: relativeMs(state),
          };
          return isPartial
            ? { ...state, partialLine: line, debugLog }
            : { ...state, transcript: [...state.transcript, line], partialLine: null, debugLog };
        }

        if (
          payload.event === "participant_events.speech_on" ||
          payload.event === "participant_events.speech_off"
        ) {
          const participant = extractParticipant(payload.data);
          if (!participant) return { ...state, debugLog };
          const activeSpeakerIds = new Set(state.activeSpeakerIds);
          const type =
            payload.event === "participant_events.speech_on" ? "speech_on" : "speech_off";
          if (type === "speech_on") {
            activeSpeakerIds.add(participant.id);
          } else {
            activeSpeakerIds.delete(participant.id);
          }
          const participantEvents: ParticipantEventEntry[] = [
            ...state.participantEvents,
            { type, participantName: participant.name, atMs: relativeMs(state) },
          ];
          return { ...state, activeSpeakerIds, participantEvents, debugLog };
        }

        if (
          payload.event === "participant_events.join" ||
          payload.event === "participant_events.update"
        ) {
          const participant = extractParticipant(payload.data);
          if (!participant) return { ...state, debugLog };
          const participantsById = new Map(state.participantsById);
          participantsById.set(participant.id, participant);
          const type = payload.event === "participant_events.join" ? "join" : "update";
          const participantEvents: ParticipantEventEntry[] = [
            ...state.participantEvents,
            { type, participantName: participant.name, atMs: relativeMs(state) },
          ];
          return { ...state, participantsById, participantEvents, debugLog };
        }

        return { ...state, debugLog };
      }
```

## 6. Meeting/recording lifecycle events

`recording-started`, `recording-ended`, and `meeting-closed` drive the live
UI's phase machine (e.g. showing "Recording…" vs. "Meeting ended — wrapping
up…").

```186:196:desktop/src/main.ts
  RecallAiSdk.addEventListener("recording-started", (evt) => {
    send("sdk-event", { type: "recording-started", window: evt.window });
  });

  RecallAiSdk.addEventListener("recording-ended", (evt) => {
    send("sdk-event", { type: "recording-ended", window: evt.window });
  });
```

## 7. OS permission events

The Desktop SDK needs microphone/screen-recording/accessibility OS
permissions; it reports both the one-time "all granted" signal and
per-permission status changes.

```162:172:desktop/src/main.ts
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
```

## 8. Webhook lifecycle (`sdk_upload.*`) + signature verification

The dashboard's Svix-delivered webhook subscription is the _async_
counterpart to `desktop_sdk_callback`: it tells the backend when the
recording has actually finished uploading/processing on Recall's side, so
the video becomes available. Every request is HMAC-verified first.

```59:88:backend/src/app/api/webhooks/recall/route.ts
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers: Record<string, string | null> = {
    "webhook-id": request.headers.get("webhook-id"),
    "webhook-timestamp": request.headers.get("webhook-timestamp"),
    "webhook-signature": request.headers.get("webhook-signature"),
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };

  const secret = process.env.RECALL_WORKSPACE_VERIFICATION_SECRET;
  if (!secret) {
    console.error("[webhooks/recall] RECALL_WORKSPACE_VERIFICATION_SECRET is not set");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    verifyRequestFromRecall({ secret, headers, payload: rawBody });
  } catch (error) {
    console.warn("[webhooks/recall] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
```

The verification itself is the standard Svix HMAC scheme (`v1,<base64
signature>` over `"{id}.{timestamp}.{body}"`, keyed by the workspace's
`whsec_...` secret), shared by both the dashboard webhook and Recall's own
`webhook-*`-header requests:

```11:52:backend/src/lib/verify-recall-request.ts
export function verifyRequestFromRecall(args: {
  secret: string;
  headers: Record<string, string | null>;
  payload: string | null;
}): void {
  const { secret, headers, payload } = args;
  const msgId = headers["webhook-id"] ?? headers["svix-id"];
  const msgTimestamp = headers["webhook-timestamp"] ?? headers["svix-timestamp"];
  const msgSignature = headers["webhook-signature"] ?? headers["svix-signature"];

  if (!secret || !secret.startsWith("whsec_")) {
    throw new Error("Verification secret is missing or invalid");
  }
  if (!msgId || !msgTimestamp || !msgSignature) {
    throw new Error(
      `Missing webhook id (${msgId}), timestamp (${msgTimestamp}), or signature (${msgSignature})`
    );
  }

  const prefix = "whsec_";
  const base64Part = secret.startsWith(prefix) ? secret.slice(prefix.length) : secret;
  const key = Buffer.from(base64Part, "base64");

  const toSign = `${msgId}.${msgTimestamp}.${payload ?? ""}`;
  const expectedSig = crypto.createHmac("sha256", key).update(toSign).digest("base64");
  const expectedSigBytes = Buffer.from(expectedSig, "base64");

  const passedSigs = msgSignature.split(" ");
  for (const versionedSig of passedSigs) {
    const [version, signature] = versionedSig.split(",");
    if (version !== "v1" || !signature) continue;

    const sigBytes = Buffer.from(signature, "base64");
    if (
      expectedSigBytes.length === sigBytes.length &&
      crypto.timingSafeEqual(new Uint8Array(expectedSigBytes), new Uint8Array(sigBytes))
    ) {
      return;
    }
  }

  throw new Error("No matching signature found");
}
```

`sdk_upload.complete` (and the undocumented `.completed` alias we observed
live - see [`docs/recall-doc-gaps.md`](./recall-doc-gaps.md)) both trigger a
fetch of the finished recording:

```97:117:backend/src/app/api/webhooks/recall/route.ts
    case "sdk_upload.complete":
    case "sdk_upload.completed":
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { recordingId, status: "processing" },
      });
      await fetchAndStoreVideoUrl(meeting.id, recordingId);
      break;
```

## 9. Retrieve Recording (mixed video download URL)

Once notified the recording is complete, the backend fetches the recording
resource to get the mixed-video download URL Recall generated, and stores it
on the `Meeting` so the desktop app can play it back.

```139:158:backend/src/lib/recall.ts
export async function retrieveRecording(recordingId: string): Promise<RecordingResource> {
  if (process.env.E2E_TEST === "1") {
    return {
      id: recordingId,
      media_shortcuts: {
        video_mixed: {
          status: { code: "done" },
          data: { download_url: "https://example.com/e2e-fake-video.mp4" },
        },
      },
    };
  }

  const response = await recallFetch(`/api/v1/recording/${recordingId}/`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Retrieve Recording failed: ${response.status} ${text}`);
  }

  return response.json();
}
```

## 10. Recording playback with transcript-citation traceability

This is the Granola-style "click a note, jump to that moment" feature. Each
AI-generated `NoteBlock` stores the ids of the `Utterance`s it cites
(`sourceUtteranceIds`, produced during synthesis - see #11). Clicking a
citation seeks the `<video>` element to that utterance's timestamp and
scroll-highlights it in the transcript panel:

```19:46:desktop/src/components/MeetingDetail.tsx
  useEffect(() => {
    // ... loads the meeting, including its `videoUrl` from Retrieve Recording ...
  }, [meetingId]);

  function handleCitationClick(utteranceIds: string[]) {
    if (state.phase !== "loaded") return;
    const cited = state.meeting.utterances.filter((u) => utteranceIds.includes(u.id));
    if (cited.length === 0) return;

    const earliest = cited.reduce((min, u) => (u.startMs < min.startMs ? u : min));
    if (videoRef.current) {
      videoRef.current.currentTime = earliest.startMs / 1000;
    }
    setActiveUtteranceIds(new Set(utteranceIds));
    utteranceRefs.current.get(earliest.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
```

```86:94:desktop/src/components/MeetingDetail.tsx
          {state.meeting.videoUrl ? (
            <div className="border-b border-gray-200 bg-black">
              <video
                ref={videoRef}
                src={state.meeting.videoUrl}
                controls
                className="mx-auto max-h-64 w-full"
              />
            </div>
```

## 11. Post-call AI note synthesis with citations

Not a Recall API call itself, but the feature that makes the citation
traceability above meaningful: after a meeting ends, the client-collected
transcript is sent to `POST /api/meetings/:id/finish`, which persists it
(so it survives even if OpenAI is down) and then asks OpenAI to produce
structured note blocks that cite the transcript line indexes they came from:

```62:73:backend/src/app/api/meetings/[id]/finish/route.ts
  // Persist the raw transcript/participant events first so this data
  // survives even if the OpenAI pass below fails (e.g. a provider outage).
  const createdUtterances = await Promise.all(
    body.utterances.map((u) =>
      prisma.utterance.create({
        data: {
          meetingId,
          speakerName: u.speakerName,
          text: u.text,
          startMs: u.startMs ?? 0,
          endMs: u.endMs,
        },
      })
    )
  );
```

```76:96:backend/src/app/api/meetings/[id]/finish/route.ts
  try {
    const aiBlocks = await synthesizeNoteBlocks({
      userNotes: body.notes,
      utterances: synthesisInput,
    });
    for (const block of aiBlocks) {
      const utteranceIds = block.sourceUtteranceIndexes
        .map((i) => createdUtterances[i]?.id)
        .filter((id): id is string => Boolean(id));
      await prisma.noteBlock.create({
        data: {
          meetingId,
          order: order++,
          source: "ai",
          text: block.text,
          sourceUtteranceIds: JSON.stringify(utteranceIds),
        },
      });
    }
  } catch (error) {
```

## Where things live, at a glance

| Recall feature                          | Code                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| SDK init                                | `desktop/src/main.ts` (`RecallAiSdk.init`)                                 |
| Meeting detection                       | `desktop/src/main.ts` (`meeting-detected` listener)                        |
| Create Desktop SDK Upload               | `backend/src/lib/recall.ts` (`createSdkUpload`)                            |
| Start recording                         | `desktop/src/main.ts` (`RecallAiSdk.startRecording`)                       |
| Real-time transcript/participant events | `desktop/src/main.ts` + `desktop/src/useRecallSession.ts`                  |
| Recording lifecycle events              | `desktop/src/main.ts` (`recording-started/-ended`, `meeting-closed`)       |
| OS permission events                    | `desktop/src/main.ts` (`permissions-granted`, `permission-status`)         |
| Webhook signature verification          | `backend/src/lib/verify-recall-request.ts`                                 |
| Webhook lifecycle (`sdk_upload.*`)      | `backend/src/app/api/webhooks/recall/route.ts`                             |
| Retrieve Recording (video URL)          | `backend/src/lib/recall.ts` (`retrieveRecording`)                          |
| Video playback + citation traceability  | `desktop/src/components/MeetingDetail.tsx`                                 |
| AI note synthesis w/ citations          | `backend/src/lib/synthesize-notes.ts`, `.../meetings/[id]/finish/route.ts` |
