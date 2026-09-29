/**
 * COWIO SubscriptionManager
 * Manages Firebase realtime listeners, preventing memory leaks, runaway data usage,
 * and duplicate subscriptions across component transitions and room navigation.
 */
class SubscriptionManager {
  static subscriptions = new Map();

  /**
   * Registers a subscription under a specific key.
   * If a subscription with this key already exists, it is properly unsubscribed first.
   * @param {string} key Unique identifier for the listener (e.g. 'room_sync_abc123')
   * @param {Function} unsubscribe Cleanup / off callback function
   */
  static add(key, unsubscribe) {
    if (!key || typeof unsubscribe !== "function") return;

    if (this.subscriptions.has(key)) {
      this.remove(key);
    }

    this.subscriptions.set(key, unsubscribe);
  }

  /**
   * Removes and unsubscribes a listener by key.
   * @param {string} key
   */
  static remove(key) {
    if (!key || !this.subscriptions.has(key)) return;

    const unsub = this.subscriptions.get(key);
    try {
      if (typeof unsub === "function") {
        unsub();
      }
    } catch (err) {
      console.warn(`[SubscriptionManager] Error cleaning listener "${key}":`, err);
    } finally {
      this.subscriptions.delete(key);
    }
  }

  /**
   * Removes and unsubscribes all registered listeners matching an optional prefix.
   * @param {string} [prefix] Optional prefix (e.g. 'room_')
   */
  static removeAll(prefix = null) {
    for (const [key, unsub] of this.subscriptions.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        try {
          if (typeof unsub === "function") unsub();
        } catch (e) {}
        this.subscriptions.delete(key);
      }
    }
  }

  /**
   * Disposes of all listeners.
   * Automatically called on leaveRoom, logout, and beforeunload.
   */
  static dispose() {
    for (const [key, unsub] of this.subscriptions.entries()) {
      try {
        if (typeof unsub === "function") unsub();
      } catch (e) {}
    }
    this.subscriptions.clear();
    console.log("[SubscriptionManager] All subscriptions successfully disposed.");
  }
}

// Bind automatic cleanup on window lifecycle
if (typeof window !== "undefined") {
  window.SubscriptionManager = SubscriptionManager;
  window.addEventListener("beforeunload", () => {
    SubscriptionManager.dispose();
  });
}

export default SubscriptionManager;
