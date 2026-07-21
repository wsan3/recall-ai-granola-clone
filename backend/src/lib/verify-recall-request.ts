import crypto from "crypto";

/**
 * Verifies a request came from Recall.ai using the workspace verification
 * secret. Works for both Svix-delivered dashboard webhooks (`svix-*` headers)
 * and Recall's own real-time endpoint/callback requests (`webhook-*` headers)
 * - both use the same Svix-style HMAC scheme.
 *
 * See https://docs.recall.ai/docs/authenticating-requests-from-recallai
 */
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
