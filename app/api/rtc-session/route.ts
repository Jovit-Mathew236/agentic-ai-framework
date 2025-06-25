import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-realtime-preview-2024-12-17",
          // model: 'gpt',
          instructions: `You are a company-authorized AI interviewer in a multi-stage technical hiring process.
This is a formal interview. Stay structured, professional, and aligned to your role's function. No small talk. No improvisation. Maintain system integrity.
`,
          temperature: 1, // Lower value = more focused, deterministic behavior for interviews
          // voice: 'alloy', // Already fine for audio, optional
          // modalities: ['text', 'audio'], // Useful if voice interaction is involved
          turn_detection: {
            type: "server_vad",
            threshold: 0.6, // Slightly lower for better voice turn-detection
            prefix_padding_ms: 250,
            silence_duration_ms: 3000,
            create_response: true,
            interrupt_response: false,
          },
          // input_audio_noise_reduction: {
          //   type: 'far_field'
          // }
        }),
      }
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
