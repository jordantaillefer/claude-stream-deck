const MAX_BUTTONS = 12;

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.nextIndex = 0;
  }

  update({ session, state, color, detail }) {
    const existing = this.sessions.get(session);

    if (existing) {
      existing.state = state;
      existing.color = color;
      existing.detail = detail;
      existing.lastUpdate = Date.now();
      return { ...existing };
    }

    if (this.nextIndex >= MAX_BUTTONS) {
      return null;
    }

    const newSession = {
      session,
      state,
      color,
      detail,
      buttonIndex: this.nextIndex,
      lastUpdate: Date.now(),
    };

    this.sessions.set(session, newSession);
    this.nextIndex++;
    return { ...newSession };
  }

  getAll() {
    return [...this.sessions.values()].map(s => ({ ...s }));
  }

  getByButtonIndex(index) {
    for (const session of this.sessions.values()) {
      if (session.buttonIndex === index) return { ...session };
    }
    return null;
  }
}
