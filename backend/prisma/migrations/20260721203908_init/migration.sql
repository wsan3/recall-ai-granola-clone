-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sdkUploadId" TEXT,
    "recordingId" TEXT,
    "windowId" TEXT,
    "meetingUrl" TEXT,
    "meetingTitle" TEXT,
    "platform" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recording',
    "videoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Utterance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "speakerName" TEXT,
    "text" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER,
    CONSTRAINT "Utterance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParticipantEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "participantName" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParticipantEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceUtteranceIds" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "NoteBlock_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_sdkUploadId_key" ON "Meeting"("sdkUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_recordingId_key" ON "Meeting"("recordingId");

-- CreateIndex
CREATE INDEX "Utterance_meetingId_idx" ON "Utterance"("meetingId");

-- CreateIndex
CREATE INDEX "ParticipantEvent_meetingId_idx" ON "ParticipantEvent"("meetingId");

-- CreateIndex
CREATE INDEX "NoteBlock_meetingId_idx" ON "NoteBlock"("meetingId");
