// src/lib/openai-tool-definitions.ts
import { OpenAIToolDefinition } from "./interview";

export const openAITools: OpenAIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "detectAnimalssss",
      description:
        "Call only when you detect animal-related words like cat, dog, pet, etc.",
      parameters: {
        type: "object",
        properties: {
          animal: {
            type: "string",
            enum: ["cat", "dog", "bird", "fish"],
          },
          context: {
            type: "string",
            description: "Brief context of the animal mention",
          },
        },
        required: ["animal"],
      },
    },
  },

  // {
  //   type: "function",
  //   function: {
  //     name: "detectEmotion",
  //     description:
  //       "Call when strong emotions are detected in the conversation (excitement, frustration, nervousness, anger, joy, etc.)",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         emotion: {
  //           type: "string",
  //           enum: [
  //             "happy",
  //             "sad",
  //             "angry",
  //             "excited",
  //             "nervous",
  //             "confident",
  //             "frustrated",
  //             "anxious",
  //             "surprised",
  //             "disappointed",
  //           ],
  //           description: "The primary emotion detected",
  //         },
  //         intensity: {
  //           type: "number",
  //           minimum: 1,
  //           maximum: 10,
  //           description: "Intensity of the emotion on a scale of 1-10",
  //         },
  //         context: {
  //           type: "string",
  //           description: "What triggered this emotional response",
  //         },
  //       },
  //       required: ["emotion", "intensity"],
  //     },
  //   },
  // },

  // {
  //   type: "function",
  //   function: {
  //     name: "detectTechnicalTerms",
  //     description:
  //       "Call when technical terms, jargon, or specialized vocabulary are used in conversation",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         terms: {
  //           type: "array",
  //           items: { type: "string" },
  //           description: "List of technical terms detected",
  //         },
  //         category: {
  //           type: "string",
  //           enum: [
  //             "programming",
  //             "design",
  //             "business",
  //             "science",
  //             "engineering",
  //             "medical",
  //             "legal",
  //             "finance",
  //             "other",
  //           ],
  //           description: "Category of technical terms",
  //         },
  //         expertise_level: {
  //           type: "string",
  //           enum: ["beginner", "intermediate", "advanced", "expert"],
  //           description: "Assessed expertise level based on term usage",
  //         },
  //       },
  //       required: ["terms", "category"],
  //     },
  //   },
  // },

  // {
  //   type: "function",
  //   function: {
  //     name: "detectPersonalInfo",
  //     description:
  //       "Call when personal information is shared (family, relationships, personal struggles, achievements)",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         info_type: {
  //           type: "string",
  //           enum: [
  //             "family",
  //             "relationship",
  //             "achievement",
  //             "struggle",
  //             "hobby",
  //             "background",
  //             "other",
  //           ],
  //           description: "Type of personal information shared",
  //         },
  //         sensitivity: {
  //           type: "string",
  //           enum: ["low", "medium", "high"],
  //           description: "Sensitivity level of the information shared",
  //         },
  //       },
  //       required: ["info_type"],
  //     },
  //   },
  // },

  // {
  //   type: "function",
  //   function: {
  //     name: "detectInterviewDelay",
  //     description:
  //       "Call when the conversation is getting off-track from interview objectives or taking too long on one topic",
  //     parameters: {
  //       type: "object",
  //       properties: {
  //         delay_type: {
  //           type: "string",
  //           enum: [
  //             "off_topic",
  //             "too_detailed",
  //             "repetitive",
  //             "tangential",
  //             "time_consuming",
  //           ],
  //           description: "Type of delay detected",
  //         },
  //         suggested_action: {
  //           type: "string",
  //           enum: ["redirect", "summarize", "move_on", "refocus", "time_check"],
  //           description: "Suggested action to get back on track",
  //         },
  //       },
  //       required: ["delay_type"],
  //     },
  //   },
  // },
];
