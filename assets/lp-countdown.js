/**
 * <lp-countdown> — offer timer for landing page sections.
 *
 * Two modes, chosen per section in the theme editor:
 *
 *   evergreen  Each visitor gets their own window, `data-duration-minutes` long,
 *              persisted in localStorage under `data-storage-key` so it survives
 *              navigation. After it lapses a fresh window starts, so the offer
 *              never reads as permanently expired.
 *   fixed      Counts down to the ISO timestamp in `data-ends-at`, shared by all
 *              visitors. Past that point the expired state sticks.
 *
 * Markup contract (see sections/lp-announcement-bar.liquid):
 *
 *   <lp-countdown data-mode="evergreen" data-duration-minutes="960"
 *                 data-storage-key="section-id" data-expired-text="Offer ended">
 *     <span data-countdown-time>--:--:--</span>
 *   </lp-countdown>
 *
 * On expiry the element is replaced by `data-expired-text`, or removed when that
 * is blank. Timing is derived from the deadline on every tick rather than
 * accumulated, so a backgrounded tab resumes with the correct value.
 */
class LpCountdown extends HTMLElement {
  #intervalId = null;
  #deadline = null;

  connectedCallback() {
    this.#deadline = this.#resolveDeadline();

    if (this.#deadline === null) {
      this.#renderExpired();
      return;
    }

    this.#tick();
    this.#intervalId = window.setInterval(() => this.#tick(), 1000);
  }

  disconnectedCallback() {
    if (this.#intervalId !== null) {
      window.clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  /** @returns {number | null} epoch ms to count down to, or null if already over */
  #resolveDeadline() {
    if (this.dataset.mode === 'fixed') {
      const endsAt = Date.parse(this.dataset.endsAt ?? '');
      if (Number.isNaN(endsAt)) return null;
      return endsAt > Date.now() ? endsAt : null;
    }

    const durationMs = (Number(this.dataset.durationMinutes) || 0) * 60 * 1000;
    if (durationMs <= 0) return null;

    const storageKey = `lp-countdown:${this.dataset.storageKey ?? 'default'}`;
    const stored = Number(this.#readStorage(storageKey));

    // Reuse the stored deadline while it is still in the future; otherwise start
    // a new window so a returning visitor always sees a live timer.
    if (stored > Date.now()) return stored;

    const deadline = Date.now() + durationMs;
    this.#writeStorage(storageKey, String(deadline));
    return deadline;
  }

  #tick() {
    const remainingMs = (this.#deadline ?? 0) - Date.now();

    if (remainingMs <= 0) {
      this.disconnectedCallback();
      this.#renderExpired();
      return;
    }

    const output = this.querySelector('[data-countdown-time]');
    if (output) output.textContent = LpCountdown.format(remainingMs);
  }

  #renderExpired() {
    const expiredText = this.dataset.expiredText?.trim();

    if (!expiredText) {
      // Take the preceding separator with it, so the bar doesn't keep a
      // dangling "·" once the timer is gone.
      const separator = this.previousElementSibling;
      if (separator?.classList.contains('lp-bar__separator')) separator.remove();

      this.remove();
      return;
    }

    this.textContent = expiredText;
  }

  /** Formats remaining time as HH:MM:SS. Days roll up into hours. */
  static format(remainingMs) {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  #readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Private browsing / blocked storage: fall back to a per-pageview window.
      return null;
    }
  }

  #writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Nothing to do — the timer still runs, it just won't persist.
    }
  }
}

if (!customElements.get('lp-countdown')) {
  customElements.define('lp-countdown', LpCountdown);
}
