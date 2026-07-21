/**
 * Thin client for the Recall.ai REST API.
 *
 * Every call goes through `recallFetch`, which retries on the status codes
 * Recall's docs call out as retryable (429/503/507), respecting `Retry-After`
 * on 429s. See https://docs.recall.ai/docs/agent-quickstarts.
 */

const RECALL_REGION = process.env.RECALL_REGION;
const RECALL_API_KEY = process.env.RECALL_API_KEY;

function assertConfigured(): { region: string; apiKey: string } {
  if (!RECALL_REGION || !RECALL_API_KEY) {
    throw new Error(
      "RECALL_REGION and RECALL_API_KEY must be set (see backend/.env.example)."
    );
  }
  return { region: RECALL_REGION, apiKey: RECALL_API_KEY };
}

export function recallBaseUrl(): string {
  const { region } = assertConfigured();
  return `https://${region}.recall.ai`;
}

type RecallFetchOptions = {
  method?: string;
  body?: unknown;
  maxAttempts?: number;
};

export async function recallFetch(
  path: string,
  options: RecallFetchOptions = {}
): Promise<Response> {
  const { apiKey } = assertConfigured();
  const { method = "GET", body, maxAttempts = 6 } = options;

  const url = `${recallBaseUrl()}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Token ${apiKey}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, init);

    let waitSeconds: number | null = null;
    if (response.status === 429) {
      waitSeconds = parseInt(response.headers.get("Retry-After") ?? "0", 10);
    } else if (response.status === 503) {
      waitSeconds = 10;
    } else if (response.status === 507) {
      waitSeconds = 30;
    }

    if (waitSeconds !== null && attempt < maxAttempts) {
      const jitterSeconds = Math.ceil(Math.random() * 5);
      const delayMs = 1000 * (waitSeconds + jitterSeconds);
      console.warn(
        `[recall] ${method} ${path} -> ${response.status}, retrying in ${waitSeconds}s (+jitter), attempt ${attempt}/${maxAttempts}`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    return response;
  }

  throw new Error(`Max attempts (${maxAttempts}) reached while fetching ${path}`);
}

export type CreateSdkUploadResponse = {
  id: string;
  upload_token: string;
};

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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create Desktop SDK Upload failed: ${response.status} ${text}`);
  }

  return response.json();
}

export type RecordingResource = {
  id: string;
  media_shortcuts?: {
    video_mixed?: {
      status?: { code?: string };
      data?: { download_url?: string };
    };
    transcript?: {
      status?: { code?: string };
      data?: { download_url?: string };
    };
  };
};

export async function retrieveRecording(recordingId: string): Promise<RecordingResource> {
  if (process.env.E2E_TEST === "1") {
    return {
      id: recordingId,
      media_shortcuts: {
        video_mixed: { status: { code: "done" }, data: { download_url: "https://example.com/e2e-fake-video.mp4" } },
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
