import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MeetingStatus } from "../ipcEvents";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  const cases: [MeetingStatus, string][] = [
    ["recording", "Recording"],
    ["processing", "Processing"],
    ["ready", "Ready"],
    ["failed", "Failed"],
  ];

  it.each(cases)("renders the label for status=%s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
