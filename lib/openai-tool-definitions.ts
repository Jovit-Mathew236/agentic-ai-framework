import { OpenAIToolDefinition } from "./interview";

// src/lib/openai-tool-definitions.ts
export const openAITools: OpenAIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "detectAnimal",
      description:
        "REQUIRED: Call this function whenever cats, dogs, or any animals are mentioned in the conversation. This function must be called for any animal-related content.",
      parameters: {
        type: "object",
        properties: {
          animal: {
            type: "string",
            enum: ["cat", "dog", "dinosaur", "none"],
            description:
              "The specific animal mentioned: 'cat' if cats/felines mentioned, 'dog' if dogs/canines mentioned, 'dinosaur' if dinosaurs mentioned, 'none' if no animals mentioned",
          },
        },
        required: ["animal"],
      },
    },
  },
];
