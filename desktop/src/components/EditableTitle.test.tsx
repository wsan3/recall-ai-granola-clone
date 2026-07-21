import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditableTitle } from "./EditableTitle";

beforeEach(() => {
  window.recall = { ...window.recall, updateMeetingTitle: vi.fn() } as typeof window.recall;
});

describe("EditableTitle", () => {
  it("shows a placeholder when there is no title yet", () => {
    render(<EditableTitle meetingId="m1" title={null} onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Untitled meeting" })).toBeInTheDocument();
  });

  it("shows the current title as a clickable button", () => {
    render(<EditableTitle meetingId="m1" title="Weekly Sync" onSaved={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Weekly Sync" })).toBeInTheDocument();
  });

  it("switches to an input on click, saves on Enter, and calls onSaved", async () => {
    const user = userEvent.setup();
    window.recall.updateMeetingTitle = vi.fn().mockResolvedValue({ status: "ok" });
    const onSaved = vi.fn();

    render(<EditableTitle meetingId="m1" title="Old title" onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "Old title" }));

    const input = screen.getByDisplayValue("Old title");
    await user.clear(input);
    await user.type(input, "New title{Enter}");

    await waitFor(() => expect(window.recall.updateMeetingTitle).toHaveBeenCalledWith("m1", "New title"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("New title"));
  });

  it("reverts to the button without saving on Escape", async () => {
    const user = userEvent.setup();
    window.recall.updateMeetingTitle = vi.fn();
    const onSaved = vi.fn();

    render(<EditableTitle meetingId="m1" title="Old title" onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "Old title" }));
    const input = screen.getByDisplayValue("Old title");
    await user.type(input, " more text{Escape}");

    expect(screen.getByRole("button", { name: "Old title" })).toBeInTheDocument();
    expect(window.recall.updateMeetingTitle).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("does not call updateMeetingTitle when blurring without changing the value", async () => {
    const user = userEvent.setup();
    window.recall.updateMeetingTitle = vi.fn();

    render(<EditableTitle meetingId="m1" title="Unchanged" onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Unchanged" }));
    await user.click(document.body);

    expect(window.recall.updateMeetingTitle).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Unchanged" })).toBeInTheDocument();
  });

  it("reverts the value and logs an error when saving fails", async () => {
    const user = userEvent.setup();
    window.recall.updateMeetingTitle = vi.fn().mockResolvedValue({ status: "error", error: "network down" });
    const onSaved = vi.fn();

    render(<EditableTitle meetingId="m1" title="Old title" onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "Old title" }));
    const input = screen.getByDisplayValue("Old title");
    await user.clear(input);
    await user.type(input, "New title{Enter}");

    await waitFor(() => expect(screen.getByRole("button", { name: "Old title" })).toBeInTheDocument());
    expect(onSaved).not.toHaveBeenCalled();
  });
});
