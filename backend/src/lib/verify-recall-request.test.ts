import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyRequestFromRecall } from "./verify-recall-request";

const SECRET = `whsec_${Buffer.from("test-signing-key-material").toString("base64")}`;

function sign(secret: string, msgId: string, timestamp: string, payload: string): string {
  const base64Part = secret.slice("whsec_".length);
  const key = Buffer.from(base64Part, "base64");
  const toSign = `${msgId}.${timestamp}.${payload}`;
  const sig = crypto.createHmac("sha256", key).update(toSign).digest("base64");
  return `v1,${sig}`;
}

describe("verifyRequestFromRecall", () => {
  const payload = JSON.stringify({ event: "sdk_upload.complete" });
  const msgId = "msg_123";
  const timestamp = "1700000000";

  it("accepts a correctly signed request using webhook-* headers", () => {
    const signature = sign(SECRET, msgId, timestamp, payload);
    expect(() =>
      verifyRequestFromRecall({
        secret: SECRET,
        headers: {
          "webhook-id": msgId,
          "webhook-timestamp": timestamp,
          "webhook-signature": signature,
        },
        payload,
      })
    ).not.toThrow();
  });

  it("accepts a correctly signed request using svix-* headers", () => {
    const signature = sign(SECRET, msgId, timestamp, payload);
    expect(() =>
      verifyRequestFromRecall({
        secret: SECRET,
        headers: {
          "svix-id": msgId,
          "svix-timestamp": timestamp,
          "svix-signature": signature,
        },
        payload,
      })
    ).not.toThrow();
  });

  it("accepts a signature list containing a valid v1 entry among invalid ones", () => {
    const validSig = sign(SECRET, msgId, timestamp, payload);
    const combined = `v2,not-a-real-signature ${validSig}`;
    expect(() =>
      verifyRequestFromRecall({
        secret: SECRET,
        headers: {
          "webhook-id": msgId,
          "webhook-timestamp": timestamp,
          "webhook-signature": combined,
        },
        payload,
      })
    ).not.toThrow();
  });

  it("rejects a tampered payload", () => {
    const signature = sign(SECRET, msgId, timestamp, payload);
    expect(() =>
      verifyRequestFromRecall({
        secret: SECRET,
        headers: {
          "webhook-id": msgId,
          "webhook-timestamp": timestamp,
          "webhook-signature": signature,
        },
        payload: JSON.stringify({ event: "sdk_upload.failed" }),
      })
    ).toThrow(/no matching signature/i);
  });

  it("rejects a signature produced with the wrong secret", () => {
    const wrongSecret = `whsec_${Buffer.from("a-different-key").toString("base64")}`;
    const signature = sign(wrongSecret, msgId, timestamp, payload);
    expect(() =>
      verifyRequestFromRecall({
        secret: SECRET,
        headers: {
          "webhook-id": msgId,
          "webhook-timestamp": timestamp,
          "webhook-signature": signature,
        },
        payload,
      })
    ).toThrow(/no matching signature/i);
  });

  it("rejects when required headers are missing", () => {
    expect(() =>
      verifyRequestFromRecall({
        secret: SECRET,
        headers: { "webhook-id": msgId, "webhook-timestamp": null, "webhook-signature": null },
        payload,
      })
    ).toThrow(/missing webhook/i);
  });

  it("rejects when the verification secret is missing or malformed", () => {
    const signature = sign(SECRET, msgId, timestamp, payload);
    expect(() =>
      verifyRequestFromRecall({
        secret: "not-a-whsec-secret",
        headers: {
          "webhook-id": msgId,
          "webhook-timestamp": timestamp,
          "webhook-signature": signature,
        },
        payload,
      })
    ).toThrow(/verification secret/i);
  });
});
