// Captures the README images from the demo pages with headless Chrome.
// Start `npm run serve` first, then run `npm run screenshots`.
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://127.0.0.1:4174/demo";
const OUT = new URL("../images/", import.meta.url);
const PORT = 9333;

// The card on skies.html whose caption matches `label`; `sky` crops to the sky band.
const skiesCard = (label, sky = false) => `(() => {
  const figure = [...document.querySelectorAll("figure")].find((f) => f.querySelector("figcaption span").textContent === ${JSON.stringify(label)});
  const card = figure.querySelector("kennedyish-weather-card");
  return ${sky ? 'card.shadowRoot.querySelector(".sky")' : "card"};
})()`;
const stagingCard = `document.querySelector("kennedyish-weather-card")`;
const staging = (hash) => `${BASE}/staging.html#time=780&condition=sunny&temp=72&rain=0&wind=0&pm25=6&chance=0&amount=0&alert=none&width=500&${hash}`;

const SHOTS = [
  ["sunny.png", `${BASE}/skies.html`, skiesCard("Sunny")],
  ["rainy.png", `${BASE}/skies.html`, skiesCard("Rainy")],
  ["clear-night.png", `${BASE}/skies.html`, skiesCard("Clear night")],
  ...[
    ["golden-hour", "Golden hour"], ["first-light", "First light"], ["partly-cloudy", "Partly cloudy"],
    ["fog", "Fog"], ["thunderstorms", "Thunderstorms"], ["pouring", "Pouring"],
    ["snowy", "Snowy"], ["windy", "Windy"], ["smoky", "Smoky"],
  ].map(([file, label]) => [`sky-${file}.png`, `${BASE}/skies.html`, skiesCard(label, true)]),
  ["alert.png", staging("alert=heat&date=2026-08-14"), stagingCard],
  ["celebration.png", staging("date=2026-09-22&condition=partlycloudy"), stagingCard],
];

const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${await mkdtemp(join(tmpdir(), "kwc-"))}`,
  "--hide-scrollbars", "--no-first-run", "about:blank",
]);
try {
  let target;
  for (let tries = 0; !target && tries < 50; tries++) {
    await new Promise((done) => setTimeout(done, 200));
    target = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).then((list) => list.find((t) => t.type === "page")).catch(() => null);
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener("open", done, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    pending.get(message.id)?.(message);
  });
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      pending.set(++id, (message) => (message.error ? fail(new Error(message.error.message)) : done(message.result)));
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

  await send("Emulation.setDeviceMetricsOverride", { width: 1700, height: 2400, deviceScaleFactor: 2, mobile: false });
  // Transparent page, so the card's rounded corners suit light and dark READMEs alike.
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  for (const [file, url, element] of SHOTS) {
    await send("Page.navigate", { url: "about:blank" });
    await send("Page.navigate", { url });
    // Let fonts load, the forecast arrive, and the sky fade in.
    await new Promise((done) => setTimeout(done, 2500));
    const rect = await evaluate(`(() => { document.documentElement.style.background = document.body.style.background = "transparent"; const el = ${element}; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; })()`);
    await new Promise((done) => setTimeout(done, 300));
    const { data } = await send("Page.captureScreenshot", { format: "png", clip: { ...rect, scale: 1 }, captureBeyondViewport: true });
    await writeFile(new URL(file, OUT), Buffer.from(data, "base64"));
    console.log(`images/${file}`);
  }
  socket.close();
} finally {
  chrome.kill();
}
