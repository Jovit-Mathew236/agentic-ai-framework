// src/lib/openai-tool-definitions.ts
import type { OpenAIToolDefinition } from "@/lib/interview";

export const openAITools: OpenAIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "detectAnimal",
      description: "Detects if user is talking about cats or dogs",
      parameters: {
        type: "object",
        properties: {
          animal: {
            type: "string",
            enum: ["cat", "dog", "none"],
            description: "Animal detected in user message",
          },
        },
        required: ["animal"],
      },
    },
  },
];
