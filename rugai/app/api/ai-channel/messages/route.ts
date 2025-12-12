import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/lib/aiService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, author, channelId, serverId } = body;

    // Validation
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'content' field" },
        { status: 400 }
      );
    }

    if (!channelId || typeof channelId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'channelId' field" },
        { status: 400 }
      );
    }

    // Default to system user if not provided
    const authorId = author || process.env.NEXT_PUBLIC_USER_ID || "system";
    const serverIdToUse = serverId || process.env.NEXT_PUBLIC_SERVER_ID || "default-server";

    // Post message to AI channel
    const message = await AIService.postChannelMessage(
      channelId as `${string}-${string}-${string}-${string}-${string}`,
      serverIdToUse as `${string}-${string}-${string}-${string}-${string}`,
      authorId as `${string}-${string}-${string}-${string}-${string}`,
      content
    );

    return NextResponse.json(
      {
        success: true,
        message: {
          id: message.id,
          content: message.content,
          authorId: message.authorId,
          channelId: message.channelId,
          createdAt: message.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[AI Channel API] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to post message to AI channel",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}