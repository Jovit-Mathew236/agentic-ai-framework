type EventType = "question" | "answer" | "evaluation" | "system" | "conclusion";

interface InterviewEvent {
  type: EventType;
  timestamp: number;
  data: unknown;
}

export class EventManager {
  private events: InterviewEvent[] = [];
  private subscribers: Map<EventType, ((event: InterviewEvent) => void)[]> =
    new Map();

  constructor() {
    // Initialize subscribers map for each event type
    ["question", "answer", "evaluation", "system", "conclusion"].forEach(
      (type) => {
        this.subscribers.set(type as EventType, []);
      }
    );
  }

  publish(type: EventType, data: unknown) {
    const event: InterviewEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.events.push(event);

    // Notify subscribers
    const subscribers = this.subscribers.get(type) || [];
    subscribers.forEach((callback) => callback(event));
  }

  subscribe(type: EventType, callback: (event: InterviewEvent) => void) {
    const subscribers = this.subscribers.get(type) || [];
    subscribers.push(callback);
    this.subscribers.set(type, subscribers);

    // Return unsubscribe function
    return () => {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  getEventHistory(): InterviewEvent[] {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}
