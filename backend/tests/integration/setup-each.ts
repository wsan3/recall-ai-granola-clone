import { beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Deleted in FK-safe order (children before parent) so each test starts from
// an empty, known DB state without needing to recreate the schema every time.
beforeEach(async () => {
  await prisma.noteBlock.deleteMany();
  await prisma.participantEvent.deleteMany();
  await prisma.utterance.deleteMany();
  await prisma.meeting.deleteMany();
});
