import { Agent, CreateSessionResponse, ElizaClient, GetMessagesParams, GetMessagesResponse, Message, MessageMetadata, MessageResponse, MessageChannel, ListSessionsResponse, SessionInfoResponse } from "@elizaos/api-client";
import { ChannelType } from "@elizaos/core";
import { UUID } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

export interface CreateRoomRequest {
  name: string;
  worldId?: string;
  roomId?: string;
  entityId?: string;
}

export interface CreateRoomResponse {
  success: true;
  data: {
    id: string;
    name: string;
    source: string;
    worldId: string;
    entities: Array<{
      id: string;
      name: string;
    }>;
  };
}

export interface CreateRoomError {
  success: false;
  error: {
    code: string;
    message: string;
    details: string;
  };
}

const baseUrl = process.env.NEXT_PUBLIC_ELIZA_API_ENDPOINT || "http://localhost:3000";


const eliza = ElizaClient.create({
  baseUrl: process.env.NEXT_PUBLIC_ELIZA_API_ENDPOINT || "http://localhost:3000",
});

async function getAgents(): Promise<Agent[]> {
  const res = await eliza.agents.listAgents();
  return res.agents;
}

async function getSessions(): Promise<SessionInfoResponse[]> {
  const res = await eliza.sessions.listSessions();
  return res.sessions;
}

async function createSession(agentId: string, userId: string, metadata?: Record<string, string>): Promise<CreateSessionResponse> {
  return await eliza.sessions.createSession({
    agentId,
    userId,
    metadata: metadata ?? { platform: "web" },
  });
}

async function sendSessionMessage(sessionId: string, content: string): Promise<MessageResponse> {
  return await eliza.sessions.sendMessage(sessionId, {
    content,
  });
}

async function retrieveSessionMessages(sessionId: string, params?: GetMessagesParams): Promise<GetMessagesResponse> {
  return await eliza.sessions.getMessages(sessionId, params);
}

async function createChannel(agents: UUID[], user_id: UUID): Promise<MessageChannel> {
  const res = await eliza.messaging.createGroupChannel({
    name: "AI Listener Channel",
    participantIds: agents,
  });
  // await eliza.messaging.addUserToChannel(res.id, user_id);
  return res;
} 

async function getChannelMessages(channelId: UUID): Promise<{ messages: Message[] }> {
  const res = await eliza.messaging.getChannelMessages(channelId);
  return res;
}

async function postChannelMessage(
  channelId: UUID, 
  serverId: UUID,
  authorId: UUID,
  content: string
): Promise<Message> {
  const apiKey = process.env.NEXT_PUBLIC_ELIZA_API_KEY || "";
  
  const response = await fetch(`${baseUrl}/api/messaging/central-channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { "Authorization": `Bearer ${apiKey}` }),
    },
    body: JSON.stringify({
      channelId,
      server_id: serverId,
      author_id: authorId,
      content,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post channel message: ${response.status} ${errorText}`);
  }

  return await response.json();
}

 async function createRoom(
    agentId: string,
    params: CreateRoomRequest
  ): Promise<CreateRoomResponse> {
    const url = `${baseUrl}/api/agents/${agentId}/rooms`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as CreateRoomError;
        throw new Error(
          `Failed to create room: ${errorData.error?.message || response.statusText}`
        );
      }

      return data as CreateRoomResponse;
    } catch (error) {
      console.error('[AIService] Create room error:', error);
      throw error;
    }
  }

  const createRoomIfNeeded = async(
    agentId: string,
    roomId: string,
    entityId: string,
    roomName?: string
  ): Promise<{ roomId: string; isNew: boolean }> => {
    try {
      // First, try to verify if the room exists by attempting to use it
      // If it doesn't exist, create it with the provided roomId
      const params: CreateRoomRequest = {
        name: roomName || `Room ${roomId.slice(0, 8)}`,
        roomId: roomId,
        entityId: entityId,
        worldId: uuidv4(),
      };

      try {
        const response = await createRoom(agentId, params);
        
        console.log('[AIService] Room created successfully:', response.data.id);
        return {
          roomId: response.data.id,
          isNew: true,
        };
      } catch (error: any) {
        // If room already exists, the API might return a conflict error
        // In that case, we assume the room exists and return the roomId
        if (error.message?.includes('already exists') || 
            error.message?.includes('conflict') ||
            error.message?.includes('duplicate')) {
          console.log('[AIService] Room already exists:', roomId);
          return {
            roomId: roomId,
            isNew: false,
          };
        }

        // For other errors, rethrow
        throw error;
      }
    } catch (error) {
      console.error('[AIService] Create room if needed error:', error);
      throw error;
    }
  }

  const createAgentChannel = async (
    agentId: UUID,
    userId: UUID
  ): Promise<MessageChannel> => {
    const serverId = "00000000-0000-0000-0000-000000000000" as UUID;
    const channel = await eliza.messaging.getOrCreateDmChannel({
      participantIds: [agentId, userId],
    });
    return channel;
  }

  const addAgentToChannel = async (
    channelId: UUID,
    agentId: UUID
  ): Promise<boolean> => {
    try {
      const res = await eliza.messaging.addAgentToChannel(channelId, agentId);
      return res.success;
    } catch (error) {
      console.error('[AIService] Add agent to channel error:', error);
      return false;
    }
  }



export const AIService = {
  getAgents,
  createSession,
  sendSessionMessage,
  retrieveSessionMessages,
  createChannel,
  getChannelMessages,
  postChannelMessage,
  getSessions,
  createRoom,
  createRoomIfNeeded,
  addAgentToChannel,
  createAgentChannel
};
