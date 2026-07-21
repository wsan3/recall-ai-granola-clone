import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const meetingCount = await prisma.meeting.count();

  return NextResponse.json({
    status: "ok",
    service: "granola-clone-backend",
    recallRegion: process.env.RECALL_REGION ?? null,
    meetingCount,
    time: new Date().toISOString(),
  });
}
