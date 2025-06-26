// src/app/api/interview-event/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import {
  getMasterAIContext,
  updateMasterAIContext,
  initializeSession,
  detectAnimal,
} from "@/lib/master-ai-tools";
import { openAITools } from "@/lib/openai-tool-definitions";
import { DetectAnimalArgs } from "@/lib/interview";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Master AI Configuration ---
const MASTER_MODEL = "gpt-4.1-nano-2025-04-14";
const MASTER_SYSTEM_PROMPT = `You are a silent interview monitor. Your job is to:
1. Analyze conversation exchanges between interviewer and candidate
2. ALWAYS call detectAnimal function when you see mentions of: cats, dogs, or any animals
3. Look for keywords like "cat", "cats", "dog", "dogs", "pet", "pets" in the conversation
4. Based on detection results, provide specific instructions to guide the interviewer
5. If no animals are mentioned, respond with "No intervention needed."
6. Keep responses concise and focused on interview flow management

IMPORTANT: When you see animal-related words, you MUST call the detectAnimal function.`;

// Interface for incoming conversation messages in the batch
interface ConversationMessageForBatch {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// REMOVED: The failing sendSystemMessageToSlaveAI function is no longer needed.

export async function POST(req: NextRequest) {
  try {
    const { sessionId, conversationBatch, type, customSystemMessageContent } =
      await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    let masterAIContext = getMasterAIContext(sessionId);
    if (!masterAIContext) {
      masterAIContext = initializeSession(sessionId);
    }

    // Handle system message injection - it will now be handled by the frontend via RTC
    if (type === "system_message_injection" && customSystemMessageContent) {
      console.log(
        "[Master AI] System message injection instruction received from frontend:",
        customSystemMessageContent
      );
      // The backend no longer forwards this. It just acknowledges and returns.
      // The frontend will be responsible for the injection via WebRTC.
      updateMasterAIContext(sessionId, {
        masterAISystemMessage: `Instruction for manual injection: ${customSystemMessageContent}`,
      });

      return NextResponse.json({
        masterAISystemMessage: customSystemMessageContent, // Return the raw message for the frontend to send
        sessionId: sessionId,
      });
    }

    // Handle batch conversation processing
    if (type === "conversation_batch" && conversationBatch) {
      console.log("[Master AI] Processing conversation batch...");

      masterAIContext.conversationHistory.push(
        ...(conversationBatch as ConversationMessageForBatch[]).map((msg) => ({
          id: Date.now() + Math.random(),
          timestamp: new Date(msg.timestamp).toISOString(),
          speaker: msg.role,
          message: msg.content,
        }))
      );

      const recentConversation = (
        conversationBatch as ConversationMessageForBatch[]
      )
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      console.log("[Master AI] Analyzing conversation:", recentConversation);

      const masterMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: MASTER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this conversation exchange and determine if intervention is needed:\n\n${recentConversation}`,
        },
      ];

      let finalSystemInstruction = "No intervention needed.";

      try {
        const masterResponse = await openai.chat.completions.create({
          model: MASTER_MODEL,
          messages: masterMessages,
          tools: openAITools,
          tool_choice: "auto",
        });

        const masterMessage = masterResponse.choices[0].message;

        if (masterMessage.tool_calls && masterMessage.tool_calls.length > 0) {
          console.log("[Master AI] Tool calls detected");
          masterMessages.push(masterMessage);

          for (const toolCall of masterMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs: DetectAnimalArgs = JSON.parse(
              toolCall.function.arguments
            );

            if (functionName === "detectAnimal") {
              const toolResult = await detectAnimal(
                functionArgs,
                masterAIContext,
                sessionId
              );
              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.data || toolResult.error),
              });
            }
          }

          const finalMasterResponse = await openai.chat.completions.create({
            model: MASTER_MODEL,
            messages: masterMessages,
          });

          if (finalMasterResponse.choices[0].message.content) {
            finalSystemInstruction =
              finalMasterResponse.choices[0].message.content;
          }
        } else if (masterMessage.content) {
          finalSystemInstruction = masterMessage.content;
        }

        console.log(`[Master AI] Final decision: ${finalSystemInstruction}`);
        updateMasterAIContext(sessionId, {
          masterAISystemMessage: finalSystemInstruction,
        });

        return NextResponse.json({
          masterAISystemMessage: finalSystemInstruction, // Return the final instruction
          sessionId: sessionId,
        });
      } catch (error) {
        console.error("Error processing conversation batch:", error);
        updateMasterAIContext(sessionId, {
          masterAISystemMessage: `Error processing conversation: ${
            (error as Error).message
          }`,
        });
        return NextResponse.json(
          { error: "Failed to process conversation batch." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      masterAISystemMessage: "Request type not handled.",
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("Error in interview-event route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
