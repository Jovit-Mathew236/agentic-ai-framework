// src/app/api/interview-event/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  getMasterContext,
  updateMasterContext,
  initializeSession,
  toolFunctions,
} from "@/lib/master-ai-tools";
import { openAITools } from "@/lib/openai-tool-definitions";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Master AI Configuration

const MASTER_MODEL = "gpt-4.1-nano-2025-04-14"; // Using a more reliable model
const MASTER_SYSTEM_PROMPT = `You are a Master AI conversation monitor. Your job is to:

1. Analyze conversation exchanges between participants
2. ONLY call tools when you clearly detect the specified conditions
3. If no clear triggers detected, respond with "No intervention needed."
4. Do NOT call tools for unrelated conversations

Available tools: ${openAITools.map((tool) => tool.function.name).join(", ")}
Available tools descriptions: call this ${openAITools
  .map((tool) => tool.function.name)
  .join(", ")} when ${openAITools
  .map((tool) => tool.function.description)
  .join(", ")}
`;

// Interface for incoming conversation messages
interface ConversationMessageForBatch {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, conversationBatch, type } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    let masterContext = getMasterContext(sessionId);
    if (!masterContext) {
      masterContext = initializeSession(sessionId);
    }

    // Handle batch conversation processing
    if (type === "conversation_batch" && conversationBatch) {
      console.log("[Master AI] Processing conversation batch...");

      // Add to conversation history
      masterContext.conversationHistory.push(
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
          content: `Analyze this conversation exchange and determine if intervention is needed. If you detect any trigger, you MUST call the appropriate tools:\n\n${recentConversation}`,
        },
      ];

      let finalSystemInstruction = "No intervention needed.";

      try {
        console.log("[Debug] Conversation being analyzed:", recentConversation);
        console.log("[Debug] System prompt:", MASTER_SYSTEM_PROMPT);

        const masterResponse = await openai.chat.completions.create({
          model: MASTER_MODEL,
          messages: masterMessages,
          tools: openAITools,
          tool_choice: "auto", // Let the model decide when to use tools
        });

        console.log(
          "[Debug] Master AI response:",
          JSON.stringify(masterResponse.choices[0].message, null, 2)
        );

        const masterMessage = masterResponse.choices[0].message;

        if (masterMessage.tool_calls && masterMessage.tool_calls.length > 0) {
          console.log(
            "[Master AI] Tool calls detected:",
            masterMessage.tool_calls.length
          );
          masterMessages.push(masterMessage);

          // Execute all tool calls and collect interventions
          const interventions: string[] = [];

          for (const toolCall of masterMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            console.log(
              `[Master AI] Executing tool: ${functionName} with args:`,
              functionArgs
            );

            if (toolFunctions[functionName]) {
              const toolResult = await toolFunctions[functionName](
                functionArgs,
                masterContext,
                sessionId
              );

              console.log(
                `[Master AI] Tool ${functionName} result:`,
                toolResult
              );

              // Extract intervention from tool result
              if (
                toolResult.success &&
                typeof toolResult.data?.intervention === "string"
              ) {
                interventions.push(toolResult.data.intervention);
              }

              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.data || toolResult.error),
              });
            } else {
              console.error(`[Master AI] Unknown tool: ${functionName}`);
              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  error: `Unknown tool: ${functionName}`,
                }),
              });
            }
          }

          // If we have interventions from tools, use them directly
          if (interventions.length > 0) {
            finalSystemInstruction = interventions.join("\n\n");
            console.log(
              `[Master AI] Using tool-generated interventions: ${finalSystemInstruction}`
            );
          } else {
            // Get final response after tool execution for additional context
            const finalMasterResponse = await openai.chat.completions.create({
              model: MASTER_MODEL,
              messages: [
                ...masterMessages,
                {
                  role: "user",
                  content:
                    "Based on the tool results above, provide final intervention instructions for the interviewer AI. Be specific and actionable.",
                },
              ],
            });

            if (finalMasterResponse.choices[0].message.content) {
              finalSystemInstruction =
                finalMasterResponse.choices[0].message.content;
            }
          }
        } else if (masterMessage.content) {
          console.log("[Master AI] No tools called, using direct response");
          finalSystemInstruction = masterMessage.content;
        }

        console.log(
          `[Master AI] Final intervention instruction: ${finalSystemInstruction}`
        );

        updateMasterContext(sessionId, {
          masterAISystemMessage: finalSystemInstruction,
        });

        return NextResponse.json({
          masterAISystemMessage: finalSystemInstruction,
          sessionId: sessionId,
        });
      } catch (error) {
        console.error("Error processing conversation batch:", error);
        updateMasterContext(sessionId, {
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
