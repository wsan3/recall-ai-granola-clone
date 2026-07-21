import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NoteBlockData } from "../ipcEvents";
import { NotesPanel } from "./NotesPanel";

const userBlock: NoteBlockData = { id: "n1", order: 0, source: "user", text: "My own note", sourceUtteranceIds: [] };
const aiBlock: NoteBlockData = { id: "n2", order: 1, source: "ai", text: "AI-expanded note", sourceUtteranceIds: ["u1", "u2"] };

describe("NotesPanel", () => {
  it("renders user and AI notes in two separate, clearly labeled sections", () => {
    render(<NotesPanel noteBlocks={[userBlock, aiBlock]} onCitationClick={vi.fn()} />);

    expect(screen.getByText("Your notes")).toBeInTheDocument();
    expect(screen.getByText("AI notes")).toBeInTheDocument();
    expect(screen.getByText("My own note")).toBeInTheDocument();
    expect(screen.getByText("AI-expanded note")).toBeInTheDocument();
  });

  it("shows empty-state copy for each section when there are no blocks", () => {
    render(<NotesPanel noteBlocks={[]} onCitationClick={vi.fn()} />);

    expect(screen.getByText(/no notes were typed/i)).toBeInTheDocument();
    expect(screen.getByText(/no ai notes/i)).toBeInTheDocument();
  });

  it("calls onCitationClick with the source utterance ids when an AI note is clicked", async () => {
    const user = userEvent.setup();
    const onCitationClick = vi.fn();
    render(<NotesPanel noteBlocks={[aiBlock]} onCitationClick={onCitationClick} />);

    await user.click(screen.getByText("AI-expanded note"));

    expect(onCitationClick).toHaveBeenCalledWith(["u1", "u2"]);
  });

  it("does not treat user notes as clickable citations", async () => {
    const user = userEvent.setup();
    const onCitationClick = vi.fn();
    render(<NotesPanel noteBlocks={[userBlock]} onCitationClick={onCitationClick} />);

    await user.click(screen.getByText("My own note"));

    expect(onCitationClick).not.toHaveBeenCalled();
  });
});
