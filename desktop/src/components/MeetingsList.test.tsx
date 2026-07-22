import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingSummary } from "../ipcEvents";
import { MeetingsList } from "./MeetingsList";

const MEETING_A: MeetingSummary = {
  id: "m1",
  meetingTitle: "Weekly Sync",
  platform: "google_meet",
  meetingUrl: null,
  status: "ready",
  videoUrl: null,
  createdAt: "2024-01-01T00:00:00.000Z",
  endedAt: null,
  noteBlockCount: 2,
};

const MEETING_B: MeetingSummary = {
  ...MEETING_A,
  id: "m2",
  meetingTitle: "1:1",
  noteBlockCount: 0,
};

/** Walks up from a meeting's title text to the row div containing both the select and delete buttons. */
function findRow(titleText: string): HTMLElement {
  const titleButton = screen.getByText(titleText).closest("button");
  const row = titleButton?.parentElement;
  if (!row) throw new Error(`Could not find row for "${titleText}"`);
  return row;
}

beforeEach(() => {
  window.recall = {
    ...window.recall,
    listMeetings: vi.fn().mockResolvedValue({ status: "ok", meetings: [MEETING_A, MEETING_B] }),
    deleteMeeting: vi.fn(),
  } as unknown as typeof window.recall;
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockReturnValue(undefined);
});

describe("MeetingsList", () => {
  it("renders meetings returned by listMeetings", async () => {
    render(<MeetingsList onSelect={vi.fn()} />);
    expect(await screen.findByText("Weekly Sync")).toBeInTheDocument();
    expect(screen.getByText("1:1")).toBeInTheDocument();
  });

  it("calls onSelect when a meeting's title is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MeetingsList onSelect={onSelect} />);

    await user.click(await screen.findByText("Weekly Sync"));
    expect(onSelect).toHaveBeenCalledWith("m1");
  });

  it("asks for confirmation, deletes, and removes the meeting from the list", async () => {
    const user = userEvent.setup();
    window.recall.deleteMeeting = vi.fn().mockResolvedValue({ status: "ok" });

    render(<MeetingsList onSelect={vi.fn()} />);
    await screen.findByText("Weekly Sync");

    const rowA = findRow("Weekly Sync");
    await user.click(within(rowA).getByRole("button", { name: "Delete meeting" }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(window.recall.deleteMeeting).toHaveBeenCalledWith("m1"));
    await waitFor(() => expect(screen.queryByText("Weekly Sync")).not.toBeInTheDocument());
    expect(screen.getByText("1:1")).toBeInTheDocument();
  });

  it("does not delete when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<MeetingsList onSelect={vi.fn()} />);
    await screen.findByText("Weekly Sync");

    const rowA = findRow("Weekly Sync");
    await user.click(within(rowA).getByRole("button", { name: "Delete meeting" }));

    expect(window.recall.deleteMeeting).not.toHaveBeenCalled();
    expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
  });

  it("shows an alert and keeps the meeting when deletion fails", async () => {
    const user = userEvent.setup();
    window.recall.deleteMeeting = vi.fn().mockResolvedValue({ status: "error", error: "boom" });

    render(<MeetingsList onSelect={vi.fn()} />);
    await screen.findByText("Weekly Sync");

    const rowA = findRow("Weekly Sync");
    await user.click(within(rowA).getByRole("button", { name: "Delete meeting" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
  });
});
