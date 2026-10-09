const CARD_VERSION = "2.0.0";

// A small square button in the Kennedyish Weather card's style: deep teal when off,
// glowing in the bulb's color (or turquoise for a fan or plug) when on.
// Tap toggles; press and hold opens Home Assistant's controls. With a `timer`,
// it counts down the time left, e.g. until an automation turns a fan off.

const ICONS = {
  bulb: `<circle class="glass" cx="24" cy="20" r="11"></circle>
    <path class="base" d="M19.8 30.2 H28.2 V36.4 Q24 39.6 19.8 36.4 Z"></path>`,
  fan: `<circle class="guard" cx="24" cy="24" r="17.5"></circle>
    <g class="blades">${[0, 120, 240]
      .map((angle) => `<path d="M24 24 C19.5 18.5 19.8 10.2 25.6 9.2 C30.6 8.6 30.2 17.2 24 24 Z" transform="rotate(${angle} 24 24)"></path>`)
      .join("")}</g>`,
  plug: `<rect class="plate" x="11" y="11" width="26" height="26" rx="7"></rect>
    <path class="slots" d="M19.5 19 V25 M28.5 19 V25"></path>`,
};

function iconKind(entityId, name) {
  if (entityId.startsWith("light.")) return "bulb";
  if (entityId.startsWith("fan.") || /\bfan\b/i.test(name)) return "fan";
  return "plug";
}

/** Seconds left on a running or paused timer, or null when it is idle. */
function secondsLeft(timer) {
  if (timer?.state === "active") return Math.max(0, (Date.parse(timer.attributes.finishes_at) - Date.now()) / 1000);
  if (timer?.state === "paused") {
    const [h, m, s] = String(timer.attributes.remaining).split(":").map(Number);
    return h * 3600 + m * 60 + s;
  }
  return null;
}

function formatLeft(seconds) {
  const total = Math.ceil(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);

const HTMLElementBase = globalThis.HTMLElement || class {};

export class KennedyishButtonCard extends HTMLElementBase {
  constructor() {
    super();
    this.attachShadow?.({ mode: "open" });
    let holdTimer;
    let held = false;
    this.shadowRoot?.addEventListener("pointerdown", () => {
      held = false;
      holdTimer = setTimeout(() => {
        held = true;
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
      }, 500);
    });
    this.shadowRoot?.addEventListener("pointerup", () => clearTimeout(holdTimer));
    this.shadowRoot?.addEventListener("pointerleave", () => clearTimeout(holdTimer));
    this.shadowRoot?.addEventListener("click", () => {
      if (!held) this._hass?.callService("homeassistant", "toggle", { entity_id: this._config.entity });
    });
  }

  setConfig(config) {
    if (!config?.entity) throw new Error('Please set "entity".');
    this._config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    const timer = this._config.timer ? hass.states[this._config.timer] : undefined;
    if (stateObj === this._stateObj && timer === this._timer) return;
    this._stateObj = stateObj;
    this._timer = timer;
    this._render();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
  }

  connectedCallback() {
    if (this._hass) this._render();
  }

  _countdown() {
    const seconds = secondsLeft(this._timer);
    if (seconds === null) return "";
    return `${formatLeft(seconds)} ${this._timer.state === "paused" ? "paused" : "left"}`;
  }

  getGridOptions() {
    return { columns: 3, rows: 2 };
  }

  _render() {
    if (!this.shadowRoot) return;
    const stateObj = this._stateObj;
    const name = this._config.name || stateObj?.attributes.friendly_name || this._config.entity;
    const on = stateObj?.state === "on";
    const kind = this._config.icon || iconKind(this._config.entity, name);
    const rgb = stateObj?.attributes.rgb_color;
    const glow = on && kind === "bulb" && rgb ? `--glow: rgb(${rgb.join(", ")})` : "";
    const countdown = this._countdown();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        ha-card {
          --glow: #f2b53c;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 100%;
          box-sizing: border-box;
          padding: 10px 8px;
          overflow: hidden;
          border: none;
          border-radius: var(--ha-card-border-radius, 16px);
          color: #fbf3e2;
          background: #123f3c;
          box-shadow: 0 1px 2px rgba(60, 40, 20, .08), 0 8px 22px rgba(60, 40, 20, .12);
          font-family: Futura, "Futura PT", Jost, "Avenir Next", "Century Gothic", sans-serif;
          cursor: pointer;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          transition: background .3s ease, color .3s ease;
        }
        ha-card:active { transform: scale(.96); }
        ha-card.on { color: #123f3c; background: linear-gradient(145deg, color-mix(in srgb, var(--glow) 45%, #fff4d6), var(--glow)); }
        ha-card.on.fan, ha-card.on.plug { background: linear-gradient(145deg, #bfe8dd, #5fbfb5); }
        /* Ben-Day dots over a lit button, like the weather card's skies. */
        ha-card.on::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 250, 240, .5) 1.1px, transparent 1.4px) 0 0 / 6px 6px;
          -webkit-mask-image: radial-gradient(circle at 50% 35%, #000, transparent 75%);
          mask-image: radial-gradient(circle at 50% 35%, #000, transparent 75%);
        }
        .unavailable { opacity: .5; }
        .knob {
          position: relative;
          display: grid;
          flex: none;
          width: 44px;
          height: 44px;
          place-items: center;
          border-radius: 50%;
          background: rgba(251, 243, 226, .08);
          box-shadow: inset 0 0 0 1.5px rgba(251, 243, 226, .18);
        }
        .on .knob { background: #fffaf0; box-shadow: 0 2px 8px rgba(60, 40, 20, .2); }
        svg { width: 34px; height: 34px; fill: rgba(251, 243, 226, .68); stroke: rgba(251, 243, 226, .68); }
        .on svg { fill: #123f3c; stroke: #123f3c; }
        .glass, .guard, .plate { fill: none; stroke-width: 2; }
        .on .glass { fill: color-mix(in srgb, var(--glow) 45%, #fff6d8); stroke: #ef7656; }
        .guard { stroke-width: 1.6; stroke-dasharray: 2.2 2.6; }
        .slots { stroke-width: 2.6; stroke-linecap: round; }
        .blades { transform-origin: 24px 24px; }
        .on.fan .blades { animation: spin 1.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .name {
          position: relative;
          display: -webkit-box;
          max-width: 100%;
          overflow: hidden;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: .12em;
          line-height: 1.25;
          text-align: center;
          text-transform: uppercase;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .countdown { margin-top: -4px; font-size: 9px; font-weight: 700; letter-spacing: .1em; font-variant-numeric: tabular-nums; text-transform: uppercase; opacity: .72; }
      </style>
      <ha-card class="${kind}${on ? " on" : ""}${!stateObj || stateObj.state === "unavailable" ? " unavailable" : ""}" style="${glow}"
        role="button" tabindex="0" aria-pressed="${on}" aria-label="${escapeHtml(`${name}, ${stateObj?.state ?? "unknown"}`)}">
        <div class="knob"><svg viewBox="0 0 48 48" aria-hidden="true">${ICONS[kind] || ICONS.plug}</svg></div>
        <span class="name">${escapeHtml(name)}</span>
        ${countdown ? `<span class="countdown">${countdown}</span>` : ""}
      </ha-card>`;

    // Tick the countdown each second, touching only its text so the fan keeps spinning.
    clearInterval(this._tick);
    if (this._timer?.state === "active") {
      this._tick = setInterval(() => {
        const el = this.shadowRoot.querySelector(".countdown");
        if (el) el.textContent = this._countdown();
      }, 1000);
    }
  }
}

if (globalThis.customElements && !customElements.get("kennedyish-button-card")) {
  customElements.define("kennedyish-button-card", KennedyishButtonCard);
  (window.customCards ||= []).push({ type: "kennedyish-button-card", name: "Kennedyish Button", description: "A small square button in the Kennedyish Weather style." });
  console.info(`%c KENNEDYISH-BUTTON-CARD %c v${CARD_VERSION} `, "color: white; background: #92530e; font-weight: 700;", "color: #92530e; background: #fffbf2;");
}
