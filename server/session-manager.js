const MAX_BUTTONS = 12;

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.nextIndex = 0;
  }

  update({ session, state, color, detail, tabIndex }) {
    const existing = this.sessions.get(session);

    if (existing) {
      existing.state = state;
      existing.color = color;
      existing.detail = detail;
      // Update buttonIndex if tabIndex is provided (tab may have moved)
      if (tabIndex !== undefined && tabIndex >= 0 && tabIndex < MAX_BUTTONS) {
        existing.buttonIndex = tabIndex;
      }
      existing.lastUpdate = Date.now();
      return { ...existing };
    }

    // Use tabIndex if provided, otherwise fall back to auto-assign
    const assignedIndex = (tabIndex !== undefined && tabIndex >= 0 && tabIndex < MAX_BUTTONS)
      ? tabIndex
      : this.nextIndex;

    if (assignedIndex >= MAX_BUTTONS) {
      return null;
    }

    const newSession = {
      session,
      state,
      color,
      detail,
      buttonIndex: assignedIndex,
      lastUpdate: Date.now(),
    };

    this.sessions.set(session, newSession);
    if (tabIndex === undefined) {
      this.nextIndex++;
    }
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
