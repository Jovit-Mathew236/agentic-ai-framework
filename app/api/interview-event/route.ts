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

// Helper to simulate sending system messages to Slave AI via HTTP
async function sendSystemMessageToSlaveAI(
  sessionId: string,
  message: string
): Promise<string> {
  console.log(
    `[Master AI Backend] Attempting to send system message to Slave AI via HTTP: ${message}`
  );
  try {
    // This is a hypothetical endpoint for the Slave AI to receive system messages
    // In a real application, replace this with the actual Slave AI API endpoint
    const slaveAiResponse = await fetch(
      "http://localhost:3001/api/slave-ai-system-message",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, systemMessage: message }),
      }
    );

    if (!slaveAiResponse.ok) {
      const errorText = await slaveAiResponse.text();
      console.error(
        `[Master AI Backend] Failed to send to Slave AI (${slaveAiResponse.status}): ${errorText}`
      );
      return `Failed to forward to Slave AI (${slaveAiResponse.status}): ${slaveAiResponse.statusText}`;
    } else {
      console.log(
        "[Master AI Backend] Successfully forwarded system message to Slave AI."
      );
      return "Forwarded via HTTP";
    }
  } catch (error) {
    console.error(
      `[Master AI Backend] Error forwarding to Slave AI: ${
        (error as Error).message
      }`
    );
    return `Error forwarding to Slave AI: ${(error as Error).message}`;
  }
}

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

    // Handle system message injection (NEW) - Backend now forwards to Slave AI
    if (type === "system_message_injection" && customSystemMessageContent) {
      console.log(
        "[Master AI] Direct system message injection requested by frontend:",
        customSystemMessageContent
      );

      const forwardingStatus = await sendSystemMessageToSlaveAI(
        sessionId,
        customSystemMessageContent
      );

      updateMasterAIContext(sessionId, {
        masterAISystemMessage: `Injected (Backend Status: ${forwardingStatus}): ${customSystemMessageContent}`,
      });

      return NextResponse.json({
        masterAISystemMessage: `Injected (Backend Status: ${forwardingStatus}): ${customSystemMessageContent}`,
        sessionId: sessionId,
      });
    }

    // Handle batch conversation processing (MAIN FLOW)
    if (type === "conversation_batch" && conversationBatch) {
      console.log("[Master AI] Processing conversation batch...");

      // Add all messages from batch to conversation history with type safety
      conversationBatch.forEach((msg: ConversationMessageForBatch) => {
        masterAIContext.conversationHistory.push({
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          speaker: msg.role,
          message: msg.content,
        });
      });

      // Analyze the conversation batch
      const recentConversation = (
        conversationBatch as ConversationMessageForBatch[]
      )
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      console.log("[Master AI] Analyzing conversation:", recentConversation);

      // Prepare messages for OpenAI API
      const masterMessages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: MASTER_SYSTEM_PROMPT,
        },
        // Add previous conversation history if available, filtering for relevant roles
        ...masterAIContext.conversationHistory
          .filter(
            (entry) => entry.speaker === "user" || entry.speaker === "assistant"
          )
          .slice(-5)
          .map(
            (entry) =>
              ({
                role: entry.speaker,
                content: entry.message,
              } as ChatCompletionMessageParam)
          ),
        // Current exchange
        {
          role: "user",
          content: `Analyze this conversation exchange and determine if intervention is needed:\n\n${recentConversation}`,
        },
      ];

      let finalSystemInstruction = "No intervention needed."; // Default
      let toolArgs: DetectAnimalArgs | undefined = undefined; // To store arguments if a tool is called, with improved type

      try {
        const masterResponse = await openai.chat.completions.create({
          model: MASTER_MODEL,
          messages: masterMessages,
          tools: openAITools,
          tool_choice: "auto",
        });

        const masterMessage = masterResponse.choices[0].message;

        // Handle tool calls if present
        if (masterMessage.tool_calls && masterMessage.tool_calls.length > 0) {
          console.log("[Master AI] Tool calls detected");

          // Add the assistant message with tool calls to the conversation
          // Ensure content is not null if it\'s a tool_call-only message
          masterMessages.push({
            role: "assistant",
            content: masterMessage.content || null, // Can be null for tool-only messages
            tool_calls: masterMessage.tool_calls,
          });

          // Process each tool call
          for (const toolCall of masterMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs: DetectAnimalArgs = JSON.parse(
              toolCall.function.arguments
            );
            toolArgs = functionArgs; // Store args for later

            if (functionName === "detectAnimal") {
              console.log(
                `[Master AI] Executing tool: ${functionName} with args:`,
                functionArgs
              );

              const toolResult = await detectAnimal(
                functionArgs,
                masterAIContext,
                sessionId
              );

              // Add tool response to the conversation
              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.data || toolResult.error),
              });
            }
          }

          // Get final response from master after tool execution
          console.log("[Master AI] Getting final intervention decision...");
          const finalMasterResponse = await openai.chat.completions.create({
            model: MASTER_MODEL,
            messages: masterMessages, // Now includes tool results
          });

          const finalMessage = finalMasterResponse.choices[0].message;

          if (finalMessage.content) {
            console.log(`[Master AI] Final decision: ${finalMessage.content}`);
            finalSystemInstruction = finalMessage.content; // This is the instruction for the interviewer

            // Attempt to forward Master AI intervention to Slave AI via HTTP
            if (finalSystemInstruction !== "No intervention needed.") {
              const forwardingStatus = await sendSystemMessageToSlaveAI(
                sessionId,
                finalSystemInstruction
              );
              finalSystemInstruction = `Master AI Intervention (Backend Status: ${forwardingStatus}): ${finalSystemInstruction}`;
            }
          } else {
            // If no content but tool was called, construct a basic instruction
            if (toolArgs) {
              const definiteToolArgs: DetectAnimalArgs = toolArgs; // Explicitly assert type
              if (definiteToolArgs.animal === "cat") {
                finalSystemInstruction =
                  "The candidate mentioned cats. Ask them about their experience with dinosaurs or pets in general.";
              } else if (definiteToolArgs.animal === "dinosaur") {
                finalSystemInstruction =
                  "The candidate mentioned dinosaurs. Ask them about their experience with cats or other pets.";
              } else {
                finalSystemInstruction = "No intervention needed.";
              }

              // Attempt to forward Master AI intervention to Slave AI via HTTP (for tool-generated instructions)
              if (finalSystemInstruction !== "No intervention needed.") {
                const forwardingStatus = await sendSystemMessageToSlaveAI(
                  sessionId,
                  finalSystemInstruction
                );
                finalSystemInstruction = `Master AI Intervention (Backend Status: ${forwardingStatus}): ${finalSystemInstruction}`;
              }
            }
          }
        } else if (masterMessage.content) {
          // No tool calls, use direct response
          console.log(`[Master AI] Direct response: ${masterMessage.content}`);
          finalSystemInstruction = masterMessage.content;

          // Attempt to forward Master AI intervention to Slave AI via HTTP
          if (finalSystemInstruction !== "No intervention needed.") {
            const forwardingStatus = await sendSystemMessageToSlaveAI(
              sessionId,
              finalSystemInstruction
            );
            finalSystemInstruction = `Master AI Intervention (Backend Status: ${forwardingStatus}): ${finalSystemInstruction}`;
          }
        }

        // Update the context with the determined system instruction
        updateMasterAIContext(sessionId, {
          masterAISystemMessage: finalSystemInstruction,
        });

        // Important: Return the system instruction in the response
        return NextResponse.json({
          masterAISystemMessage: finalSystemInstruction,
          sessionId: sessionId,
        });
      } catch (error) {
        console.error("Error processing conversation batch:", error);
        // Update context with an error message if processing fails
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

    // Default response for other request types
    return NextResponse.json({
      masterAISystemMessage: "No intervention needed.", // Default if no batch processing occurred
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
