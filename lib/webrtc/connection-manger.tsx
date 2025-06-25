import { EventEmitter } from "events";
import { RefObject } from "react";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

interface ConnectionConfig {
  ephemeralKey: string;
  audioElement: RefObject<HTMLAudioElement | null>;
  onMessage: (data: Record<string, unknown>) => void;
  onStateChange: (state: ConnectionState) => void;
}

export class WebRTCConnectionManager extends EventEmitter {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioElement: RefObject<HTMLAudioElement | null>;
  private state: ConnectionState = "disconnected";
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    this.audioElement = config.audioElement;
  }

  async connect() {
    try {
      this.setState("connecting");

      // Create RTCPeerConnection
      this.pc = new RTCPeerConnection();

      // Handle incoming audio
      this.pc.ontrack = (event) => {
        if (this.audioElement.current) {
          this.audioElement.current.srcObject = event.streams[0];
        }
      };

      // Setup audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.pc.addTrack(stream.getTracks()[0]);

      // Create data channel
      this.dc = this.pc.createDataChannel("oai-events");
      this.setupDataChannel();

      // Create and set local description
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Send offer to server and get answer
      const answerSdp = await this.sendOfferToServer(offer.sdp!);
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: answerSdp,
        })
      );

      this.setState("connected");
    } catch (error) {
      console.error("Connection failed:", error);
      this.setState("failed");
      throw error;
    }
  }

  private async sendOfferToServer(sdp: string): Promise<string> {
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-mini-realtime-preview-2024-12-17";

    const response = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
      body: sdp,
    });

    if (!response.ok) {
      throw new Error(`Failed to establish RTC session: ${response.status}`);
    }

    return await response.text();
  }

  private setupDataChannel() {
    if (!this.dc) return;

    this.dc.onopen = () => {
      this.emit("datachannel:open");
    };

    this.dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.config.onMessage(data);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };

    this.dc.onclose = () => {
      this.emit("datachannel:close");
      this.setState("disconnected");
    };

    this.dc.onerror = (error) => {
      console.error("Data channel error:", error);
      this.emit("datachannel:error", error);
    };
  }

  sendMessage(data: Record<string, unknown>): boolean {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(data));
      return true;
    } else {
      console.warn(
        "Data channel not ready or not available, message not sent:",
        data,
        this.dc ? `State: ${this.dc.readyState}` : "DC is null"
      );
      return false;
    }
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.config.onStateChange(newState);
  }

  getState(): ConnectionState {
    return this.state;
  }

  disconnect() {
    if (this.pc) {
      this.pc.getSenders().forEach((sender) => sender.track?.stop());
      this.pc.close();
      this.pc = null;
    }

    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }

    this.setState("disconnected");
  }
}
