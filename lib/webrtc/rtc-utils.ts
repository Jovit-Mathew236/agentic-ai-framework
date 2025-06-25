import { RefObject } from "react";

export type RTCConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

export async function createRealtimeConnection(
  EPHEMERAL_KEY: string,
  audioElement: RefObject<HTMLAudioElement | null>
): Promise<{ pc: RTCPeerConnection; dc: RTCDataChannel }> {
  const pc = new RTCPeerConnection();

  pc.ontrack = (e) => {
    if (audioElement.current) {
      audioElement.current.srcObject = e.streams[0];
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(stream.getTracks()[0]);

  const dc = pc.createDataChannel("oai-events");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";

  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!sdpResponse.ok) {
    throw new Error(`Failed to establish RTC session: ${sdpResponse.status}`);
  }

  const answerSdp = await sdpResponse.text();
  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: answerSdp,
  };

  await pc.setRemoteDescription(answer);

  return { pc, dc };
}

export function sendMessageOnDataChannel(
  dc: RTCDataChannel | null,
  data: Record<string, unknown>
): boolean {
  if (dc && dc.readyState === "open") {
    dc.send(JSON.stringify(data));
    return true;
  } else {
    console.warn(
      "Data channel not ready or not available, message not sent:",
      data,
      dc ? `State: ${dc.readyState}` : "DC is null"
    );
    return false;
  }
}

export function disconnectRTCSession(
  pc: RTCPeerConnection | null,
  dc: RTCDataChannel | null
): void {
  if (dc) {
    try {
      if (dc.readyState === "open") dc.close();
    } catch (e) {
      console.error("Error closing data channel:", e);
    }
  }
  if (pc) {
    try {
      pc.getSenders().forEach((sender) => sender.track?.stop());
      pc.close();
    } catch (e) {
      console.error("Error closing peer connection:", e);
    }
  }
}
