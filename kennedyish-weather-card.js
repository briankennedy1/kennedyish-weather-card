const CARD_VERSION = "4.1.2";
const FEATURE_FORECAST_DAILY = 1;
const FEATURE_FORECAST_HOURLY = 2;

// ── Sun ────────────────────────────────────────────────────────────────────
// Solar times after the NOAA/SunCalc formulas.

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const J0 = 0.0009;
const OBLIQUITY = RAD * 23.4397;
const SUNRISE_ANGLE = RAD * -0.833;

const toJulian = (date) => date.valueOf() / DAY_MS - 0.5 + J1970;
const fromJulian = (julian) => new Date((julian + 0.5 - J1970) * DAY_MS);
const toDays = (date) => toJulian(date) - J2000;
const solarMeanAnomaly = (days) => RAD * (357.5291 + 0.98560028 * days);
const eclipticLongitude = (meanAnomaly) =>
  meanAnomaly +
  RAD * 1.9148 * Math.sin(meanAnomaly) +
  RAD * 0.02 * Math.sin(2 * meanAnomaly) +
  RAD * 0.0003 * Math.sin(3 * meanAnomaly) +
  RAD * 102.9372 +
  Math.PI;
const declination = (longitude) => Math.asin(Math.sin(longitude) * Math.sin(OBLIQUITY));
const julianCycle = (days, longitudeWest) => Math.round(days - J0 - longitudeWest / (2 * Math.PI));
const approxTransit = (hourAngle, longitudeWest, cycle) => J0 + (hourAngle + longitudeWest) / (2 * Math.PI) + cycle;
const solarTransitJulian = (transit, meanAnomaly, longitude) =>
  J2000 + transit + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * longitude);
const hourAngle = (altitude, latitude, declinationValue) =>
  Math.acos(
    (Math.sin(altitude) - Math.sin(latitude) * Math.sin(declinationValue)) /
      (Math.cos(latitude) * Math.cos(declinationValue)),
  );

/** Calculate sunrise, solar noon, and sunset for a coordinate and date. */
export function getSolarTimes(date, latitude, longitude) {
  const longitudeWest = RAD * -longitude;
  const latitudeRadians = RAD * latitude;
  const days = toDays(date);
  const cycle = julianCycle(days, longitudeWest);
  const approximateNoon = approxTransit(0, longitudeWest, cycle);
  const meanAnomaly = solarMeanAnomaly(approximateNoon);
  const sunLongitude = eclipticLongitude(meanAnomaly);
  const sunDeclination = declination(sunLongitude);
  const solarNoonJulian = solarTransitJulian(approximateNoon, meanAnomaly, sunLongitude);
  const sunsetHourAngle = hourAngle(SUNRISE_ANGLE, latitudeRadians, sunDeclination);

  if (!Number.isFinite(sunsetHourAngle)) {
    return { sunrise: null, solarNoon: fromJulian(solarNoonJulian), sunset: null };
  }

  const sunsetJulian = solarTransitJulian(approxTransit(sunsetHourAngle, longitudeWest, cycle), meanAnomaly, sunLongitude);
  const sunriseJulian = solarNoonJulian - (sunsetJulian - solarNoonJulian);
  return {
    sunrise: fromJulian(sunriseJulian),
    solarNoon: fromJulian(solarNoonJulian),
    sunset: fromJulian(sunsetJulian),
  };
}

export function formatDaylightChange(changeSeconds) {
  const roundedSeconds = Math.round(changeSeconds);
  if (roundedSeconds === 0) return "No change in daylight";
  const absoluteSeconds = Math.abs(roundedSeconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const seconds = absoluteSeconds % 60;
  const sign = roundedSeconds > 0 ? "+" : "-";
  return `${sign}${minutes} min ${seconds} sec of daylight`;
}

/** Format a duration in seconds as "12h 04m". */
export function formatDuration(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

// ── Palette and sky ────────────────────────────────────────────────────────

const PALETTE = {
  background: "#123f3c",
  text_color: "#fbf3e2",
  muted_color: "rgba(251, 243, 226, .68)",
  accent_color: "#ef7656",
  sun_color: "#f2b53c",
};

const CONDITION_LABELS = {
  "clear-night": "Clear night",
  cloudy: "Cloudy",
  exceptional: "Exceptional",
  fog: "Fog",
  hail: "Hail",
  lightning: "Lightning",
  "lightning-rainy": "Thunderstorms",
  partlycloudy: "Partly cloudy",
  pouring: "Pouring",
  rainy: "Rainy",
  snowy: "Snowy",
  "snowy-rainy": "Sleet",
  sunny: "Sunny",
  windy: "Windy",
  "windy-variant": "Windy",
  // Conditions only a local station can tell apart.
  drizzle: "Drizzle",
  breezy: "Breezy",
  smoky: "Smoky",
};

// Sky bands by condition and phase of day: [top, bottom, text, muted, far hill, near hill].
const DAWN = ["#f4a88f", "#fcdcb8", "#3a2f3f", "rgba(58, 47, 63, .66)", "#eeb38f", "#e3977a"];
const DUSK = ["#e57a63", "#f7c585", "#3a2733", "rgba(58, 39, 51, .66)", "#e98f6a", "#d2715a"];
const NIGHT_TEXT = ["#fbf3e2", "rgba(251, 243, 226, .7)"];
const SKIES = {
  "clear-day": ["#5fbfb5", "#c8ecdf", "#123f3c", "rgba(18, 63, 60, .66)", "#9fd6bd", "#7fc3a6"],
  "clear-dawn": DAWN,
  "clear-dusk": DUSK,
  "clear-night": ["#15293b", "#2a4f63", ...NIGHT_TEXT, "#23445a", "#193446"],
  "partly-day": ["#6fbdb6", "#d3ebe0", "#123f3c", "rgba(18, 63, 60, .66)", "#a5d5c0", "#86c2a9"],
  "partly-dawn": DAWN,
  "partly-dusk": DUSK,
  "partly-night": ["#1a2d3f", "#314f62", ...NIGHT_TEXT, "#26455a", "#1c3547"],
  "cloudy-day": ["#98b3ac", "#dde5da", "#1c3936", "rgba(28, 57, 54, .68)", "#b6c9b6", "#9cb7a2"],
  "cloudy-night": ["#243440", "#3d5160", ...NIGHT_TEXT, "#2c4150", "#223543"],
  "rain-day": ["#6a8e9c", "#bfd3d3", "#18323b", "rgba(24, 50, 59, .7)", "#94b4a9", "#7b9e92"],
  "rain-night": ["#1b2b39", "#344a5b", ...NIGHT_TEXT, "#243b4c", "#1b2f3e"],
  "storm-day": ["#5d4c6c", "#a08694", "#fbf3e2", "rgba(251, 243, 226, .74)", "#7d6a78", "#6a5867"],
  "storm-night": ["#211a2f", "#43324a", ...NIGHT_TEXT, "#3a2c42", "#2c2134"],
  "snow-day": ["#a9cdd6", "#eef4ee", "#1f3d48", "rgba(31, 61, 72, .66)", "#f7f9f5", "#e2ebe9"],
  "snow-night": ["#27394f", "#4d6479", ...NIGHT_TEXT, "#6d8196", "#5a6e84"],
  // Wildfire smoke: an amber, sepia sky.
  "smoke-day": ["#b48a64", "#e7c59a", "#3b2618", "rgba(59, 38, 24, .68)", "#c9a57f", "#b08c68"],
  "smoke-night": ["#2e2420", "#51402f", ...NIGHT_TEXT, "#3d3027", "#30251e"],
};

// Forecast bar colors by temperature in °C, cobalt through turquoise, mustard, and coral.
const TEMPERATURE_COLORS = [
  [-20, "#3d5a8a"],
  [-6, "#6c9cc6"],
  [5, "#8ed6c8"],
  [14, "#cddc8e"],
  [21, "#f2b53c"],
  [28, "#ef7656"],
  [36, "#c8423a"],
];

export function getConditionGroup(condition) {
  switch (condition) {
    case "sunny":
    case "clear-night":
      return "clear";
    case "partlycloudy":
      return "partly";
    case "drizzle":
    case "rainy":
    case "pouring":
    case "hail":
    case "snowy-rainy":
      return "rain";
    case "lightning":
    case "lightning-rainy":
    case "exceptional":
      return "storm";
    case "snowy":
      return "snow";
    case "windy":
    case "breezy":
      return "clear";
    case "smoky":
      return "smoke";
    default:
      return "cloudy";
  }
}

/** Phase of day from the sun's progress between sunrise (0) and sunset (1). */
export function getSkyPhase(progress) {
  if (!(progress >= 0 && progress <= 1)) return "night";
  if (progress < 0.14) return "dawn";
  if (progress > 0.86) return "dusk";
  return "day";
}

export function convertTemperature(value, fromUnit, toUnit) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return number;
  return toUnit === "°F" ? (number * 9) / 5 + 32 : ((number - 32) * 5) / 9;
}

const hexToRgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

/** Interpolated bar color for a temperature in °C. */
export function temperatureColor(celsius) {
  const first = TEMPERATURE_COLORS[0];
  const last = TEMPERATURE_COLORS[TEMPERATURE_COLORS.length - 1];
  if (celsius <= first[0]) return first[1];
  if (celsius >= last[0]) return last[1];
  const index = TEMPERATURE_COLORS.findIndex(([temperature]) => temperature >= celsius);
  const [lowTemp, lowColor] = TEMPERATURE_COLORS[index - 1];
  const [highTemp, highColor] = TEMPERATURE_COLORS[index];
  const ratio = (celsius - lowTemp) / (highTemp - lowTemp);
  const low = hexToRgb(lowColor);
  const high = hexToRgb(highColor);
  return `rgb(${low.map((channel, i) => Math.round(channel + ratio * (high[i] - channel))).join(", ")})`;
}

// ── Formatting and forecasts ───────────────────────────────────────────────

function makeFormatter(locale, options) {
  const attempts = [
    [locale, options],
    [locale, { ...options, timeZone: undefined }],
    [undefined, { ...options, timeZone: undefined }],
  ];
  for (const [attemptLocale, attemptOptions] of attempts) {
    try {
      return new Intl.DateTimeFormat(attemptLocale, attemptOptions);
    } catch {
      // Invalid locale or time zone; try the next, looser formatter.
    }
  }
  return new Intl.DateTimeFormat();
}

/** A key naming the local day (or hour) a date falls in, for grouping forecasts. */
export function periodKey(date, timeZone, hourly = false) {
  return makeFormatter("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(hourly ? { hour: "2-digit", hourCycle: "h23" } : {}),
  }).format(date);
}

function mostCommon(values) {
  const counts = new Map();
  let best = values[0];
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
    if (counts.get(value) > counts.get(best)) best = value;
  }
  return best;
}

const isNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

/** Collapse forecast entries into one row per local day (or hour). */
export function mergeForecasts(forecasts, { hourly = false, timeZone, rows = 5 } = {}) {
  const groups = new Map();
  for (const forecast of forecasts || []) {
    const datetime = new Date(forecast.datetime);
    if (Number.isNaN(datetime.valueOf())) continue;
    const key = periodKey(datetime, timeZone, hourly);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...forecast, datetime });
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const highs = items.map((item) => item.temperature).filter(isNumber).map(Number);
      const lows = items.map((item) => item.templow ?? item.temperature).filter(isNumber).map(Number);
      const chances = items.map((item) => item.precipitation_probability).filter(isNumber).map(Number);
      const amounts = items.map((item) => item.precipitation).filter(isNumber).map(Number);
      const winds = items.map((item) => item.wind_speed).filter(isNumber).map(Number);
      const gusts = items.map((item) => item.wind_gust_speed).filter(isNumber).map(Number);
      return {
        key,
        datetime: items[0].datetime,
        condition: mostCommon(items.map((item) => item.condition)),
        is_daytime: items[0].is_daytime,
        temperature: highs.length ? Math.max(...highs) : null,
        templow: lows.length ? Math.min(...lows) : null,
        precipitation_probability: chances.length ? Math.max(...chances) : null,
        precipitation: amounts.length ? amounts.reduce((total, amount) => total + amount, 0) : null,
        wind_speed: winds.length ? Math.max(...winds) : null,
        wind_gust_speed: gusts.length ? Math.max(...gusts) : null,
      };
    })
    .sort((a, b) => a.datetime - b.datetime)
    .slice(0, rows);
}

// ── Weather station ────────────────────────────────────────────────────────

const DRY_CONDITIONS = ["sunny", "clear-night", "partlycloudy", "cloudy", "fog", "windy", "windy-variant"];
// A gauge ticking a hundredth or two an hour is drizzle; NWS calls rain heavy at 0.3 in/h.
const DRIZZLE_IN_PER_HOUR = 0.03;
const HEAVY_RAIN_IN_PER_HOUR = 0.3;
// Beaufort 4 ("moderate breeze") starts near 13 mph, Beaufort 5 ("fresh breeze") near 20.
const BREEZY_MPH = 12;
const WINDY_MPH = 20;
const WINDY_GUST_MPH = 30;
// Smoke shows once PM2.5 makes the air unhealthy for sensitive groups.
const SMOKY_AQI = 101;

const toInchesPerHour = ({ value, unit }) => (/mm/i.test(unit) ? value / 25.4 : value);
const toMph = ({ value, unit }) =>
  unit === "km/h" ? value / 1.609344 : unit === "m/s" ? value * 2.236936 : unit === "kn" ? value * 1.150779 : value;

/**
 * Refine the forecast service's current condition with what a local weather
 * station measures directly: rain in its gauge (in/h), wind (mph), and smoke
 * (AQI from PM2.5). The sky itself (clear, cloudy, fog, storms, snow) stays
 * the forecast service's call. Snow, sleet, and hail are left alone, since a
 * rain gauge does not measure them reliably.
 */
export function refineCondition(condition, { rainRate = null, windSpeed = null, windGust = null, aqi = null } = {}) {
  let result = condition;
  if (rainRate !== null) {
    if (rainRate > 0 && [...DRY_CONDITIONS, "rainy", "pouring"].includes(result)) {
      result = rainRate >= HEAVY_RAIN_IN_PER_HOUR ? "pouring" : rainRate <= DRIZZLE_IN_PER_HOUR ? "drizzle" : "rainy";
    } else if (rainRate === 0 && (result === "rainy" || result === "pouring")) {
      result = "cloudy";
    } else if (rainRate === 0 && result === "lightning-rainy") {
      result = "lightning";
    }
  }
  if (aqi !== null && aqi >= SMOKY_AQI && ["sunny", "clear-night", "partlycloudy", "cloudy"].includes(result)) return "smoky";
  if ((windSpeed ?? 0) >= WINDY_MPH || (windGust ?? 0) >= WINDY_GUST_MPH) {
    if (result === "sunny" || result === "clear-night") result = "windy";
    else if (result === "partlycloudy" || result === "cloudy") result = "windy-variant";
  } else if ((windSpeed ?? 0) >= BREEZY_MPH && (result === "sunny" || result === "clear-night")) {
    result = "breezy";
  }
  return result;
}

// ── Weather alerts ─────────────────────────────────────────────────────────

const ALERT_REFRESH_MS = 5 * 60_000;
const SEVERITY_RANK = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };

/** Alerts still in effect, one per event, most severe first. */
export function activeAlerts(alerts, now = new Date()) {
  const byEvent = new Map();
  for (const alert of alerts || []) {
    if (!alert || alert.status === "Test" || alert.messageType === "Cancel") continue;
    const ends = new Date(alert.ends || alert.expires);
    if (!(ends > now)) continue;
    const known = byEvent.get(alert.event);
    if (!known || new Date(known.ends || known.expires) < ends) byEvent.set(alert.event, alert);
  }
  return [...byEvent.values()].sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
}

/** Active National Weather Service alerts for a US location. */
export async function fetchWeatherAlerts(latitude, longitude, fetcher = fetch) {
  const response = await fetcher(
    `https://api.weather.gov/alerts/active?point=${latitude.toFixed(3)},${longitude.toFixed(3)}`,
    { headers: { Accept: "application/geo+json" } },
  );
  if (!response.ok) throw new Error(`Weather alerts failed (${response.status}).`);
  const data = await response.json();
  return activeAlerts((data.features || []).map((feature) => feature.properties));
}

// ── Air quality ────────────────────────────────────────────────────────────

// US EPA AQI breakpoints for PM2.5 in µg/m³ (2024 revision): [low, high, AQI low, AQI high].
const PM25_BREAKPOINTS = [
  [0, 9, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
];
// The air-quality bar appears from "Unhealthy for sensitive groups" up, unless configured otherwise.
const AQI_ALERT_DEFAULT = 101;
const AQI_NAMES = {
  good: "Good air quality",
  moderate: "Moderate air quality",
  sensitive: "Unhealthy for sensitive groups",
  unhealthy: "Unhealthy air",
  very: "Very unhealthy air",
  hazardous: "Hazardous air",
};
// EPA's guidance for each level, in brief.
const AQI_GUIDANCE = {
  good: "Air quality is satisfactory.",
  moderate: "Unusually sensitive people should consider reducing prolonged or heavy exertion outdoors.",
  sensitive: "People with heart or lung disease, older adults, children, and teens should reduce prolonged or heavy exertion outdoors.",
  unhealthy: "Everyone should reduce prolonged or heavy exertion outdoors. Sensitive groups should avoid it.",
  very: "Everyone should avoid prolonged or heavy exertion outdoors. Sensitive groups should stay indoors.",
  hazardous: "Everyone should avoid all physical activity outdoors and stay indoors with windows closed.",
};

/** US AQI for a PM2.5 concentration in µg/m³. */
export function aqiFromPm25(pm25) {
  if (!Number.isFinite(pm25) || pm25 < 0) return null;
  const concentration = Math.floor(pm25 * 10) / 10;
  const [low, high, aqiLow, aqiHigh] =
    PM25_BREAKPOINTS.find(([, top]) => concentration <= top) || PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1];
  return Math.min(500, Math.round(((aqiHigh - aqiLow) / (high - low)) * (Math.min(concentration, high) - low) + aqiLow));
}

// ── Seasons ────────────────────────────────────────────────────────────────

const SEASON_NAMES = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };
const SOUTHERN_SEASON = { winter: "summer", spring: "fall", summer: "winter", fall: "spring" };

/**
 * The March equinox, June solstice, September equinox, and December solstice
 * of a year, from Meeus's mean formulas (good to about an hour).
 */
export function getSeasonStarts(year) {
  const y = (year - 2000) / 1000;
  return [
    2451623.80984 + 365242.37404 * y + 0.05169 * y ** 2 - 0.00411 * y ** 3 - 0.00057 * y ** 4,
    2451716.56767 + 365241.62603 * y + 0.00325 * y ** 2 + 0.00888 * y ** 3 - 0.0003 * y ** 4,
    2451810.21715 + 365242.01767 * y - 0.11575 * y ** 2 + 0.00337 * y ** 3 + 0.00078 * y ** 4,
    2451900.05952 + 365242.74049 * y - 0.06223 * y ** 2 - 0.00823 * y ** 3 + 0.00032 * y ** 4,
  ].map(fromJulian);
}

/** A date's local calendar day as "YYYY-MM-DD", which sorts in date order. */
function isoDay(date, timeZone) {
  const parts = makeFormatter("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Every day of the local year with its season, and how long until the next season begins. */
export function getYearDays(now, { timeZone, southern = false } = {}) {
  const today = isoDay(now, timeZone);
  const year = Number(today.slice(0, 4));
  const starts = getSeasonStarts(year);
  const [march, june, september, december] = starts.map((date) => isoDay(date, timeZone));
  const nextMarch = isoDay(getSeasonStarts(year + 1)[0], timeZone);
  const hemisphere = (season) => (southern ? SOUTHERN_SEASON[season] : season);
  const seasonOf = (day) =>
    hemisphere(day < march || day >= december ? "winter" : day < june ? "spring" : day < september ? "summer" : "fall");

  const days = [];
  for (let time = Date.UTC(year, 0, 1); ; time += DAY_MS) {
    const day = new Date(time).toISOString().slice(0, 10);
    if (!day.startsWith(`${year}-`)) break;
    days.push({ day, season: seasonOf(day) });
  }
  const next = [march, june, september, december, nextMarch].find((day) => day > today);
  const began = [march, june, september, december].indexOf(today);
  return {
    today,
    days,
    // Weeks run Sunday to Saturday, so January 1 sits in its weekday's row.
    lead: new Date(Date.UTC(year, 0, 1)).getUTCDay(),
    season: seasonOf(today),
    nextSeason: next === nextMarch ? hemisphere("spring") : seasonOf(next),
    daysUntilNext: Math.round((Date.parse(next) - Date.parse(today)) / DAY_MS),
    // On the first day of a season: which season, the equinox or solstice, and its exact moment.
    seasonBegins:
      began < 0 ? null : { season: seasonOf(today), event: began % 2 === 0 ? "equinox" : "solstice", at: starts[began] },
  };
}

// ── NWS chance of precipitation ────────────────────────────────────────────

const RAIN_CHANCE_REFRESH_MS = 30 * 60_000;
// Forecast rows mention rain only above this chance, in percent.
const RAIN_CHANCE_MIN = 5;

/** An expected precipitation amount, like "0.25 in" or "6 mm". */
export function formatPrecipitation(amount, unit = "mm") {
  // Hundredths under an inch (0.25 in), tenths above (1.2 in), without trailing zeros.
  if (unit === "in") return `${Number(amount.toFixed(amount < 1 ? 2 : 1))} in`;
  return `${amount < 1 ? amount.toFixed(1) : Math.round(amount)} ${unit}`;
}

/** The NWS forecast's chance of precipitation for each 12-hour period at a US location. */
export async function fetchRainChances(latitude, longitude, fetcher = fetch) {
  const options = { headers: { Accept: "application/geo+json" } };
  const point = await fetcher(`https://api.weather.gov/points/${latitude.toFixed(3)},${longitude.toFixed(3)}`, options);
  if (!point.ok) throw new Error(`NWS point lookup failed (${point.status}).`);
  const forecastUrl = (await point.json()).properties?.forecast;
  if (!forecastUrl) throw new Error("No NWS forecast covers this location.");
  const forecast = await fetcher(forecastUrl, options);
  if (!forecast.ok) throw new Error(`NWS forecast failed (${forecast.status}).`);
  return ((await forecast.json()).properties?.periods || []).map((period) => ({
    start: period.startTime,
    end: period.endTime,
    chance: period.probabilityOfPrecipitation?.value ?? null,
  }));
}

/** The highest chance of precipitation still ahead on each local day, keyed like forecast rows. */
export function rainChanceByDay(periods, { timeZone, now = new Date() } = {}) {
  const days = new Map();
  for (const period of periods || []) {
    if (period.chance === null || !(new Date(period.end) > now)) continue;
    const start = new Date(period.start);
    const key = periodKey(start < now ? now : start, timeZone);
    days.set(key, Math.max(days.get(key) ?? 0, period.chance));
  }
  return days;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTimeParts(date, { timeZone, timeFormat, locale }) {
  const options = { hour: "numeric", minute: "2-digit", timeZone };
  if (timeFormat === "12") options.hour12 = true;
  if (timeFormat === "24") options.hour12 = false;
  const parts = makeFormatter(locale, options).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  return {
    time: `${value("hour")}:${value("minute")}`,
    period: value("dayPeriod").toUpperCase(),
  };
}

const formatNumber = (value, decimals = false) => {
  const rounded = decimals ? Math.round(value * 10) / 10 : Math.round(value);
  return String(Object.is(rounded, -0) ? 0 : rounded).replace("-", "−");
};

// ── Illustrations ──────────────────────────────────────────────────────────
// Flat, two-tone mid-century weather art in a 120 × 100 box.

// An eight-point, alternating-length "atomic" starburst.
const STARBURST = Array.from({ length: 16 }, (_, index) => {
  const angle = (index * Math.PI) / 8;
  const inner = 12.5;
  const outer = index % 2 ? 17 : 22;
  const point = (r) => `${(Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r).toFixed(2)}`;
  return `M${point(inner)} L${point(outer)}`;
}).join(" ");

const CLOUD_SHAPE =
  '<rect x="-28" y="-2" width="56" height="16" rx="8"></rect><circle cx="-13" cy="-2" r="12"></circle><circle cx="5" cy="-8" r="16"></circle><circle cx="20" cy="2" r="10"></circle>';

// A crescent: a disc of radius R with an offset disc bitten out of its upper right.
function crescentPath(R) {
  const cx = R * 0.52;
  const cy = -R * 0.34;
  const r = R * 0.84;
  const d = Math.hypot(cx, cy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const px = (a * cx) / d;
  const py = (a * cy) / d;
  const start = `${(px - (h * cy) / d).toFixed(2)} ${(py + (h * cx) / d).toFixed(2)}`;
  const end = `${(px + (h * cy) / d).toFixed(2)} ${(py - (h * cx) / d).toFixed(2)}`;
  return `M${start} A${R} ${R} 0 1 1 ${end} A${r.toFixed(2)} ${r.toFixed(2)} 0 0 0 ${start} Z`;
}

const sparklePath = (r) => {
  const k = r * 0.26;
  return `M0 ${-r} L${k} ${-k} L${r} 0 L${k} ${k} L0 ${r} L${-k} ${k} L${-r} 0 L${-k} ${-k} Z`;
};

const sun = (x, y, scale) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><circle class="sun-halo" r="17"></circle><g class="spin"><path class="sun-rays" d="${STARBURST}"></path></g><circle class="sun-disc" r="10"></circle></g>`;

const crescent = (x, y, r) => `<path class="moon" transform="translate(${x} ${y})" d="${crescentPath(r)}"></path>`;

const sparkle = (x, y, r, delay = 0) =>
  `<path class="sparkle" transform="translate(${x} ${y})" d="${sparklePath(r)}" style="--d: ${delay}s"></path>`;

function cloud(x, y, scale = 1, tone = "front") {
  const shape = (dx, dy, className) =>
    `<g class="${className}" transform="translate(${x + dx} ${y + dy}) scale(${scale})">${CLOUD_SHAPE}</g>`;
  if (tone === "back") return `<g class="drift slow">${shape(0, 0, "cloud-back")}</g>`;
  return `<g class="drift">${shape(3, 3, "cloud-shade")}${shape(0, 0, "cloud-body")}</g>`;
}

const drops = (points, length = 13) =>
  `<g class="drops">${points
    .map(([x, y], index) => `<line class="drop" x1="${x}" y1="${y}" x2="${x - length * 0.3}" y2="${y + length}" style="--d: ${(index * -0.37).toFixed(2)}s"></line>`)
    .join("")}</g>`;

const flakes = (points) =>
  points
    .map(([x, y], index) => {
      const arms = [0, 60, 120]
        .map((angle) => {
          const dx = (Math.cos((angle * Math.PI) / 180) * 5.5).toFixed(2);
          const dy = (Math.sin((angle * Math.PI) / 180) * 5.5).toFixed(2);
          return `M${-dx} ${-dy} L${dx} ${dy}`;
        })
        .join(" ");
      return `<g transform="translate(${x} ${y})"><path class="flake" d="${arms}" style="--d: ${(index * -0.9).toFixed(2)}s"></path></g>`;
    })
    .join("");

const hailstones = (points) =>
  points.map(([x, y], index) => `<circle class="hail" cx="${x}" cy="${y}" r="3.4" style="--d: ${(index * -0.3).toFixed(2)}s"></circle>`).join("");

const BOLT = '<path class="bolt" d="M65 50 L49 75 L60 75 L53 97 L76 66 L64.5 66 L71 50 Z"></path>';

const fog = (lines) =>
  `<g class="fog">${lines.map(([x1, x2, y]) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"></line>`).join("")}</g>`;

const BREEZE =
  '<g class="wind breeze"><path d="M18 46 H74 A9 9 0 1 0 65 37"></path><path d="M30 66 H86 A8 8 0 1 1 78 74"></path></g>';

const HAZE =
  '<g class="haze"><line x1="14" y1="40" x2="84" y2="40"></line><line x1="30" y1="54" x2="106" y2="54"></line><line x1="10" y1="68" x2="76" y2="68"></line><line x1="40" y1="82" x2="110" y2="82"></line></g>';

const WIND =
  '<g class="wind"><path d="M14 44 H70 A10 10 0 1 0 60 34"></path><path d="M22 60 H92 A9 9 0 1 1 83 69"></path><path d="M10 76 H56 A7 7 0 1 0 49 69"></path></g>';

const ALERT =
  `<g transform="translate(60 50) scale(1.7)"><circle class="alert-halo" r="17"></circle><path class="alert-rays" d="${STARBURST}"></path><circle class="alert-disc" r="10"></circle><path class="alert-mark" d="M0 -5.5 V1.5 M0 5 V5.2"></path></g>`;

/**
 * Weather art for a condition, without the sun or moon. `anchor` is where the
 * sun (or moon) belongs in the art, and `body` its scale in a standalone icon
 * (no body means the icon leaves it out).
 */
function conditionArt(kind, night) {
  switch (kind) {
    case "sunny":
      return { anchor: [60, 50], body: 1.75, art: "" };
    case "clear-night":
      return { anchor: [56, 50], body: 1.75, art: `${sparkle(94, 24, 6)}${sparkle(90, 72, 4, -1.3)}${sparkle(26, 20, 4, -2.1)}` };
    case "partlycloudy":
      return { anchor: [44, 36], body: 1.3, art: `${night ? sparkle(98, 18, 4.5) : ""}${cloud(70, 62, 1.15)}` };
    case "rainy":
      return { anchor: [38, 22], art: `${cloud(60, 38, 1.3)}${drops([[45, 64], [61, 68], [77, 64]])}` };
    case "pouring":
      return { anchor: [38, 20], art: `${cloud(60, 36, 1.3)}${drops([[36, 62], [49, 68], [62, 62], [75, 68], [88, 62]], 16)}` };
    case "snowy":
      return { anchor: [38, 20], art: `${cloud(60, 36, 1.3)}${flakes([[42, 70], [60, 84], [78, 70]])}` };
    case "snowy-rainy":
      return { anchor: [38, 20], art: `${cloud(60, 36, 1.3)}${drops([[44, 64], [80, 64]])}${flakes([[62, 78]])}` };
    case "hail":
      return { anchor: [38, 20], art: `${cloud(60, 36, 1.3)}${hailstones([[42, 68], [58, 80], [74, 68], [88, 82]])}` };
    case "lightning":
      return { anchor: [38, 20], art: `${cloud(60, 36, 1.3)}${BOLT}` };
    case "lightning-rainy":
      return { anchor: [38, 20], art: `${cloud(60, 36, 1.3)}${drops([[38, 62], [88, 62]])}${BOLT}` };
    case "fog":
      return { anchor: [40, 18], art: `${cloud(60, 32, 1.25)}${fog([[26, 84, 62], [38, 96, 73], [22, 76, 84]])}` };
    case "windy":
      return { anchor: [60, 20], art: WIND };
    case "breezy":
      return { anchor: [60, 20], art: BREEZE };
    case "drizzle":
      return { anchor: [38, 22], art: `${cloud(60, 38, 1.3)}<g class="drizzle">${drops([[42, 64], [54, 70], [66, 64], [78, 70]], 7)}</g>` };
    case "smoky":
      return { anchor: [58, 46], body: 1.35, art: HAZE };
    case "windy-variant":
      return { anchor: [60, 12], art: `${cloud(76, 26, 0.95)}<g transform="translate(0 10)">${WIND}</g>` };
    case "exceptional":
      return { anchor: [60, 50], art: ALERT };
    default:
      return { anchor: [34, 30], art: `${cloud(42, 38, 0.95, "back")}${cloud(66, 60, 1.2)}` };
  }
}

const normalizeCondition = (condition, night) => {
  if (night && condition === "sunny") return "clear-night";
  if (!night && condition === "clear-night") return "sunny";
  return condition;
};

/** A standalone condition icon as an inline SVG, used in the forecast rows. */
export function weatherIllustration(condition, { night = false } = {}) {
  const kind = normalizeCondition(condition, night);
  const { anchor, body, art } = conditionArt(kind, night);
  const [x, y] = anchor;
  const celestial = body ? (night ? crescent(x, y - 2, body * 14.3) : sun(x, y, body)) : "";
  return `<svg class="wx wx-${escapeHtml(kind)}" viewBox="0 0 120 100" aria-hidden="true" focusable="false">${celestial}${art}</svg>`;
}

// Confetti for the first day of a season, drifting down the sky (or twinkling, for summer).
const CONFETTI = [
  [4, 1, 0, 9, 20], [12, 0.8, -3.1, 11, -40], [20, 1.1, -6.2, 8.5, 70], [28, 0.9, -1.4, 10, -15],
  [36, 1.2, -7.5, 12, 45], [44, 0.8, -4.3, 9.5, -60], [52, 1, -2.2, 11.5, 30], [60, 1.1, -8.8, 8, -25],
  [68, 0.9, -5.1, 10.5, 55], [76, 1.2, -0.6, 12.5, -35], [84, 0.8, -6.9, 9, 10], [92, 1, -3.8, 11, -50],
];
const CONFETTI_SHAPES = {
  fall: ['<path d="M0 -7 C4.5 -4.5 5.5 2.5 0 7 C-5.5 2.5 -4.5 -4.5 0 -7 Z"></path><path class="vein" d="M0 -5 V8"></path>', ["#d9623b", "#f2b53c", "#ef7656", "#a4552e"]],
  spring: ['<path d="M0 -5.5 C3.2 -3.5 3.2 3.5 0 5.5 C-3.2 3.5 -3.2 -3.5 0 -5.5 Z"></path>', ["#f3b6c5", "#fbf3e2", "#f7d3dc", "#cfe3b5"]],
  summer: [`<path d="${sparklePath(6)}"></path>`, ["#f2b53c", "#fbf3e2", "#ffd98a", "#ef7656"]],
  winter: ['<path class="flake-arms" d="M-6 0 H6 M-3 -5.2 L3 5.2 M-3 5.2 L3 -5.2"></path>', ["#fbf3e2", "#cfe3ea", "#a9cdd6", "#ffffff"]],
};
function confetti(season) {
  const [shape, colors] = CONFETTI_SHAPES[season];
  return `<div class="confetti confetti-${season}" aria-hidden="true">${CONFETTI.map(
    ([left, size, delay, duration, spin], index) =>
      `<svg viewBox="-8 -8 16 16" style="left: ${left}%; --size: ${(14 * size).toFixed(1)}px; --d: ${delay}s; --dur: ${duration}s; --spin: ${spin}deg; color: ${colors[index % colors.length]}">${shape}</svg>`,
  ).join("")}</div>`;
}

const CELEBRATION_ICONS = {
  fall: '<path d="M12 3 C18 7 19 15 12 21 C5 15 6 7 12 3 Z"></path><path class="line" d="M12 7 V22"></path>',
  spring: '<circle cx="12" cy="7" r="4"></circle><circle cx="17" cy="12" r="4"></circle><circle cx="12" cy="17" r="4"></circle><circle cx="7" cy="12" r="4"></circle><circle class="center" cx="12" cy="12" r="2.6"></circle>',
  summer: `<circle cx="12" cy="12" r="5"></circle><path class="line" d="${STARBURST}" transform="translate(12 12) scale(.5)"></path>`,
  winter: '<path class="line" d="M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7 M9 3.5 L12 6 L15 3.5 M9 20.5 L12 18 L15 20.5"></path>',
};

// Rolling Mary Blair-style hills; stretched to the card width.
const HILLS_FAR = "M0 22 C50 8 110 2 170 14 C220 24 270 4 330 6 C360 7 385 12 400 16 V40 H0 Z";
const HILLS_NEAR = "M0 30 C40 22 90 20 140 28 C190 36 250 18 310 22 C350 25 380 30 400 28 V40 H0 Z";

// ── Sky scenes: halftone art for every condition ────────────────────────────
// Each condition gets a whole-sky scene laid out in real pixels for the sky's
// size, in two layers: one behind the hills and one in front of them. All of it
// moves in CSS, with delays offset by the sky's --t, so re-rendering never
// restarts a motion. Clouds never drift; light, rain, snow, and wind do.

const RAIN_KINDS = ["drizzle", "rainy", "pouring"];
// How long a new condition's sky takes to fade in.
const SCENE_FADE_MS = 1800;
const RAIN_INTENSITY = {
  drizzle: { density: 0.35, speed: 0.72, size: 0.72 },
  rainy: { density: 1, speed: 1, size: 1 },
  pouring: { density: 2.3, speed: 1.35, size: 1.18 },
  storm: { density: 1.4, speed: 1.25, size: 1.08 },
  sleet: { density: 0.45, speed: 0.9, size: 0.85 },
};
// Three depths of rain: far and faint, middle, and near and bold (px, px/s).
const RAIN_LAYERS = [
  { count: 50, length: 11, width: 0.8, alpha: 0.22, velocity: 360 },
  { count: 32, length: 19, width: 1.25, alpha: 0.42, velocity: 520 },
  { count: 20, length: 31, width: 2, alpha: 0.72, velocity: 740 },
];
const RAIN_SLANT = 0.3;

// Tones for each kind of sky: near clouds and their dots, far clouds and theirs,
// and `ink`, the rgb of rain, snow, wind, and light.
const HALFTONE = {
  day: { body: "#f1ede2", dot: "#6f8f9a", mist: "#c3d2d2", mistDot: "#aabfc2", ink: "251, 243, 226" },
  night: { body: "#b9c8d2", dot: "#5d7385", mist: "#43596a", mistDot: "#364b5c", ink: "205, 232, 236" },
  dawn: { body: "#fdeee0", dot: "#d68a79", mist: "#f5cdb6", mistDot: "#eaa993", ink: "255, 244, 230" },
  dusk: { body: "#fbe3cf", dot: "#bd6966", mist: "#efb495", mistDot: "#dd9178", ink: "255, 238, 218" },
  overcast: { body: "#f0f1ea", dot: "#7c938f", mist: "#c9d5cd", mistDot: "#b0c1b8", ink: "255, 251, 240" },
  storm: { body: "#e0d6e0", dot: "#5a4868", mist: "#a795ad", mistDot: "#8c7a97", ink: "242, 234, 244" },
  "storm-night": { body: "#9a8ba5", dot: "#2e2342", mist: "#4b3c59", mistDot: "#3a2d48", ink: "220, 210, 234" },
  snow: { body: "#fffdf7", dot: "#8fb0bd", mist: "#d9e7eb", mistDot: "#bed3da", ink: "255, 255, 255", edge: "63, 127, 143" },
  "snow-night": { body: "#d0dbe5", dot: "#62798f", mist: "#5c7288", mistDot: "#4c6278", ink: "236, 243, 248" },
  smoke: { body: "#f4e0c6", dot: "#ad7a55", mist: "#dcb893", mistDot: "#c89f79", ink: "250, 234, 212" },
  "smoke-night": { body: "#8b7360", dot: "#3f3026", mist: "#5a4738", mistDot: "#4a3a2e", ink: "236, 208, 182" },
};
// Ben-Day dots grow in four steps toward a cloud's underside.
const HALFTONE_DOTS = [0.5, 0.9, 1.3, 1.75];
const STAR_COLOR = "#fbe7b0";

function sceneTone(group, phase) {
  const night = phase === "night";
  if (group === "storm" || group === "snow" || group === "smoke") return HALFTONE[night ? `${group}-night` : group];
  if (group === "cloudy") return HALFTONE[night ? "night" : "overcast"];
  return HALFTONE[phase] || HALFTONE.day;
}

// Where the clouds sit in each kind of sky: [x as a share of the width, base
// above the bottom (px), width (px, or [share of the width, min, max]), puff
// height, seed, near].
const CLOUD_LAYOUTS = {
  rain: [[0.3, 44, [0.3, 104, 170], 22, 3, false], [0.48, 67, 46, 15, 11, false], [0.63, 40, [0.23, 84, 120], 44, 7, true], [0.87, 58, 56, 19, 5, true]],
  partly: [[0.2, 60, 54, 14, 14, false], [0.56, 42, [0.27, 96, 140], 30, 21, true], [0.83, 64, 62, 17, 9, false]],
  overcast: [
    [0.1, 58, 100, 18, 31, false], [0.38, 68, 112, 16, 33, false], [0.64, 62, 96, 20, 35, false], [0.92, 54, 92, 18, 37, false],
    [0.26, 36, [0.3, 104, 160], 30, 41, true], [0.74, 40, [0.27, 96, 150], 38, 43, true],
  ],
  storm: [[0.2, 72, 112, 18, 51, false], [0.82, 76, 118, 20, 53, false], [0.5, 62, [0.36, 130, 190], 28, 57, true], [0.95, 54, 54, 14, 59, true]],
  snow: [[0.22, 62, 118, 18, 61, false], [0.76, 68, 108, 16, 63, false], [0.5, 50, [0.3, 110, 160], 26, 67, true]],
  windy: [[0.36, 50, 88, 22, 71, true], [0.76, 64, 72, 16, 73, false]],
  fog: [[0.28, 78, 124, 14, 81, false], [0.76, 84, 104, 12, 83, false]],
};

/** A small seeded random, so each drop and cloud keeps its place from render to render. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A cumulus built from circles: seeded bumps on top, a belly of circles below a flat underside at y = 0. */
function cumulusCircles({ w, h, seed }) {
  const random = seeded(seed);
  const count = Math.max(2, Math.round(w / 24) + 1);
  const bumps = [];
  for (let i = 0; i < count; i += 1) {
    const along = (i + 0.5) / count;
    const r = (w / count) * 0.7 * (0.85 + random() * 0.45);
    const rise = h * (0.3 + 0.7 * Math.sin(Math.PI * along)) * (0.82 + random() * 0.36) + r * 0.6;
    bumps.push([-w / 2 + w * along, -rise + r, r]);
  }
  const belly = Math.max(9, w * 0.11);
  const circles = [...bumps];
  for (let x = -w / 2 + belly; x <= w / 2 - belly + 0.01; x += belly * 1.2) circles.push([x, 0, belly]);
  // A core through every bump's center, so neighbors never part.
  const core = [[-w / 2 + belly, 0], ...bumps.map(([x, y]) => [x, y]), [w / 2 - belly, 0]];
  return { circles, core, top: Math.min(...bumps.map(([, y, r]) => y - r)) };
}

const px = (value) => value.toFixed(1);
const secs = (value) => `${value.toFixed(2)}s`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// The top of the near hill, roughly, in sky pixels.
const groundY = (x, height) => height - 12 + 3.5 * Math.sin(x / 37) + 2 * Math.sin(x / 13);

/** A Ben-Day dot pattern: rows `step` apart, every other row shifted half a step. */
function dotPattern(id, color, r, step = 4) {
  const half = step / 2;
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"></circle>`;
  return `<pattern id="${id}" width="${step}" height="${step * 2}" patternUnits="userSpaceOnUse">${dot(half, half)}${dot(0, step + half)}${dot(step, step + half)}</pattern>`;
}

function placeClouds(s, layout) {
  return CLOUD_LAYOUTS[layout].map(([share, above, w, h, seed, front]) => ({
    x: s.width * share,
    y: s.height - above,
    w: Array.isArray(w) ? clamp(s.width * w[0], w[1], w[2]) : w,
    h,
    seed,
    front,
  }));
}

/** Halftone clouds of one depth. `inside(cloud, top)` adds light (a sweep, a flash) clipped to each. */
function cloudLayer(s, clouds, front, inside) {
  if (!s.uses.has("clouds")) {
    s.uses.add("clouds");
    s.defs.push(HALFTONE_DOTS.map((r, k) => dotPattern(`ht-front-${k}`, s.tone.dot, r) + dotPattern(`ht-back-${k}`, s.tone.mistDot, r)).join(""));
  }
  return clouds
    .map((cloud, index) => {
      if (cloud.front !== front) return "";
      const { circles, core, top } = cumulusCircles(cloud);
      const depth = front ? "front" : "back";
      const span = -top;
      // Each fill stops at y = 0, so the underside is flat.
      const bands = HALFTONE_DOTS.map((_, k) => {
        const from = top + span * (0.35 + (0.65 * k) / 4);
        const to = k === 3 ? 0 : top + span * (0.35 + (0.65 * (k + 1)) / 4);
        return `<rect x="${px(-cloud.w)}" y="${px(from)}" width="${px(cloud.w * 2)}" height="${px(to - from)}" fill="url(#ht-${depth}-${k})"></rect>`;
      }).join("");
      return `<g transform="translate(${px(cloud.x)} ${px(cloud.y)})"><clipPath id="sky-cloud-${index}">${circles
        .map(([x, y, r]) => `<circle cx="${px(x)}" cy="${px(y)}" r="${px(r)}"></circle>`)
        .join("")}<polygon points="${core.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}"></polygon></clipPath><g clip-path="url(#sky-cloud-${index})"><rect x="${px(-cloud.w)}" y="${px(top - 2)}" width="${px(cloud.w * 2)}" height="${px(-top + 2)}" fill="${front ? s.tone.body : s.tone.mist}"></rect>${bands}${inside ? inside(cloud, top) : ""}</g></g>`;
    })
    .join("");
}

// ── Sun, stars, and birds ──

/** A mid-century sunburst rising from behind the hills, its rays in halftone dots that swell toward the horizon. */
function sunburst(s, strength) {
  const { width, height, phase } = s;
  const cy = height + 26;
  const R = Math.hypot(width / 2 + 12, cy);
  const color = phase === "dawn" ? "#fff0da" : phase === "dusk" ? "#ffe4c2" : "#fffaf0";
  const rings = [[1, 0.55], [0.8, 0.85], [0.62, 1.15], [0.46, 1.5], [0.32, 1.9]];
  const wedges = Array.from({ length: 16 }, (_, index) => {
    const start = (index * Math.PI) / 8;
    const end = start + Math.PI / 16;
    const point = (angle) => `${px(Math.cos(angle) * R * 1.1)} ${px(Math.sin(angle) * R * 1.1)}`;
    return `M0 0 L${point(start)} L${point(end)} Z`;
  }).join(" ");
  s.defs.push(
    rings.map(([, r], k) => dotPattern(`burst-${k}`, color, r, 5)).join(""),
    `<clipPath id="burst-rays"><path d="${wedges}"></path></clipPath>`,
    `<radialGradient id="burst-glow"><stop offset="0" stop-color="${color}" stop-opacity=".5"></stop><stop offset="1" stop-color="${color}" stop-opacity="0"></stop></radialGradient>`,
  );
  s.back.push(`<g class="sunburst" transform="translate(${px(width / 2)} ${px(cy)})" opacity="${strength}">
    <circle r="${px(R * 0.62)}" fill="url(#burst-glow)"></circle>
    <g class="burst"><g clip-path="url(#burst-rays)">${rings.map(([share], k) => `<circle r="${px(R * share)}" fill="url(#burst-${k})"></circle>`).join("")}</g></g>
  </g>`);
}

/** Four-point atomic glints that bloom and fade, one after another. */
function glints(s, spots, color) {
  return spots
    .map(
      ([x, y, r], index) =>
        `<g transform="translate(${px(s.width * x)} ${px(s.height * y)})"><path class="glint" d="${sparklePath(r)}" fill="${color}" style="--dur: ${secs(6.5 + index * 1.3)}; --d: ${secs(-index * 2.3)}"></path></g>`,
    )
    .join("");
}

/** Gulls gliding across, flapping now and then. */
function gulls(s, count, color) {
  const random = seeded(404);
  return Array.from({ length: count }, () => {
    const y = s.height - 44 - random() * 22;
    const duration = 44 + random() * 18;
    const size = 0.75 + random() * 0.45;
    const wing = (k) => px(k * size);
    return `<g transform="translate(0 ${px(y)})"><g class="glide" style="--dur: ${secs(duration)}; --d: ${secs(-random() * duration)}; --span: ${px(s.width + 40)}px"><g class="bob" style="--d: ${secs(-random() * 3.4)}"><path class="flap" d="M${wing(-7)} 0 Q${wing(-3.5)} ${wing(-4)} 0 0 Q${wing(3.5)} ${wing(-4)} ${wing(7)} 0" stroke="${color}" style="--d: ${secs(-random() * 2.6)}"></path></g></g></g>`;
  }).join("");
}

/** A field of stars, some twinkling, above the hills. */
function starfield(s, count, seed = 9) {
  const random = seeded(seed);
  const stars = [];
  for (let k = 0; k < count; k += 1) {
    const x = random() * s.width;
    const y = random() * (s.height - 30);
    const r = 0.45 + random() ** 2 * 1.1;
    const twinkle = k % 3 === 0;
    const look = twinkle
      ? `class="star twinkle" style="--dur: ${secs(3 + random() * 4)}; --d: ${secs(-random() * 6)}"`
      : `class="star" opacity="${(0.35 + random() * 0.5).toFixed(2)}"`;
    stars.push(`<circle ${look} cx="${px(x)}" cy="${px(y)}" r="${r.toFixed(2)}"></circle>`);
  }
  return `<g fill="${STAR_COLOR}">${stars.join("")}</g>`;
}

/** Bright four-point stars that breathe. */
function brightStars(s, spots) {
  return spots
    .map(
      ([x, y, r], index) =>
        `<g transform="translate(${px(s.width * x)} ${px(s.height * y)})"><path class="pulse" d="${sparklePath(r)}" fill="${STAR_COLOR}" style="--dur: ${secs(3.2 + index * 0.7)}; --d: ${secs(-index * 1.1)}"></path></g>`,
    )
    .join("");
}

/** Now and then, a shooting star. */
function meteor(s) {
  s.defs.push(`<linearGradient id="meteor-tail" gradientUnits="userSpaceOnUse" x1="-46" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fffbe8" stop-opacity="0"></stop><stop offset="1" stop-color="#fffbe8" stop-opacity=".95"></stop></linearGradient>`);
  return `<g transform="translate(${px(s.width * 0.2)} ${px(s.height * 0.1)}) rotate(20)"><g class="meteor" style="--d: -4s"><line x1="-46" y1="0" x2="0" y2="0" stroke="url(#meteor-tail)" stroke-width="1.4" stroke-linecap="round"></line><circle r="1.3" fill="#fffbe8"></circle></g></g>`;
}

/** A satellite on its slow way across, blinking. Very 1957. */
function satellite(s) {
  return `<g transform="translate(0 ${px(s.height * 0.16)})"><g class="orbit" style="--dur: 130s; --d: -38s; --span: ${px(s.width + 20)}px"><circle class="blink" r="1.1" fill="#fffbe8"></circle></g></g>`;
}

/** A faint glow of dots along the horizon, growing toward the hills. */
function horizonGlow(s, color, strength) {
  const rows = [0.5, 0.8, 1.1, 1.45];
  s.defs.push(rows.map((r, k) => dotPattern(`glow-${k}`, color, r)).join(""));
  return `<g opacity="${strength}">${rows
    .map((_, k) => `<rect x="0" y="${px(s.height - 52 + k * 8)}" width="${s.width}" height="8" fill="url(#glow-${k})" opacity="${[0.15, 0.35, 0.6, 1][k]}"></rect>`)
    .join("")}</g>`;
}

// ── Rain, snow, hail, lightning ──

function rainShafts(s, clouds, I) {
  s.defs.push(
    `<linearGradient id="rain-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${s.tone.ink})" stop-opacity="${(0.1 * Math.min(1.7, I.density)).toFixed(2)}"></stop><stop offset="1" stop-color="rgb(${s.tone.ink})" stop-opacity="0"></stop></linearGradient>`,
  );
  return clouds
    .map((cloud, index) => {
      const w = cloud.w * 0.85;
      const shift = (s.height - cloud.y) * RAIN_SLANT;
      return `<polygon class="shaft" points="${px(cloud.x - w / 2)},${px(cloud.y - 2)} ${px(cloud.x + w / 2)},${px(cloud.y - 2)} ${px(cloud.x + w / 2 + shift)},${s.height} ${px(cloud.x - w / 2 + shift)},${s.height}" fill="url(#rain-shaft)" style="--d: ${(index * -1.7).toFixed(1)}s"></polygon>`;
    })
    .join("");
}

function streaks(s, index, I) {
  const layer = RAIN_LAYERS[index];
  const random = seeded(101 + index * 37);
  const count = Math.round(layer.count * I.density);
  const duration = (s.height + 30) / (layer.velocity * I.speed);
  const lines = [];
  for (let k = 0; k < count; k += 1) {
    const x = random() * (s.width + 70) - 60;
    const length = layer.length * (0.8 + random() * 0.45);
    lines.push(`<line x1="${px(x)}" y1="0" x2="${px(x - length * RAIN_SLANT)}" y2="${px(-length)}" style="--d: ${(-random() * duration).toFixed(2)}s"></line>`);
  }
  return `<g class="streaks" stroke="rgba(${s.tone.ink}, ${layer.alpha})" stroke-width="${(layer.width * I.size).toFixed(2)}" style="--dur: ${duration.toFixed(2)}s">${lines.join("")}</g>`;
}

/** Little crowns of spray on the hills. */
function splashes(s, I) {
  const random = seeded(777);
  const count = Math.round(14 * I.density);
  const crowns = [];
  for (let k = 0; k < count; k += 1) {
    const x = random() * s.width;
    const duration = 0.7 + random() * 0.9;
    crowns.push(`<g transform="translate(${px(x)} ${px(groundY(x, s.height))})"><path class="splash" d="M-1 0 L-3 -6 M1 0 L3 -6" style="--dur: ${duration.toFixed(2)}s; --d: ${(-random() * duration).toFixed(2)}s"></path></g>`);
  }
  return `<g class="splashes" stroke="rgba(${s.tone.ink}, .85)" stroke-width="1.2" stroke-linecap="round" fill="none">${crowns.join("")}</g>`;
}

function rain(s, I) {
  const clouds = placeClouds(s, "rain");
  s.back.push(rainShafts(s, clouds, I), cloudLayer(s, clouds, false), streaks(s, 0, I), streaks(s, 1, I), cloudLayer(s, clouds, true), streaks(s, 2, I));
  s.front.push(splashes(s, I));
}

// A six-armed atomic snowflake with little Vs along each arm.
function flakePath(r) {
  let d = "";
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3;
    const [c, n] = [Math.cos(angle), Math.sin(angle)];
    d += `M0 0 L${px(c * r)} ${px(n * r)} `;
    const [bx, by] = [c * r * 0.56, n * r * 0.56];
    for (const side of [-1, 1]) {
      const branch = angle + (side * Math.PI) / 4;
      d += `M${px(bx)} ${px(by)} L${px(bx + Math.cos(branch) * r * 0.34)} ${px(by + Math.sin(branch) * r * 0.34)} `;
    }
  }
  return d.trim();
}

/** Snow in three depths: far specks, middle dots, and near flakes that turn as they fall and sway. */
function snowfall(s, { far = 0, mid = 0, near = 0 }) {
  const ink = s.tone.ink;
  const edge = s.tone.edge;
  const random = seeded(606);
  const falling = (x, speed, shape) => {
    const duration = (s.height + 30) / speed;
    const sway = 1.8 + random() * 1.6;
    return `<g transform="translate(${px(x)} 0)"><g class="snowfall" style="--dur: ${secs(duration)}; --d: ${secs(-random() * duration)}"><g class="sway" style="--dur: ${secs(sway)}; --d: ${secs(-random() * sway)}; --sw: ${px(2 + random() * 4)}px">${shape}</g></g></g>`;
  };
  const dots = (count, speed, [r0, r1], alpha) =>
    Array.from({ length: count }, () => {
      const x = random() * (s.width + 20) - 10;
      const r = r0 + random() * (r1 - r0);
      return falling(x, speed * (0.85 + random() * 0.3), `<circle r="${r.toFixed(2)}" fill="rgba(${ink}, ${alpha})"${edge ? ` stroke="rgba(${edge}, .55)" stroke-width=".6"` : ""}></circle>`);
    }).join("");
  const flakes = Array.from({ length: near }, () => {
    const x = random() * (s.width + 20) - 10;
    const d = flakePath(3.6 + random() * 2);
    const spin = 6 + random() * 6;
    const shape = `<g class="turn" style="--dur: ${secs(spin)}; --d: ${secs(-random() * spin)}">${edge ? `<path d="${d}" stroke="rgba(${edge}, .5)" stroke-width="2.8"></path>` : ""}<path d="${d}" stroke="rgb(${ink})" stroke-width="1.3"></path></g>`;
    return falling(x, 30 + random() * 10, shape);
  }).join("");
  return {
    far: far ? `<g class="snow far">${dots(far, 15, [0.7, 1.1], 0.6)}</g>` : "",
    mid: mid ? `<g class="snow">${dots(mid, 23, [1.3, 2], 0.9)}</g>` : "",
    near: near ? `<g class="snow near" fill="none" stroke-linecap="round">${flakes}</g>` : "",
  };
}

/** Hailstones that fall hard, bounce once on the hills, and melt away. */
function hailfall(s, count) {
  const random = seeded(313);
  return `<g class="hailstones">${Array.from({ length: count }, () => {
    const x = random() * (s.width + 20) - 10;
    const ground = groundY(x, s.height) - 1;
    const duration = 1.2 + random() * 0.7;
    const r = 2 + random() * 1.5;
    return `<g transform="translate(${px(x)} 0)"><g class="hailstone" style="--dur: ${secs(duration)}; --d: ${secs(-random() * duration)}; --gy: ${px(ground)}px; --hx: ${px(ground * 0.12)}px"><circle r="${r.toFixed(2)}" fill="${s.tone.body}" stroke="${s.tone.dot}" stroke-width=".7"></circle><circle cx="${px(-r * 0.3)}" cy="${px(-r * 0.3)}" r="${(r * 0.35).toFixed(2)}" fill="#fff" opacity=".85"></circle></g></g>`;
  }).join("")}</g>`;
}

// A jagged bolt down to the ground, with a short fork off its second joint.
function boltPath(x, top, bottom, seed) {
  const random = seeded(seed);
  const steps = 6;
  const points = [[x, top]];
  for (let i = 1; i <= steps; i += 1) points.push([points[i - 1][0] + (random() - 0.45) * 16, top + ((bottom - top) * i) / steps]);
  const [fx, fy] = points[2];
  const side = random() < 0.5 ? -1 : 1;
  const fork = [[fx, fy], [fx + side * 8, fy + 8], [fx + side * 13, fy + 14], [fx + side * 21, fy + 18]];
  const line = (list) => `M${list.map(([px0, py0]) => `${px(px0)} ${px(py0)}`).join(" L")}`;
  return `${line(points)} ${line(fork)}`;
}

// Two bolts and a far-off flicker, each with its own rhythm, so storms never feel like a metronome.
const STRIKES = [
  { dur: 8, d: -1.2, bolt: 1, sky: 0.3, cloud: 0.8 },
  { dur: 11.3, d: -6.1, bolt: 0.75, sky: 0.18, cloud: 0.6 },
  { dur: 5.7, d: -3.4, cloud: 0.4 },
];

function storm(s, I) {
  const clouds = placeClouds(s, "storm");
  const flash = (strike, peak) => `style="--dur: ${strike.dur}s; --d: ${strike.d}s; --peak: ${peak}"`;
  const inside = (cloud, top) =>
    STRIKES.map((strike) => `<rect class="flash" x="${px(-cloud.w)}" y="${px(top - 2)}" width="${px(cloud.w * 2)}" height="${px(-top + 4)}" fill="#fff6e4" ${flash(strike, strike.cloud)}></rect>`).join("");
  const sky = STRIKES.filter((strike) => strike.sky)
    .map((strike) => `<rect class="flash" width="${s.width}" height="${s.height}" fill="#fff4dc" ${flash(strike, strike.sky)}></rect>`)
    .join("");
  const bolts = [
    [clouds[2].x - 12, clouds[2].y - 6, 17],
    [clouds[1].x + 16, clouds[1].y - 4, 23],
  ]
    .map(([x, top, seed], index) => {
      const d = boltPath(x, top, s.height - 10, seed);
      return `<g class="flash bolt-strike" ${flash(STRIKES[index], STRIKES[index].bolt)}><path d="${d}" stroke="#f2b53c" stroke-width="7" opacity=".35"></path><path d="${d}" stroke="#f2b53c" stroke-width="3.6"></path><path d="${d}" stroke="#fffbea" stroke-width="1.6"></path></g>`;
    })
    .join("");
  s.back.push(
    sky,
    I ? rainShafts(s, clouds, I) : "",
    cloudLayer(s, clouds, false, inside),
    I ? streaks(s, 0, I) + streaks(s, 1, I) : "",
    `<g fill="none" stroke-linejoin="round" stroke-linecap="round">${bolts}</g>`,
    cloudLayer(s, clouds, true, inside),
    I ? streaks(s, 2, I) : "",
  );
  if (I) s.front.push(splashes(s, I));
}

// ── Light through clouds, fog, wind, smoke ──

/** A slow band of light that passes across every cloud at once, as if the sun moved behind them. */
function cloudSweep(s, strength) {
  s.defs.push(`<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgb(${s.tone.ink})" stop-opacity="0"></stop><stop offset=".5" stop-color="rgb(${s.tone.ink})" stop-opacity="${strength}"></stop><stop offset="1" stop-color="rgb(${s.tone.ink})" stop-opacity="0"></stop></linearGradient>`);
  return (cloud, top) =>
    `<rect class="sweep" x="${px(-cloud.x - 150)}" y="${px(top - 2)}" width="130" height="${px(-top + 4)}" fill="url(#sweep)" style="--span: ${px(s.width + 170)}px"></rect>`;
}

/** Long pill-shaped banks of dots that slide along, seamlessly, forever. */
function bands(s, { y, h, seed, pattern, solid, alpha, speed, direction, lengths = [70, 200], gaps = [24, 94] }) {
  const random = seeded(seed);
  const pills = [];
  let x = 0;
  while (x < s.width) {
    const length = lengths[0] + random() * (lengths[1] - lengths[0]);
    pills.push([x, length]);
    x += length + gaps[0] + random() * (gaps[1] - gaps[0]);
  }
  const period = x;
  const shapes = (offset) => pills.map(([start, length]) => `<rect x="${px(start + offset)}" y="${px(y - h / 2)}" width="${px(length)}" height="${h}" rx="${h / 2}"></rect>`).join("");
  const duration = period / speed;
  const [from, to] = direction < 0 ? [0, -period] : [-period, 0];
  return `<g class="band" style="--dur: ${secs(duration)}; --d: ${secs(-random() * duration)}; --from: ${px(from)}px; --to: ${px(to)}px"><g fill="${solid}" opacity="${alpha}">${shapes(0)}${shapes(period)}</g><g fill="url(#${pattern})">${shapes(0)}${shapes(period)}</g></g>`;
}

/** Streamline gusts: long S-curves ending in a curl, drawn on and off as the wind blows through. */
function gusts(s, count, { seed, pace = 1, alpha = 0.7 }) {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, k) => {
    const y = s.height * (0.34 + (0.44 * k) / Math.max(1, count - 1)) + (random() - 0.5) * 8;
    const length = s.width * (0.38 + random() * 0.3);
    const x0 = random() * (s.width - length * 0.8) - 20;
    const amp = 8 + random() * 7;
    const curl = 7 + random() * 4;
    const x1 = x0 + length;
    const d = `M${px(x0)} ${px(y)} C${px(x0 + length * 0.35)} ${px(y - amp)} ${px(x0 + length * 0.65)} ${px(y + amp)} ${px(x1)} ${px(y)} a${px(curl)} ${px(curl)} 0 1 0 0 ${px(-2 * curl)} a${px(curl * 0.55)} ${px(curl * 0.55)} 0 0 0 ${px(-curl * 0.55)} ${px(curl * 0.55)}`;
    const duration = (3.4 + random() * 1.8) / pace;
    const delay = -random() * duration;
    const width = 1.8 + random() * 0.9;
    const line = (a, w, d0) => `<path class="gust" d="${d}" pathLength="100" stroke="rgba(${s.tone.ink}, ${a})" stroke-width="${w.toFixed(2)}" style="--dur: ${secs(duration)}; --d: ${secs(d0)}"></path>`;
    // A thinner companion line trails just below, a beat behind.
    return `${line(alpha, width, delay)}<g transform="translate(-10 5)">${line(alpha * 0.55, width * 0.6, delay - 0.14)}</g>`;
  }).join("");
}

/** Mid-century poplars on the hills, in halftone, leaning and swaying with the wind. */
function poplars(s, { lean, sway, pace }) {
  const [fill, dots, trunk] = s.night ? ["#2a4a5c", "#1b3342", "#1b3342"] : ["#6fae94", "#3f7f6a", "#3f6f5c"];
  s.defs.push(dotPattern("poplar-dots", dots, 0.8, 3));
  const trees = [[0.08, 1], [0.115, 0.78], [0.9, 0.92], [0.94, 0.7]];
  return `<g class="poplars">${trees
    .map(([share, size], index) => {
      const x = s.width * share;
      const h = 30 * size;
      const crown = `<ellipse cx="0" cy="${px(-h * 0.58)}" rx="${px(6 * size)}" ry="${px(h * 0.42)}"></ellipse>`;
      return `<g transform="translate(${px(x)} ${px(groundY(x, s.height) + 2)})"><g class="sway-tree" style="--dur: ${secs(pace * (1 + index * 0.13))}; --d: ${secs(-index * 0.37)}; --lean: ${lean}deg; --sway: ${sway}deg"><line y1="0" y2="${px(-h * 0.3)}" stroke="${trunk}" stroke-width="1.6" stroke-linecap="round"></line><g fill="${fill}">${crown}</g><g fill="url(#poplar-dots)">${crown}</g></g></g>`;
    })
    .join("")}</g>`;
}

/** A faint diagonal river of halftone stars. */
function milkyWay(s) {
  const { width, height } = s;
  s.defs.push(
    dotPattern("milky-dots", STAR_COLOR, 0.55, 3),
    `<linearGradient id="milky-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"></stop><stop offset=".5" stop-color="#fff" stop-opacity="1"></stop><stop offset="1" stop-color="#fff" stop-opacity="0"></stop></linearGradient>`,
    `<mask id="milky-mask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#milky-fade)"></rect></mask>`,
  );
  const length = Math.hypot(width, height) * 1.2;
  return `<g transform="translate(${px(width * 0.5)} ${px(height * 0.45)}) rotate(-18)" opacity=".22"><rect x="${px(-length / 2)}" y="-22" width="${px(length)}" height="44" fill="url(#milky-dots)" mask="url(#milky-mask)"></rect></g>`;
}

const LEAF = "M0 -5.5 C4 -2.7 4 2.7 0 5.5 C-4 2.7 -4 -2.7 0 -5.5 Z";

/** Leaves tumbling across on the wind. */
function leaves(s, count, { seed, pace = 1 }) {
  const random = seeded(seed);
  const colors = s.night ? ["#b7806a", "#c4a060", "#7f9a70"] : ["#ef7656", "#f2b53c", "#9cc47a", "#d9623b"];
  return `<g class="leaves">${Array.from({ length: count }, (_, k) => {
    const y = s.height * (0.36 + random() * 0.38);
    const duration = (5.5 + random() * 3.5) / pace;
    const flip = 1.1 + random() * 0.9;
    return `<g transform="translate(0 ${px(y)})"><g class="leaf-fly" style="--dur: ${secs(duration)}; --d: ${secs(-random() * duration)}; --span: ${px(s.width + 60)}px; --lift: ${px(-8 - random() * 26)}px"><g class="bob" style="--d: ${secs(-random() * 3.4)}"><path class="tumble" d="${LEAF}" fill="${colors[k % colors.length]}" style="--dur: ${secs(flip)}"></path></g></g></g>`;
  }).join("")}</g>`;
}

/** Specks of ash, rising and wandering. */
function ash(s, count) {
  const random = seeded(515);
  const color = s.night ? "236, 208, 182" : "92, 70, 56";
  return `<g class="ash">${Array.from({ length: count }, () => {
    const x = random() * s.width;
    const y = s.height * (0.45 + random() * 0.5);
    const duration = 9 + random() * 7;
    return `<g transform="translate(${px(x)} ${px(y)})"><circle class="fleck" r="${(0.6 + random() * 0.8).toFixed(2)}" fill="rgb(${color})" style="--dur: ${secs(duration)}; --d: ${secs(-random() * duration)}; --ax: ${px(20 + random() * 50)}px; --ay: ${px(-(30 + random() * 50))}px; --a: ${(0.35 + random() * 0.4).toFixed(2)}"></circle></g>`;
  }).join("")}</g>`;
}

// ── The scenes ──

const nightSky = (s, count, extras = true) => [
  s.phase === "night" && extras ? horizonGlow(s, STAR_COLOR, 0.3) : "",
  starfield(s, count),
  extras ? brightStars(s, [[0.44, 0.16, 3.2], [0.62, 0.42, 2.4], [0.3, 0.5, 2], [0.9, 0.62, 2.6]]) : "",
  meteor(s),
].join("");

const dayGlints = (s) => glints(s, [[0.47, 0.3, 5], [0.6, 0.55, 3.4], [0.33, 0.62, 3], [0.84, 0.64, 4]], "#fffaf0");
const gullColor = (s) => (s.phase === "dawn" || s.phase === "dusk" ? "rgba(70, 44, 52, .5)" : "rgba(18, 63, 60, .42)");

const SCENES = {
  sunny(s) {
    sunburst(s, s.phase === "day" ? 0.62 : 0.8);
    s.back.push(dayGlints(s), gulls(s, 2, gullColor(s)));
  },
  "clear-night"(s) {
    s.back.push(milkyWay(s), nightSky(s, 46), satellite(s));
  },
  partlycloudy(s) {
    const clouds = placeClouds(s, "partly");
    if (s.night) s.back.push(nightSky(s, 30, false));
    else {
      sunburst(s, s.phase === "day" ? 0.42 : 0.6);
      s.back.push(gulls(s, 1, gullColor(s)));
    }
    s.back.push(cloudLayer(s, clouds, false), cloudLayer(s, clouds, true));
  },
  cloudy(s) {
    const clouds = placeClouds(s, "overcast");
    const inside = cloudSweep(s, s.night ? 0.35 : 0.8);
    s.back.push(
      s.night ? starfield(s, 16, 12) : "",
      cloudLayer(s, clouds, false, inside),
      cloudLayer(s, clouds, true, inside),
    );
  },
  fog(s) {
    const clouds = placeClouds(s, "fog");
    const { body, mist } = s.tone;
    s.defs.push([0.5, 0.7, 0.9, 1.1].map((r, k) => dotPattern(`fog-${k}`, body, r)).join(""));
    s.defs.push(`<linearGradient id="fog-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body}" stop-opacity="0"></stop><stop offset="1" stop-color="${body}" stop-opacity=".32"></stop></linearGradient>`);
    s.back.push(
      cloudLayer(s, clouds, false),
      bands(s, { y: s.height - 62, h: 6, seed: 90, pattern: "fog-0", solid: mist, alpha: 0.12, speed: 4, direction: 1, lengths: [60, 150], gaps: [60, 160] }),
      bands(s, { y: s.height - 48, h: 8, seed: 91, pattern: "fog-0", solid: mist, alpha: 0.15, speed: 5, direction: -1 }),
      bands(s, { y: s.height - 36, h: 10, seed: 92, pattern: "fog-1", solid: mist, alpha: 0.18, speed: 7, direction: 1 }),
    );
    s.front.push(`<g class="fog-bank" opacity=".8">${[
      `<rect y="${s.height - 34}" width="${s.width}" height="34" fill="url(#fog-floor)"></rect>`,
      bands(s, { y: s.height - 23, h: 11, seed: 93, pattern: "fog-2", solid: body, alpha: 0.1, speed: 9, direction: -1 }),
      bands(s, { y: s.height - 10, h: 13, seed: 94, pattern: "fog-3", solid: body, alpha: 0.14, speed: 12, direction: 1 }),
    ].join("")}</g>`);
  },
  drizzle: (s) => rain(s, RAIN_INTENSITY.drizzle),
  rainy: (s) => rain(s, RAIN_INTENSITY.rainy),
  pouring: (s) => rain(s, RAIN_INTENSITY.pouring),
  "lightning-rainy": (s) => storm(s, RAIN_INTENSITY.storm),
  lightning: (s) => storm(s, null),
  snowy(s) {
    const clouds = placeClouds(s, "snow");
    const snow = snowfall(s, { far: 56, mid: 30, near: 12 });
    s.back.push(cloudLayer(s, clouds, false), snow.far, cloudLayer(s, clouds, true), snow.mid);
    s.front.push(snow.near);
  },
  "snowy-rainy"(s) {
    const I = RAIN_INTENSITY.sleet;
    const clouds = placeClouds(s, "rain");
    const snow = snowfall(s, { mid: 16, near: 5 });
    s.back.push(cloudLayer(s, clouds, false), streaks(s, 0, I), streaks(s, 1, I), cloudLayer(s, clouds, true), snow.mid, streaks(s, 2, I));
    s.front.push(snow.near, splashes(s, I));
  },
  hail(s) {
    const clouds = placeClouds(s, "rain");
    s.back.push(cloudLayer(s, clouds, false), streaks(s, 0, RAIN_INTENSITY.drizzle), cloudLayer(s, clouds, true));
    s.front.push(hailfall(s, 22));
  },
  windy(s) {
    if (s.night) s.back.push(starfield(s, 22, 14));
    s.back.push(gusts(s, 7, { seed: 201 }));
    s.front.push(poplars(s, { lean: 7, sway: 4, pace: 1.3 }), leaves(s, 6, { seed: 211 }));
  },
  "windy-variant"(s) {
    const clouds = placeClouds(s, "windy");
    if (s.night) s.back.push(starfield(s, 14, 15));
    s.back.push(cloudLayer(s, clouds, false), gusts(s, 5, { seed: 203 }), cloudLayer(s, clouds, true));
    s.front.push(poplars(s, { lean: 6, sway: 4, pace: 1.4 }), leaves(s, 4, { seed: 213 }));
  },
  breezy(s) {
    if (s.night) s.back.push(starfield(s, 34), meteor(s));
    else sunburst(s, s.phase === "day" ? 0.45 : 0.65);
    s.back.push(gusts(s, 3, { seed: 205, pace: 0.6, alpha: 0.55 }));
    s.front.push(poplars(s, { lean: 2.5, sway: 2.5, pace: 2.6 }), leaves(s, 2, { seed: 215, pace: 0.6 }));
  },
  smoky(s) {
    const { width, height, night } = s;
    const R = night ? 15 : 22;
    const [disc, dots] = night ? ["#d4764a", "#8e3f2c"] : ["#f0a35a", "#c65f36"];
    s.defs.push(
      dotPattern("sun-dots", dots, 1.05),
      [0.45, 0.6, 0.75, 0.9].map((r, k) => dotPattern(`haze-${k}`, s.tone.body, r)).join(""),
      `<radialGradient id="smoke-glow"><stop offset="0" stop-color="${disc}" stop-opacity=".45"></stop><stop offset="1" stop-color="${disc}" stop-opacity="0"></stop></radialGradient>`,
    );
    const haze = (y, h, seed, k, speed, direction) =>
      bands(s, { y: height - y, h, seed, pattern: `haze-${k}`, solid: s.tone.mist, alpha: 0.18, speed, direction, lengths: [150, 320], gaps: [50, 140] });
    s.back.push(
      haze(92, 8, 301, 0, 4, 1),
      `<g transform="translate(${px(width * 0.62)} ${px(height - 70)})"><circle class="smolder" r="${R * 2.6}" fill="url(#smoke-glow)"></circle><circle class="smoke-sun" r="${R}" fill="${disc}" opacity=".8"></circle><circle r="${R}" fill="url(#sun-dots)" opacity=".6"></circle></g>`,
      haze(66, 12, 302, 1, 5, -1),
      haze(40, 12, 304, 3, 7, 1),
    );
    s.front.push(ash(s, 18));
  },
  exceptional(s) {
    const clouds = placeClouds(s, "storm");
    s.back.push(
      cloudLayer(s, clouds, false),
      cloudLayer(s, clouds, true),
      `<g transform="translate(${px(s.width / 2)} ${px(s.height - 38)}) scale(.85)"><g class="pulse" style="--dur: 2.4s"><circle class="alert-halo" r="17"></circle><path class="alert-rays" d="${STARBURST}"></path><circle class="alert-disc" r="10"></circle><path class="alert-mark" d="M0 -5.5 V1.5 M0 5 V5.2"></path></g></g>`,
    );
  },
};

/**
 * The whole sky for a condition, as two SVG layers in real pixels: `back`,
 * behind the hills, and `front`, in front of them (empty when there's nothing
 * to put there). `phase` is day, dawn, dusk, or night.
 */
export function skyScene(kind, { width, height, group = getConditionGroup(kind), phase = "day" } = {}) {
  const s = { width, height, phase, night: phase === "night", group, tone: sceneTone(group, phase), defs: [], back: [], front: [], uses: new Set() };
  (Object.hasOwn(SCENES, kind) ? SCENES[kind] : SCENES.cloudy)(s);
  const fall = height + 30;
  const frame = (className, content) =>
    `<svg class="${className}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMax slice" style="--dx: ${px(fall * RAIN_SLANT)}px; --dy: ${fall}px; --fall: ${height + 16}px" aria-hidden="true">${content}</svg>`;
  const front = s.front.join("");
  return {
    back: frame(`sky-scene scene-${escapeHtml(kind)}`, `<defs>${s.defs.join("")}</defs>${s.back.join("")}`),
    front: front ? frame("sky-front", front) : "",
  };
}

// Jost is a free geometric face close to Futura, for devices without Futura.
function ensureFallbackFont() {
  const doc = globalThis.document;
  if (!doc?.head || doc.querySelector('link[href*="family=Jost"]')) return;
  const link = doc.createElement("link");
  link.id = "kennedyish-weather-card-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700&display=swap";
  doc.head.appendChild(link);
}

function aqiLevel(aqi) {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "moderate";
  if (aqi <= 150) return "sensitive";
  if (aqi <= 200) return "unhealthy";
  if (aqi <= 300) return "very";
  return "hazardous";
}

// ── Card ───────────────────────────────────────────────────────────────────

const HTMLElementBase = globalThis.HTMLElement || class {};

export class KennedyishWeatherCard extends HTMLElementBase {
  constructor() {
    super();
    this.attachShadow?.({ mode: "open" });
    const pointAt = (event) => {
      const bar = event.target.closest?.(".year-bar");
      if (bar) this._showYearDay(bar, event.clientX);
    };
    this.shadowRoot?.addEventListener("pointermove", pointAt);
    this.shadowRoot?.addEventListener("pointerdown", pointAt);
    this.shadowRoot?.addEventListener("pointerout", (event) => {
      const bar = event.target.closest?.(".year-bar");
      if (bar && !bar.contains(event.relatedTarget)) this._showYearDay(bar, null);
    });
    this.shadowRoot?.addEventListener("click", (event) => {
      if (event.target.closest?.(".alert-details") || event.target.closest?.(".year-bar")) return;
      const band = event.target.closest?.(".alert");
      if (band) {
        if (band.dataset.toggle === "aqi") this._aqiOpen = !this._aqiOpen;
        else this._alertsOpen = !this._alertsOpen;
        this._render();
      }
    });
    this._config = null;
    this._hass = null;
    this._forecast = null;
    this._forecastError = null;
    this._subscription = null;
    this._subscriptionKey = null;
    this._watched = null;
    this._timer = null;
    this._alerts = [];
    this._alertsKey = null;
    this._alertsOpen = false;
    this._aqiOpen = false;
    this._alertTimer = null;
    this._rainChances = null;
    this._rainKey = null;
    this._rainTimer = null;
    this._skySize = { width: 500, height: 162 };
    this._resizer = null;
  }

  static getConfigForm() {
    const sensor = { entity: { domain: "sensor" } };
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { domain: "weather" } } },
        { name: "title", selector: { text: {} } },
        {
          type: "grid",
          name: "",
          schema: [
            { name: "forecast_rows", selector: { number: { min: 1, mode: "box" } } },
            {
              name: "time_format",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "auto", label: "Automatic" },
                    { value: "12", label: "12-hour" },
                    { value: "24", label: "24-hour" },
                  ],
                },
              },
            },
            {
              name: "temperature_unit",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "auto", label: "Automatic" },
                    { value: "C", label: "Celsius (°C)" },
                    { value: "F", label: "Fahrenheit (°F)" },
                  ],
                },
              },
            },
            { name: "hourly_forecast", selector: { boolean: {} } },
            { name: "show_humidity", selector: { boolean: {} } },
            { name: "hide_clock", selector: { boolean: {} } },
            { name: "hide_date", selector: { boolean: {} } },
            { name: "hide_year", selector: { boolean: {} } },
            { name: "hide_celebrations", selector: { boolean: {} } },
            { name: "hide_today_section", selector: { boolean: {} } },
            { name: "hide_forecast_section", selector: { boolean: {} } },
          ],
        },
        {
          type: "expandable",
          name: "",
          title: "Sensors",
          schema: [
            { name: "temperature_sensor", selector: sensor },
            { name: "humidity_sensor", selector: sensor },
            { name: "apparent_sensor", selector: sensor },
            { name: "aqi_sensor", selector: sensor },
            { name: "rain_rate_sensor", selector: sensor },
            { name: "wind_speed_sensor", selector: sensor },
            { name: "wind_gust_sensor", selector: sensor },
            { name: "pm25_sensor", selector: sensor },
            { name: "aqi_alert_threshold", selector: { number: { min: 0, max: 500, mode: "box" } } },
          ],
        },
        { name: "show_alerts", selector: { boolean: {} } },
        { name: "show_rain_chance", selector: { boolean: {} } },
        {
          type: "expandable",
          name: "",
          title: "Location",
          schema: [
            {
              type: "grid",
              name: "",
              schema: [
                { name: "latitude", selector: { number: { min: -90, max: 90, step: "any", mode: "box" } } },
                { name: "longitude", selector: { number: { min: -180, max: 180, step: "any", mode: "box" } } },
              ],
            },
            { name: "time_zone", selector: { text: {} } },
          ],
        },
      ],
      computeLabel: (schema) =>
        ({
          entity: "Weather entity",
          title: "Title",
          forecast_rows: "Forecast rows",
          time_format: "Time format",
          temperature_unit: "Temperature unit",
          hourly_forecast: "Hourly forecast",
          show_humidity: "Show humidity",
          hide_clock: "Hide clock",
          hide_date: "Hide date",
          hide_year: "Hide year",
          hide_celebrations: "Skip season celebrations",
          hide_today_section: "Hide sky",
          hide_forecast_section: "Hide forecast",
          temperature_sensor: "Temperature sensor",
          humidity_sensor: "Humidity sensor",
          apparent_sensor: "Feels-like sensor",
          aqi_sensor: "Air quality index sensor",
          rain_rate_sensor: "Rain rate sensor",
          wind_speed_sensor: "Wind speed sensor",
          wind_gust_sensor: "Wind gust sensor",
          pm25_sensor: "PM2.5 sensor",
          aqi_alert_threshold: "Air quality alert from AQI",
          show_rain_chance: "Show chance of rain",
          show_alerts: "Show weather alerts",
          latitude: "Latitude",
          longitude: "Longitude",
          time_zone: "Time zone",
        })[schema.name] || schema.name,
      computeHelper: (schema) =>
        ({
          temperature_sensor: "Overrides the weather entity's current temperature",
          humidity_sensor: "Overrides the weather entity's humidity",
          rain_rate_sensor: "A station's rain gauge; corrects rain in the current condition",
          wind_speed_sensor: "A station's sustained wind; shows windy at 20 mph or more",
          show_alerts: "National Weather Service alerts (US only); on by default",
          pm25_sensor: "Fine particles in µg/m³; bad air shows as an alert bar",
          aqi_alert_threshold: "Defaults to 101, where air turns unhealthy for sensitive groups",
          show_rain_chance: "From the National Weather Service forecast (US only); on by default",
          latitude: "Leave blank to use Home Assistant's home location",
          time_zone: "An IANA name like Europe/London; leave blank to use Home Assistant's",
          forecast_rows: "As many as your weather entity forecasts",
        })[schema.name],
    };
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((id) => id.startsWith("weather."));
    return { entity: entity || "weather.forecast_home" };
  }

  set hass(value) {
    this._hass = value;
    this._subscribe();
    this._refreshAlerts();
    this._refreshRainChances();
    const watched = this._watchedStates();
    if (this._watched && watched.every((item, index) => item === this._watched[index])) return;
    this._watched = watched;
    this._render();
  }

  setConfig(config) {
    if (!config?.entity) throw new Error('Please set "entity" to a weather entity.');
    const rows = Number(config.forecast_rows ?? 5);
    if (!Number.isFinite(rows) || rows < 1) throw new Error("forecast_rows must be 1 or more.");
    const timeFormat = config.time_format === undefined || config.time_format === null ? "auto" : String(config.time_format);
    if (!["auto", "12", "24"].includes(timeFormat)) throw new Error('time_format must be "12" or "24".');
    const temperatureUnit = config.temperature_unit ? String(config.temperature_unit).replace("°", "").toUpperCase() : "AUTO";
    if (!["AUTO", "C", "F"].includes(temperatureUnit)) throw new Error('temperature_unit must be "C" or "F".');
    if (config.hide_today_section && config.hide_forecast_section) {
      throw new Error("hide_today_section and hide_forecast_section cannot both be enabled.");
    }
    const hasLatitude = isNumber(config.latitude);
    if (hasLatitude !== isNumber(config.longitude)) throw new Error("Set both latitude and longitude, or neither.");
    if (config.time_zone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: config.time_zone });
      } catch {
        throw new Error(`time_zone "${config.time_zone}" is not a time zone. Use a name like America/New_York.`);
      }
    }

    const previous = this._config;
    this._config = {
      ...config,
      forecast_rows: Math.round(rows),
      time_format: timeFormat,
      temperature_unit: temperatureUnit === "AUTO" ? "auto" : temperatureUnit,
    };
    if (previous && (previous.entity !== config.entity || Boolean(previous.hourly_forecast) !== Boolean(config.hourly_forecast))) {
      this._unsubscribe();
      this._forecast = null;
    }
    this._watched = null;
    this._subscribe();
    this._render();
  }

  connectedCallback() {
    ensureFallbackFont();
    this._scheduleTick();
    this._subscribe();
    clearInterval(this._alertTimer);
    this._alertTimer = setInterval(() => this._refreshAlerts(true), ALERT_REFRESH_MS);
    this._refreshAlerts();
    clearInterval(this._rainTimer);
    this._rainTimer = setInterval(() => this._refreshRainChances(true), RAIN_CHANCE_REFRESH_MS);
    this._refreshRainChances();
    if (globalThis.ResizeObserver && !this._resizer) this._resizer = new ResizeObserver(() => this._measureSky());
    this._resizer?.observe(this);
    this._render();
  }

  /** Re-render when the sky's size changes, so pixel-laid scenes fit it exactly. */
  _measureSky() {
    if (this._measuring) return;
    const sky = this.shadowRoot?.querySelector?.(".sky");
    if (!sky) return;
    const width = Math.round(sky.clientWidth);
    const height = Math.round(sky.clientHeight);
    if (!width || !height) return;
    if (Math.abs(width - this._skySize.width) > 2 || Math.abs(height - this._skySize.height) > 2) {
      this._skySize = { width, height };
      // One re-render at the true size; the scene doesn't change the sky's size, so it settles.
      this._measuring = true;
      try {
        this._render();
      } finally {
        this._measuring = false;
      }
    }
  }

  disconnectedCallback() {
    this._resizer?.disconnect();
    clearTimeout(this._timer);
    this._timer = null;
    clearInterval(this._alertTimer);
    this._alertTimer = null;
    clearInterval(this._rainTimer);
    this._rainTimer = null;
    this._unsubscribe();
  }

  _fetchRainChances(latitude, longitude) {
    return fetchRainChances(latitude, longitude);
  }

  /** Fetch NWS rain chances once per location, or again when `force`d by the refresh timer. */
  async _refreshRainChances(force = false) {
    if (!this._config || this._config.show_rain_chance === false || !this.isConnected) return;
    const country = this._hass?.config?.country;
    const location = this._hass ? this._location() : null;
    if (!location || (country && country !== "US")) return;
    const key = `${location.latitude},${location.longitude}`;
    if (!force && key === this._rainKey) return;
    this._rainKey = key;
    try {
      const periods = await this._fetchRainChances(location.latitude, location.longitude);
      if (key !== this._rainKey) return;
      this._rainChances = periods;
      this._render();
    } catch (error) {
      console.warn("kennedyish-weather-card: NWS rain chances unavailable", error);
    }
  }

  _fetchAlerts(latitude, longitude) {
    return fetchWeatherAlerts(latitude, longitude);
  }

  /** Fetch alerts once per location, or again when `force`d by the refresh timer. */
  async _refreshAlerts(force = false) {
    if (!this._config || this._config.show_alerts === false || !this.isConnected) return;
    const country = this._hass?.config?.country;
    const location = this._hass ? this._location() : null;
    if (!location || (country && country !== "US")) return;
    const key = `${location.latitude},${location.longitude}`;
    if (!force && key === this._alertsKey) return;
    this._alertsKey = key;
    try {
      const alerts = await this._fetchAlerts(location.latitude, location.longitude);
      if (key !== this._alertsKey) return;
      this._alerts = alerts;
      this._render();
    } catch (error) {
      // Keep showing the last alerts we had; a missed refresh is retried on the timer.
      console.warn("kennedyish-weather-card: weather alerts unavailable", error);
    }
  }

  getCardSize() {
    const sky = this._config?.hide_today_section ? 0 : 4;
    const forecast = this._config?.hide_forecast_section ? 1 : 1 + Math.ceil((this._config?.forecast_rows ?? 5) / 2);
    return sky + forecast;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _now() {
    return new Date();
  }

  // Re-render just after each minute boundary so the clock and sun stay exact.
  _scheduleTick() {
    clearTimeout(this._timer);
    const delay = 60_000 - (Date.now() % 60_000) + 250;
    this._timer = setTimeout(() => {
      this._render();
      this._scheduleTick();
    }, delay);
  }

  _watchedStates() {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return [];
    const states = hass.states || {};
    return [
      states[config.entity],
      states[config.temperature_sensor],
      states[config.humidity_sensor],
      states[config.apparent_sensor],
      states[config.aqi_sensor],
      states[config.rain_rate_sensor],
      states[config.wind_speed_sensor],
      states[config.wind_gust_sensor],
      states[config.pm25_sensor],
      hass.locale,
      hass.config?.unit_system?.temperature,
      hass.config?.time_zone,
      hass.config?.latitude,
      hass.config?.longitude,
    ];
  }

  _location() {
    const config = this._config;
    if (isNumber(config.latitude)) return { latitude: Number(config.latitude), longitude: Number(config.longitude) };
    const { latitude, longitude } = this._hass?.config || {};
    return isNumber(latitude) && isNumber(longitude) ? { latitude: Number(latitude), longitude: Number(longitude) } : null;
  }

  _forecastType(stateObj) {
    const features = Number(stateObj?.attributes?.supported_features) || 0;
    const daily = (features & FEATURE_FORECAST_DAILY) !== 0;
    const hourly = (features & FEATURE_FORECAST_HOURLY) !== 0;
    if (!daily && !hourly) return null;
    if (this._config.hourly_forecast) return hourly ? "hourly" : "unsupported";
    return daily ? "daily" : "hourly";
  }

  _subscribe() {
    const hass = this._hass;
    const config = this._config;
    if (!hass?.connection || !config || !this.isConnected) return;
    const stateObj = hass.states?.[config.entity];
    if (!stateObj) return;
    const type = this._forecastType(stateObj);
    const key = `${config.entity}|${type}`;
    if (key === this._subscriptionKey) return;

    this._unsubscribe();
    this._subscriptionKey = key;
    this._forecast = null;
    this._forecastError = type === "unsupported" ? `${config.entity} has no hourly forecast.` : null;
    if (!type || type === "unsupported") return;

    this._subscription = Promise.resolve(
      hass.connection.subscribeMessage(
        (event) => {
          if (this._subscriptionKey !== key) return;
          this._forecast = event?.forecast || [];
          this._render();
        },
        { type: "weather/subscribe_forecast", forecast_type: type, entity_id: config.entity },
      ),
    ).catch((error) => {
      console.error("kennedyish-weather-card: forecast subscription failed", error);
      if (this._subscriptionKey === key) {
        this._forecastError = "Forecast unavailable.";
        this._render();
      }
      return null;
    });
  }

  _unsubscribe() {
    const subscription = this._subscription;
    this._subscription = null;
    this._subscriptionKey = null;
    subscription?.then((unsubscribe) => unsubscribe?.()).catch(() => {});
  }

  _conditionLabel(condition) {
    const translated = this._hass?.localize?.(`component.weather.entity_component._.state.${condition}`);
    return translated || CONDITION_LABELS[condition] || String(condition || "Unknown").replaceAll("-", " ");
  }

  _sensorTemperature(entityId, displayUnit) {
    const stateObj = entityId ? this._hass.states?.[entityId] : null;
    const value = parseFloat(stateObj?.state);
    if (!Number.isFinite(value)) return null;
    return convertTemperature(value, stateObj.attributes?.unit_of_measurement || displayUnit, displayUnit);
  }

  _renderMessage(text, isError = false) {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `${this._styles()}
      <ha-card><div class="message${isError ? " error" : ""}" role="${isError ? "alert" : "status"}">${escapeHtml(text)}</div></ha-card>`;
  }

  /** Sunrise, sunset, and the sun's progress, or null without a location. */
  _solar(now) {
    const location = this._location();
    if (!location) return null;
    const { latitude, longitude } = location;
    const today = getSolarTimes(now, latitude, longitude);
    const yesterday = getSolarTimes(new Date(now.valueOf() - DAY_MS), latitude, longitude);
    const hasTimes = Boolean(today.sunrise && today.sunset && yesterday.sunrise && yesterday.sunset);
    const sunUp = this._hass.states?.["sun.sun"]?.state !== "below_horizon";
    const progress = today.sunrise && today.sunset ? (now - today.sunrise) / (today.sunset - today.sunrise) : sunUp ? 0.5 : -1;
    return {
      today,
      progress,
      isDay: progress >= 0 && progress <= 1,
      duration: hasTimes ? (today.sunset - today.sunrise) / 1000 : null,
      change: hasTimes ? (today.sunset - today.sunrise - (yesterday.sunset - yesterday.sunrise)) / 1000 : null,
    };
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const hass = this._hass;
    const config = this._config;
    if (!hass) {
      this._renderMessage("Loading weather…");
      return;
    }
    const stateObj = hass.states?.[config.entity];
    if (!stateObj) {
      this._renderMessage(`Weather entity ${config.entity} was not found.`, true);
      return;
    }

    const now = this._now();
    const attributes = stateObj.attributes || {};
    const displayUnit =
      config.temperature_unit === "auto" ? hass.config?.unit_system?.temperature || attributes.temperature_unit || "°C" : `°${config.temperature_unit}`;
    const entityUnit = attributes.temperature_unit || displayUnit;
    const locale = config.locale || hass.locale?.language || undefined;
    const timeZone = config.use_browser_time ? undefined : config.time_zone || hass.config?.time_zone;
    let timeFormat = config.time_format;
    if (timeFormat === "auto" && ["12", "24"].includes(hass.locale?.time_format)) timeFormat = hass.locale.time_format;
    const timeOptions = { timeZone, timeFormat, locale };

    const solar = this._solar(now);
    const night = solar ? !solar.isDay : hass.states?.["sun.sun"]?.state === "below_horizon";
    const reading = (entityId) => {
      const value = parseFloat(entityId ? hass.states?.[entityId]?.state : NaN);
      return Number.isFinite(value) ? { value, unit: hass.states[entityId].attributes?.unit_of_measurement || "" } : null;
    };
    const rain = reading(config.rain_rate_sensor);
    const wind = reading(config.wind_speed_sensor);
    const gust = reading(config.wind_gust_sensor);
    const aqiReading = config.aqi_sensor ? parseInt(hass.states?.[config.aqi_sensor]?.state, 10) : NaN;
    const pm25Reading = reading(config.pm25_sensor);
    // Weather providers can keep yesterday's clear-night state after sunrise.
    // Use the same local day/night calculation for the label and sky artwork.
    const condition = normalizeCondition(refineCondition(stateObj.state, {
      rainRate: rain ? toInchesPerHour(rain) : null,
      windSpeed: wind ? toMph(wind) : null,
      windGust: gust ? toMph(gust) : null,
      aqi: Number.isFinite(aqiReading) ? aqiReading : pm25Reading ? aqiFromPm25(pm25Reading.value) : null,
    }), night);
    const group = getConditionGroup(condition);
    const phase = solar ? getSkyPhase(solar.progress) : night ? "night" : "day";
    const skyPhase = group === "clear" || group === "partly" ? phase : night ? "night" : "day";
    const conditionLabel = condition === "sunny" && (phase === "dawn" || phase === "dusk")
      ? "Clear"
      : this._conditionLabel(condition);

    const current =
      this._sensorTemperature(config.temperature_sensor, displayUnit) ??
      convertTemperature(attributes.temperature, entityUnit, displayUnit);
    const apparent = this._sensorTemperature(config.apparent_sensor, displayUnit);
    const humiditySensor = config.humidity_sensor ? parseFloat(hass.states?.[config.humidity_sensor]?.state) : NaN;
    const humidity = Number.isFinite(humiditySensor) ? humiditySensor : isNumber(attributes.humidity) ? Number(attributes.humidity) : null;
    const aqiValue = config.aqi_sensor ? parseInt(hass.states?.[config.aqi_sensor]?.state, 10) : NaN;
    const aqi = Number.isFinite(aqiValue) ? aqiValue : null;
    const pm25 = reading(config.pm25_sensor);
    const airAqi = aqi ?? (pm25 ? aqiFromPm25(pm25.value) : null);
    const rainChances = config.show_rain_chance === false ? new Map() : rainChanceByDay(this._rainChances, { timeZone, now });
    const unitLetter = displayUnit.replace("°", "");

    const clock = getTimeParts(now, timeOptions);
    const dateText = makeFormatter(locale, { weekday: "long", month: "short", day: "numeric", timeZone }).format(now);

    const details = [];
    if (apparent !== null) details.push(`Feels ${formatNumber(apparent)}°`);
    if (config.show_humidity && humidity !== null) details.push(`${Math.round(humidity)}% humidity`);

    const changeText = solar?.change === null || !solar ? null : formatDaylightChange(solar.change);
    const sunrise = solar?.today.sunrise ? getTimeParts(solar.today.sunrise, timeOptions) : null;
    const sunset = solar?.today.sunset ? getTimeParts(solar.today.sunset, timeOptions) : null;
    const sunShare = solar ? Math.min(1, Math.max(0, solar.progress)) : 0;
    const sunProgressText = solar?.isDay ? `Sun ${Math.round(sunShare * 100)}% of the way from sunrise to sunset` : null;

    const aria = [
      `${conditionLabel}, ${current === null ? "temperature unavailable" : `${formatNumber(current, config.show_decimal)} degrees ${unitLetter}`}`,
      ...details,
      aqi !== null ? `Air quality index ${aqi}` : null,
      config.hide_clock ? null : `${clock.time} ${clock.period}`,
      config.hide_date ? null : dateText,
      sunrise ? `Sunrise ${sunrise.time} ${sunrise.period}` : null,
      sunset ? `Sunset ${sunset.time} ${sunset.period}` : null,
      solar?.duration ? `${formatDuration(solar.duration)} of daylight` : null,
      changeText,
      sunProgressText,
    ]
      .filter(Boolean)
      .join(". ");

    const location = this._location();
    const yearDays = getYearDays(now, { timeZone, southern: location ? location.latitude < 0 : false });
    // The first day of each season dresses the card up for it.
    const celebration = config.hide_celebrations ? null : yearDays.seasonBegins;

    const sky = config.hide_today_section
      ? ""
      : this._renderSky({ solar, condition, group, skyPhase, night, conditionLabel, current, details, aqi, clock, dateText, celebration });
    const forecast = config.hide_forecast_section
      ? ""
      : this._renderForecast({ stateObj, now, timeZone, timeFormat, locale, current, entityUnit, displayUnit, rainChances });
    const sunTime = (parts, label, side) => `
      <div class="sun-time ${side}">
        <div class="time-line"><strong class="time">${parts ? escapeHtml(parts.time) : "—"}</strong>${parts?.period ? `<span class="unit">${escapeHtml(parts.period)}</span>` : ""}</div>
        <span class="label">${label}</span>
      </div>`;
    // The sun's progress bar shows only while it is up; at night a divider takes its place.
    const sunTimes = solar
      ? `${solar.isDay
          ? `<div class="sun-bar" role="progressbar" aria-label="Daylight" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(sunShare * 100)}">
              <span class="sun-fill" style="width: ${(sunShare * 100).toFixed(1)}%"></span>
              <span class="sun-dot" style="left: ${(sunShare * 100).toFixed(1)}%"></span>
            </div>`
          : ""}
        <div class="sun-times">
          ${sunTime(sunrise, "Sunrise", "rise")}
          <div class="daylight-change"${changeText ? ` title="${escapeHtml(`${changeText} compared with yesterday · ${formatDuration(solar.duration)} total`)}"` : ""}>${changeText ? escapeHtml(changeText.replace("-", "−")) : ""}</div>
          ${sunTime(sunset, "Sunset", "set")}
        </div>`
      : "";

    const alerts = config.show_alerts === false ? [] : activeAlerts(this._alerts, now);
    const aqiThreshold = isNumber(config.aqi_alert_threshold) ? Number(config.aqi_alert_threshold) : AQI_ALERT_DEFAULT;
    const alertBand =
      (alerts.length ? this._renderAlerts(alerts, { now, timeZone, timeFormat, locale }) : "") +
      (airAqi !== null && airAqi >= aqiThreshold ? this._renderAirQuality(airAqi, pm25) : "");
    const year = config.hide_year ? "" : this._renderYear(yearDays, { dateText: config.hide_date ? "" : dateText });
    const banner = celebration ? this._renderCelebration(celebration, timeOptions) : "";

    this.shadowRoot.innerHTML = `${this._styles()}
      <ha-card aria-label="${escapeHtml(aria)}" class="${celebration ? `celebrate celebrate-${celebration.season}` : ""}">
        <div class="content">
          ${sky}
          ${alertBand || banner || forecast || sunTimes || year ? `<div class="footer">${alertBand}${banner}${forecast}${sunTimes ? `<div class="sun-block${solar.isDay ? "" : " divided"}">${sunTimes}</div>` : ""}${year}</div>` : ""}
        </div>
      </ha-card>`;
    // The first render guesses the sky size; reading it back forces layout, so
    // this works even in a background tab, where animation frames are paused.
    this._measureSky();
  }

  /** A ribbon for the first day of a season, with the moment of the equinox or solstice. */
  _renderCelebration({ season, event, at }, timeOptions) {
    const time = getTimeParts(at, timeOptions);
    const moment = `${event === "equinox" ? "Equinox" : "Solstice"} at ${time.time}${time.period ? ` ${time.period}` : ""}`;
    return `
      <div class="celebration celebration-${season}">
        <svg class="celebration-icon" viewBox="0 0 24 24" aria-hidden="true">${CELEBRATION_ICONS[season]}</svg>
        <span class="celebration-title">First day of ${SEASON_NAMES[season]}</span>
        <span class="celebration-note">${escapeHtml(moment)}</span>
      </div>`;
  }

  /** The year as one bar, colored by season; days gone by are muted. */
  _renderYear(year, { dateText }) {
    this._year = year;
    const total = year.days.length;
    const todayIndex = year.days.findIndex(({ day }) => day === year.today);
    // Runs of consecutive days that share a season and are all past (or all ahead).
    const segments = [];
    year.days.forEach(({ season }, index) => {
      const past = index < todayIndex;
      const last = segments[segments.length - 1];
      if (last && last.season === season && last.past === past) last.count += 1;
      else segments.push({ season, past, start: index, count: 1 });
    });
    const percent = (days) => ((days / total) * 100).toFixed(3);
    const next = `${year.daysUntilNext} ${year.daysUntilNext === 1 ? "day" : "days"} until ${SEASON_NAMES[year.nextSeason]}`;
    return `
      <div class="year">
        <div class="year-head">
          <span class="year-date">${escapeHtml(dateText)}</span>
          <span class="year-next" data-default="${escapeHtml(next)}">${escapeHtml(next)}</span>
        </div>
        <div class="year-bar" style="--days: ${total}" role="img" aria-label="${escapeHtml(`${SEASON_NAMES[year.season]}, ${Math.round((todayIndex / total) * 100)}% through the year. ${next}.`)}">
          ${segments
            .map((segment) => `<span class="year-season s-${segment.season}${segment.past ? " past" : ""}" style="left: ${percent(segment.start)}%; width: ${percent(segment.count)}%"></span>`)
            .join("")}
          <span class="year-ticks"></span>
          <span class="year-today" style="left: ${percent(todayIndex + 0.5)}%"></span>
          <span class="year-cursor" hidden></span>
        </div>
      </div>`;
  }

  /** Name the day under the pointer in the year's header, or restore the countdown (x null). */
  _showYearDay(bar, x) {
    const label = this.shadowRoot?.querySelector(".year-next");
    const cursor = bar.querySelector(".year-cursor");
    const year = this._year;
    if (!label || !cursor || !year) return;
    if (x === null) {
      label.textContent = label.dataset.default;
      cursor.hidden = true;
      return;
    }
    const rect = bar.getBoundingClientRect();
    const index = Math.min(year.days.length - 1, Math.max(0, Math.floor(((x - rect.left) / rect.width) * year.days.length)));
    const { day, season } = year.days[index];
    const date = makeFormatter(this._config.locale || this._hass?.locale?.language, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
    label.textContent = `${date} · ${SEASON_NAMES[season]}`;
    cursor.style.left = `${(((index + 0.5) / year.days.length) * 100).toFixed(3)}%`;
    cursor.hidden = false;
  }

  /** A PurpleAir-style bar, in the EPA's AQI colors, when the air turns bad. */
  _renderAirQuality(aqi, pm25) {
    const level = aqiLevel(aqi);
    const open = this._aqiOpen;
    const icon = '<svg class="alert-icon aqi-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8 H15 A3 3 0 1 0 12 5 M3 12 H20 M3 16 H14 A3 3 0 1 1 11 19"></path></svg>';
    // Kept out of the all-caps heading, where µg would read as MG.
    const source = pm25 ? `PM2.5 ${formatNumber(pm25.value, true)} µg/m³ at your weather station.` : "From your air quality sensor.";
    return `
      <div class="alerts air air-${level}${open ? " open" : ""}">
        <button type="button" class="alert" data-toggle="aqi" aria-expanded="${open}">
          ${icon}
          <span class="alert-event">${AQI_NAMES[level]}</span>
          <span class="alert-until">AQI ${aqi}</span>
        </button>
        ${open
          ? `<div class="alert-details"><section class="alert-detail">
              <h3>US AQI ${aqi}</h3>
              <p class="alert-instruction">${AQI_GUIDANCE[level]}</p>
              <p>${escapeHtml(source)}</p>
            </section></div>`
          : ""}
      </div>`;
  }

  _renderAlerts(alerts, { now, timeZone, timeFormat, locale }) {
    const [first] = alerts;
    const level = (alert) => (alert.severity || "unknown").toLowerCase();
    const endsText = (alert) => {
      const ends = new Date(alert.ends || alert.expires);
      const sameDay = periodKey(ends, timeZone) === periodKey(now, timeZone);
      const time = getTimeParts(ends, { timeZone, timeFormat, locale });
      const day = sameDay ? "" : `${makeFormatter(locale, { weekday: "short", timeZone }).format(ends)} `;
      return `until ${day}${time.time}${time.period ? ` ${time.period}` : ""}`;
    };
    const icon = '<svg class="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L22.5 21 H1.5 Z"></path><path class="alert-icon-mark" d="M12 9.5 V14.5 M12 17.6 V17.8"></path></svg>';
    const details = this._alertsOpen
      ? `<div class="alert-details">${alerts
          .map(
            (alert) => `<section class="alert-detail">
              <h3>${escapeHtml(alert.event)} · ${escapeHtml(endsText(alert))}</h3>
              ${alert.headline ? `<p class="alert-headline">${escapeHtml(alert.headline)}</p>` : ""}
              ${alert.description ? `<p>${escapeHtml(alert.description)}</p>` : ""}
              ${alert.instruction ? `<p class="alert-instruction">${escapeHtml(alert.instruction)}</p>` : ""}
            </section>`,
          )
          .join("")}</div>`
      : "";
    return `
      <div class="alerts alert-${level(first)}${this._alertsOpen ? " open" : ""}">
        <button type="button" class="alert" data-toggle="alerts" aria-expanded="${this._alertsOpen}">
          ${icon}
          <span class="alert-event">${escapeHtml(first.event)}</span>
          <span class="alert-until">${escapeHtml(endsText(first))}</span>
          ${alerts.length > 1 ? `<span class="alert-more">+${alerts.length - 1}</span>` : ""}
        </button>
        ${details}
      </div>`;
  }

  _renderSky({ solar, condition, group, skyPhase, night, conditionLabel, current, details, aqi, clock, dateText, celebration }) {
    const config = this._config;
    const reading = `
      <div class="reading">
        <div class="figure-line"><strong class="figure">${current === null ? "—" : `${escapeHtml(formatNumber(current, config.show_decimal))}<span class="deg">°</span>`}</strong></div>
        <span class="label">${escapeHtml(conditionLabel)}</span>
        ${details.length || aqi !== null
          ? `<span class="details">${details.map(escapeHtml).join('<span class="dot-sep">·</span>')}${aqi !== null ? `<span class="aqi aqi-${aqiLevel(aqi)}">AQI ${aqi}</span>` : ""}</span>`
          : ""}
      </div>`;

    const kind = normalizeCondition(condition, night);
    const scene = skyScene(kind, { ...this._skySize, group, phase: skyPhase });
    // When the weather changes, the new sky fades in rather than cutting over,
    // and a render partway through picks the fade up where it was.
    if (this._sceneKind !== undefined && this._sceneKind !== kind) this._sceneChangedAt = Date.now();
    this._sceneKind = kind;
    const sinceChange = Date.now() - (this._sceneChangedAt ?? -Infinity);
    const entering = sinceChange < SCENE_FADE_MS;
    return `
      <div class="sky sky-${group} sky-${skyPhase}${entering ? " sky-enter" : ""}" style="--t: ${((Date.now() / 1000) % 3600).toFixed(2)}${entering ? `; --enter: -${sinceChange}ms` : ""}">
        ${scene.back}
        ${config.title ? `<div class="title">${escapeHtml(config.title)}</div>` : ""}
        <div class="now-row">${reading}${config.hide_clock
          ? ""
          : `<div class="clock"><div class="figure-line"><strong class="figure">${escapeHtml(clock.time)}</strong>${clock.period ? `<span class="unit">${escapeHtml(clock.period)}</span>` : ""}</div></div>`}</div>
        <div class="scene"></div>
        <svg class="hills" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"><path class="hill-far" d="${HILLS_FAR}"></path><path class="hill-near" d="${HILLS_NEAR}"></path></svg>
        ${scene.front}
        ${celebration ? confetti(celebration.season) : ""}
      </div>`;
  }

  _renderForecast({ stateObj, now, timeZone, timeFormat, locale, current, entityUnit, displayUnit, rainChances = new Map() }) {
    const config = this._config;
    const hourly = Boolean(config.hourly_forecast);
    if (this._forecastError) return `<div class="footer-note">${escapeHtml(this._forecastError)}</div>`;

    const source = this._forecastType(stateObj) === null ? stateObj.attributes?.forecast : this._forecast;
    if (!source) return '<div class="footer-note">Loading forecast…</div>';

    const precipitationUnit = stateObj.attributes?.precipitation_unit || "mm";
    const windUnit = stateObj.attributes?.wind_speed_unit || "km/h";
    const mph = (value) => (value === null ? null : toMph({ value, unit: windUnit }));
    const rows = mergeForecasts(source, { hourly, timeZone, rows: config.forecast_rows })
      .map((row) => ({
        ...row,
        // Forecast services rarely call a day windy, so the forecast wind decides, as the station does for now.
        condition: refineCondition(row.condition, { windSpeed: mph(row.wind_speed), windGust: mph(row.wind_gust_speed) }),
        high: convertTemperature(row.temperature, entityUnit, displayUnit),
        low: convertTemperature(row.templow, entityUnit, displayUnit),
      }))
      .filter((row) => row.high !== null && row.low !== null);
    if (!rows.length) return '<div class="footer-note">No forecast available.</div>';

    // Hourly icons follow the sun: the provider's is_daytime, else sunrise and sunset at the card's location.
    const location = hourly ? this._location() : null;
    const isNight = (row) => {
      if (!hourly) return false;
      if (typeof row.is_daytime === "boolean") return !row.is_daytime;
      const { sunrise, sunset } = location ? getSolarTimes(row.datetime, location.latitude, location.longitude) : {};
      if (sunrise && sunset) return row.datetime < sunrise || row.datetime > sunset;
      return row.condition === "clear-night";
    };

    const nowKey = periodKey(now, timeZone, hourly);
    const currentRounded = current === null ? null : Math.round(current);
    for (const row of rows) {
      row.isNow = row.key === nowKey;
      row.lowShown = Math.round(row.isNow && currentRounded !== null ? Math.min(currentRounded, row.low) : row.low);
      row.highShown = Math.round(row.isNow && currentRounded !== null ? Math.max(currentRounded, row.high) : row.high);
    }
    const scaleMin = Math.min(...rows.map((row) => row.lowShown));
    const scaleMax = Math.max(...rows.map((row) => row.highShown));
    const span = scaleMax - scaleMin || 1;
    const toCelsius = (value) => convertTemperature(value, displayUnit, "°C");

    const relative = (() => {
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      } catch {
        return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
      }
    })();
    const weekday = makeFormatter(locale, { weekday: "short", timeZone });
    const hourFormat = makeFormatter(locale, { hour: "numeric", timeZone, ...(timeFormat === "auto" ? {} : { hour12: timeFormat === "12" }) });
    const label = (row) => {
      if (row.isNow) return hourly ? relative.format(0, "second") : relative.format(0, "day");
      return hourly ? hourFormat.format(row.datetime) : weekday.format(row.datetime);
    };

    const body = rows
      .map((row) => {
        const start = ((row.lowShown - scaleMin) / span) * 100;
        const end = ((row.highShown - scaleMin) / span) * 100;
        const gradient = [0, 0.25, 0.5, 0.75, 1]
          .map((t) => `${temperatureColor(toCelsius(row.lowShown + t * (row.highShown - row.lowShown)))} ${t * 100}%`)
          .join(", ");
        const dotPosition =
          row.isNow && currentRounded !== null
            ? row.highShown > row.lowShown
              ? ((currentRounded - row.lowShown) / (row.highShown - row.lowShown)) * 100
              : 50
            : null;
        const chance = row.precipitation_probability ?? (hourly ? null : rainChances.get(row.key) ?? null);
        const amount = row.precipitation > 0 ? row.precipitation : null;
        // Rain shows once its chance passes 5%, or, with no chance given, when rain is forecast at all.
        const showRain = chance !== null ? chance > RAIN_CHANCE_MIN : amount !== null;
        const amountText = amount === null ? "" : formatPrecipitation(amount, precipitationUnit);
        const rainText = showRain ? [chance !== null ? `${Math.round(chance)}% chance of rain` : "", amountText ? `${amountText} expected` : ""].filter(Boolean).join(", ") : "";
        const conditionLabel = this._conditionLabel(row.condition);
        return `
          <div class="row${row.isNow ? " now" : ""}" role="listitem" aria-label="${escapeHtml(`${label(row)}: ${conditionLabel}, low ${formatNumber(row.lowShown)}, high ${formatNumber(row.highShown)}${rainText ? `, ${rainText}` : ""}`)}">
            <span class="day">${escapeHtml(label(row))}</span>
            <span class="ficon" title="${escapeHtml(conditionLabel)}">${weatherIllustration(row.condition, { night: isNight(row) })}</span>
            <span class="rain">${showRain
              ? `${chance !== null ? `<span class="rain-chance">${Math.round(chance)}%</span>` : ""}${amountText ? `<span class="rain-amount">${escapeHtml(amountText)}</span>` : ""}`
              : ""}</span>
            <span class="low">${hourly && row.lowShown === row.highShown ? "" : `${formatNumber(row.lowShown)}°`}</span>
            <span class="bar"><span class="range" style="left: ${start.toFixed(1)}%; width: ${(end - start).toFixed(1)}%; background: linear-gradient(90deg, ${gradient});">${dotPosition === null ? "" : `<span class="now-dot" style="left: ${dotPosition.toFixed(1)}%"></span>`}</span></span>
            <span class="high">${formatNumber(row.highShown)}°</span>
          </div>`;
      })
      .join("");

    return `<div class="forecast" role="list">${body}</div>`;
  }

  _styles() {
    const color = (key) => escapeHtml(this._config?.[key] || PALETTE[key]);
    const background = color("background");
    const textColor = color("text_color");
    const mutedColor = color("muted_color");
    const accentColor = color("accent_color");
    const sunColor = color("sun_color");
    const skyRules = Object.entries(SKIES)
      .map(([name, [top, bottom, text, muted, far, near]]) => {
        const [group, phase] = name.split("-");
        return `.sky-${group}.sky-${phase} { --sky-top: ${top}; --sky-bottom: ${bottom}; --sky-text: ${text}; --sky-muted: ${muted}; --hill-far: ${far}; --hill-near: ${near}; }`;
      })
      .join("\n      ");
    return `<style>
      :host {
        display: block;
        height: 100%;
        container-type: inline-size;
        font-family: Futura, "Futura PT", Jost, "Avenir Next", "Century Gothic", sans-serif;
        --cloud: #fbf3e2;
        --cloud-shade: #c9bc9f;
        --drop: #8ed6c8;
        --moon: #fbe7b0;
      }
      ha-card {
        position: relative;
        display: block;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        color: ${textColor};
        --card-bg: ${background};
        background: var(--card-bg);
        border: none;
        border-radius: var(--ha-card-border-radius, 16px);
        box-shadow: 0 1px 2px rgba(60, 40, 20, .08), 0 8px 22px rgba(60, 40, 20, .12);
      }
      .content { display: flex; flex-direction: column; box-sizing: border-box; height: 100%; }
      ${skyRules}

      .sky {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        overflow: hidden;
        isolation: isolate;
        padding: 24px 28px 0;
        color: var(--sky-text);
        background: linear-gradient(180deg, var(--sky-top) 0%, var(--sky-bottom) 100%);
      }
      .sky-night { --cloud: #b7c6d1; --cloud-shade: #7a90a1; --drop: #9fd8cf; }
      .sky-rain.sky-day, .sky-cloudy.sky-day { --drop: #1e5f6b; }
      .sky-snow.sky-day { --cloud: #fffdf6; --cloud-shade: #b7cbd0; --drop: #3f7f8f; --flake: #4f8d9c; }
      .sky-storm { --cloud: #e2d8e0; --cloud-shade: #9a879d; --drop: #bfe6de; }
      .title { position: relative; z-index: 2; margin-bottom: 8px; color: var(--sky-muted); font-size: 10.5px; font-weight: 700; letter-spacing: .2em; line-height: 1; text-transform: uppercase; }

      .now-row { position: relative; z-index: 2; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .reading, .clock { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .clock { align-items: flex-end; text-align: right; white-space: nowrap; }
      .figure-line, .time-line { display: flex; align-items: baseline; gap: 4px; }
      .figure { font-size: clamp(40px, 10cqw, 56px); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.045em; line-height: .9; }
      .reading .figure { font-variant-numeric: proportional-nums; }
      .deg { margin-left: -.1em; }
      .unit { color: var(--sky-muted); font-size: 13px; font-weight: 700; letter-spacing: .04em; }
      /* By day the big temperature and time are cream, lifted off the pale sky by a shadow in its own dark tone. */
      .sky:not(.sky-night) .figure, .sky:not(.sky-night) .figure-line .unit, .sky:not(.sky-night) .reading .label {
        color: #fbf3e2;
        text-shadow: 0 1px 0 color-mix(in srgb, var(--sky-text) 45%, transparent), 0 2px 10px color-mix(in srgb, var(--sky-text) 30%, transparent);
      }
      .sky:not(.sky-night) .figure-line .unit { opacity: .85; }
      .sky-snow.sky-day .figure, .sky-snow.sky-day .figure-line .unit, .sky-snow.sky-day .reading .label {
        text-shadow: 0 1px 0 color-mix(in srgb, var(--sky-text) 70%, transparent), 0 2px 12px color-mix(in srgb, var(--sky-text) 55%, transparent);
      }
      .label, .details, .day, .footer-note, .daylight-change { font-size: 10.5px; font-weight: 700; letter-spacing: .2em; line-height: 1.15; text-transform: uppercase; }
      .label { color: var(--sky-muted); }
      /* The condition under the temperature takes the temperature's color, day and night. */
      .reading .label { overflow: hidden; color: var(--sky-text); text-overflow: ellipsis; white-space: nowrap; }
      .details { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; color: var(--sky-muted); font-size: 9px; letter-spacing: .16em; }
      .dot-sep { opacity: .7; }
      .aqi { padding: 2px 6px 1px; border-radius: 999px; color: #123f3c; letter-spacing: .12em; }
      .aqi-good { background: #8ed6c8; }
      .aqi-moderate { background: #f2d06b; }
      .aqi-sensitive { background: #f2b53c; }
      .aqi-unhealthy { background: #ef7656; }
      .aqi-very { background: #a4607f; color: #fbf3e2; }
      .aqi-hazardous { background: #7a2f3a; color: #fbf3e2; }

      .scene { height: 90px; margin-top: -6px; }
      .sky-scene, .sky-front { position: absolute; inset: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
      .sky-scene { z-index: 0; }
      .sky-front { z-index: 1; }
      /* Every motion picks up where the last render left it: --t is the sky's clock, --d each piece's own offset. */
      .sky-scene *, .sky-front * { --delay: calc(var(--t, 0) * -1s + var(--d, 0s)); }
      .streaks line { stroke-linecap: round; animation: stream var(--dur) linear var(--delay) infinite; }
      .shaft { animation: shimmer 5.6s ease-in-out var(--delay) infinite alternate; }
      .splash { opacity: 0; transform-box: fill-box; transform-origin: 50% 100%; animation: splash var(--dur) linear var(--delay) infinite; }
      .burst { animation: spin 240s linear var(--delay) infinite; }
      .glint { opacity: 0; animation: glint var(--dur) ease-in-out var(--delay) infinite; }
      .glide, .orbit { animation: glide var(--dur) linear var(--delay) infinite; }
      .bob { animation: bob 3.4s ease-in-out var(--delay) infinite alternate; }
      .flap { fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; animation: flap 2.6s ease-in-out var(--delay) infinite; }
      .twinkle { animation: twinkle var(--dur) ease-in-out var(--delay) infinite; }
      .pulse { animation: pulse var(--dur) ease-in-out var(--delay) infinite alternate; }
      .meteor { opacity: 0; animation: meteor 19s ease-out var(--delay) infinite; }
      .blink { animation: blink 2.4s steps(2) infinite; }
      .sweep { animation: sweep 18s ease-in-out var(--delay) infinite; }
      .band { animation: band var(--dur) linear var(--delay) infinite; }
      .flash { opacity: 0; animation: flash var(--dur) linear var(--delay) infinite; }
      .snowfall { animation: snowfall var(--dur) linear var(--delay) infinite; }
      .sway { animation: sway var(--dur) ease-in-out var(--delay) infinite alternate; }
      .turn { animation: spin var(--dur) linear var(--delay) infinite; }
      .hailstone { animation: hailstone var(--dur) linear var(--delay) infinite; }
      .gust { fill: none; stroke-linecap: round; stroke-dasharray: 42 150; animation: gust var(--dur) linear var(--delay) infinite; }
      .sway-tree { animation: sway-tree var(--dur) ease-in-out var(--delay) infinite alternate; }
      .leaf-fly { animation: leaf-fly var(--dur) linear var(--delay) infinite; }
      .tumble { animation: tumble-leaf var(--dur) linear var(--delay) infinite; }
      .smolder { animation: shimmer 9s ease-in-out var(--delay) infinite alternate; }
      .fleck { opacity: 0; animation: ash var(--dur) linear var(--delay) infinite; }
      @keyframes stream { from { transform: translate(0, -20px); } to { transform: translate(var(--dx), var(--dy)); } }
      @keyframes shimmer { from { opacity: .55; } to { opacity: 1; } }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes twinkle { 0%, 100% { opacity: .85; } 50% { opacity: .3; } }
      @keyframes splash { 0% { opacity: 0; transform: scale(.4, .3); } 6% { opacity: .9; } 26% { opacity: 0; transform: scale(1.35, 1); } 100% { opacity: 0; } }
      @keyframes glint { 0%, 70%, 100% { opacity: 0; transform: scale(0) rotate(0deg); } 80% { opacity: 1; transform: scale(1) rotate(45deg); } 92% { opacity: 0; transform: scale(.2) rotate(90deg); } }
      @keyframes glide { from { transform: translateX(-20px); } to { transform: translateX(var(--span)); } }
      @keyframes bob { from { transform: translateY(-3px); } to { transform: translateY(3px); } }
      @keyframes flap { 0%, 40%, 100% { transform: scaleY(1); } 10%, 30% { transform: scaleY(-.5); } 20% { transform: scaleY(1); } }
      @keyframes pulse { from { transform: scale(.72); opacity: .55; } to { transform: scale(1); opacity: 1; } }
      @keyframes meteor { 0% { transform: translateX(0); opacity: 0; } 1% { opacity: 1; } 5% { opacity: 1; } 7%, 100% { transform: translateX(190px); opacity: 0; } }
      @keyframes blink { 0% { opacity: 1; } 50% { opacity: .3; } }
      @keyframes sweep { 0% { transform: translateX(0); } 60%, 100% { transform: translateX(var(--span)); } }
      @keyframes band { from { transform: translateX(var(--from)); } to { transform: translateX(var(--to)); } }
      @keyframes flash { 0%, 60%, 100% { opacity: 0; } 60.8% { opacity: var(--peak, 1); } 61.8% { opacity: calc(var(--peak, 1) * .12); } 62.8% { opacity: var(--peak, 1); } 67% { opacity: 0; } }
      @keyframes snowfall { from { transform: translateY(-14px); } to { transform: translateY(var(--fall)); } }
      @keyframes sway { from { transform: translateX(calc(var(--sw) * -1)); } to { transform: translateX(var(--sw)); } }
      @keyframes hailstone {
        0% { opacity: 1; transform: translate(0, -12px); }
        70% { transform: translate(var(--hx), var(--gy)); }
        80% { transform: translate(calc(var(--hx) + 4px), calc(var(--gy) - 7px)); }
        90% { opacity: 1; transform: translate(calc(var(--hx) + 6px), var(--gy)); }
        100% { opacity: 0; transform: translate(calc(var(--hx) + 7px), var(--gy)); }
      }
      @keyframes gust { 0% { stroke-dashoffset: 42; } 78%, 100% { stroke-dashoffset: -100; } }
      @keyframes sway-tree { from { transform: skewX(calc(var(--lean) * -1)); } to { transform: skewX(calc((var(--lean) - var(--sway)) * -1)); } }
      @keyframes leaf-fly { from { transform: translate(-30px, 0); } to { transform: translate(var(--span), var(--lift)); } }
      @keyframes tumble-leaf { 0% { transform: rotate(0deg) scaleX(1); } 50% { transform: rotate(180deg) scaleX(.3); } 100% { transform: rotate(360deg) scaleX(1); } }
      @keyframes ash { 0% { opacity: 0; transform: translate(0, 0); } 15%, 80% { opacity: var(--a); } 100% { opacity: 0; transform: translate(var(--ax), var(--ay)); } }
      .sky-enter .sky-scene, .sky-enter .sky-front { animation: scene-in ${SCENE_FADE_MS}ms ease-out var(--enter, 0s) both; }
      @keyframes scene-in { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .sky-scene *, .sky-front * { animation-play-state: paused !important; }
        .sky-enter .sky-scene, .sky-enter .sky-front { animation: none; }
      }
      .hills { position: absolute; z-index: 1; right: 0; bottom: 0; left: 0; width: 100%; height: 22px; }
      .hill-far { fill: var(--hill-far); }
      .hill-near { fill: var(--hill-near); }


      .sun-halo { fill: #fff6d8; opacity: .55; }
      .sun-rays { fill: none; stroke: ${sunColor}; stroke-width: 2.25; stroke-linecap: round; }
      .sun-disc { fill: ${sunColor}; stroke: ${accentColor}; stroke-width: 1.5; }
      .moon, .sparkle { fill: var(--moon); }
      .cloud-body { fill: var(--cloud); }
      .cloud-shade, .cloud-back { fill: var(--cloud-shade); }
      .wx-lightning, .wx-lightning-rainy, .wx-pouring { --cloud: #ddd5de; --cloud-shade: #968599; }
      .drop { stroke: var(--drop); stroke-width: 4; stroke-linecap: round; }
      .flake { fill: none; stroke: var(--flake, var(--cloud)); stroke-width: 2.6; stroke-linecap: round; }
      .hail { fill: var(--cloud); stroke: var(--cloud-shade); stroke-width: 1.2; }
      .bolt { fill: ${sunColor}; stroke: ${accentColor}; stroke-width: 2; stroke-linejoin: round; }
      .fog line, .wind path { fill: none; stroke: var(--cloud); stroke-width: 4.5; stroke-linecap: round; }
      .fog line:nth-child(2) { stroke: var(--cloud-shade); }
      .drizzle .drop { stroke-width: 2.4; }
      .breeze path { stroke-width: 3.5; opacity: .85; }
      .haze line { fill: none; stroke: #f3dcc0; stroke-width: 5; stroke-linecap: round; opacity: .55; }
      .haze line:nth-child(even) { stroke: #d9b48c; }
      .smoke-sun { fill: #f0a35a; opacity: .75; }
      .sky-smoke { --cloud: #f0dcc4; --cloud-shade: #c7a888; }
      .wx-smoky .sun-halo { fill: #f3dcc0; opacity: .35; }
      .wx-smoky .sun-disc { fill: #f0a35a; stroke: none; }
      .wx-smoky .sun-rays { opacity: .35; }
      .alert-halo { fill: #fff6d8; opacity: .5; }
      .alert-rays { fill: none; stroke: ${accentColor}; stroke-width: 2.4; stroke-linecap: round; }
      .alert-disc { fill: ${accentColor}; }
      .alert-mark { fill: none; stroke: #fbf3e2; stroke-width: 2.6; stroke-linecap: round; }

      .flake, .hail, .drop { transform-box: fill-box; transform-origin: center; }


      /* First day of a season: a seasonal footer, a ribbon, and confetti in the sky. */
      ha-card.celebrate-spring { --card-bg: #23452f; }
      ha-card.celebrate-summer { --card-bg: #4a3512; }
      ha-card.celebrate-fall { --card-bg: #4a2a1c; }
      ha-card.celebrate-winter { --card-bg: #1c3150; }
      .celebration { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; padding: 9px 12px; border-radius: 10px; background: rgba(251, 243, 226, .1); }
      .celebration-icon { flex: none; width: 18px; height: 18px; }
      .celebration-icon path, .celebration-icon circle { fill: var(--glyph); }
      .celebration-icon .line { fill: none; stroke: var(--glyph); stroke-width: 1.8; stroke-linecap: round; }
      .celebration-icon .center { fill: var(--card-bg); }
      .celebration-spring { --glyph: #f3b6c5; }
      .celebration-summer { --glyph: ${sunColor}; }
      .celebration-fall { --glyph: #e07b4f; }
      .celebration-winter { --glyph: #cfe3ea; }
      .celebration-title { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; white-space: nowrap; }
      .celebration-note { margin-left: auto; color: ${mutedColor}; font-size: 10px; font-weight: 700; letter-spacing: .06em; white-space: nowrap; }
      .confetti { position: absolute; z-index: 1; inset: 0; overflow: hidden; pointer-events: none; }
      .confetti svg { position: absolute; top: -18px; width: var(--size); height: var(--size); overflow: visible; }
      .confetti path { fill: currentColor; }
      .confetti .vein { fill: none; stroke: rgba(0, 0, 0, .18); stroke-width: 1; stroke-linecap: round; }
      .confetti .flake-arms { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
      .confetti-summer svg { top: auto; }
      .confetti-summer svg:nth-child(odd) { top: 18%; }
      .confetti-summer svg:nth-child(even) { top: 48%; }
      @media (prefers-reduced-motion: no-preference) {
        .confetti svg { animation: tumble var(--dur) linear infinite; animation-delay: calc(var(--t, 0) * -1s + var(--d)); }
        .confetti-summer svg { animation: twinkle 3.4s ease-in-out infinite; animation-delay: calc(var(--t, 0) * -1s + var(--d)); }
      }
      @media (prefers-reduced-motion: reduce) {
        .confetti svg:nth-child(odd) { top: 22%; }
        .confetti svg:nth-child(even) { top: 55%; }
      }
      @keyframes tumble {
        0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
        10% { opacity: .95; }
        50% { transform: translate(14px, 120px) rotate(calc(var(--spin) * 3)); }
        90% { opacity: .95; }
        100% { transform: translate(-6px, 240px) rotate(calc(var(--spin) * 6)); opacity: 0; }
      }
      .footer { padding: 12px 28px 12px; --cloud: #fbf3e2; --cloud-shade: #b9ad93; --drop: #8ed6c8; }
      .forecast {
        display: grid;
        grid-template-columns: auto 30px auto auto minmax(48px, 1fr) auto;
        align-items: center;
        column-gap: 10px;
        row-gap: 6px;
      }
      .row { display: contents; }
      .day { color: ${mutedColor}; white-space: nowrap; }
      .row.now .day { color: ${textColor}; }
      .ficon { display: block; width: 30px; height: 25px; }
      .ficon .wx { display: block; width: 100%; height: 100%; }
      .rain { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; color: #8ed6c8; font-variant-numeric: tabular-nums; line-height: 1; white-space: nowrap; }
      .rain-chance { font-size: 10px; font-weight: 700; letter-spacing: .04em; }
      .rain-amount { font-size: 8.5px; font-weight: 700; letter-spacing: .04em; opacity: .75; }
      .low, .high { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.02em; text-align: right; }
      .low { color: ${mutedColor}; }
      .bar { position: relative; height: 8px; border-radius: 999px; background: rgba(251, 243, 226, .12); }
      .range { position: absolute; top: 0; bottom: 0; min-width: 8px; border-radius: 999px; }
      .now-dot {
        position: absolute;
        top: 50%;
        width: 10px;
        height: 10px;
        box-sizing: border-box;
        border: 2.5px solid var(--card-bg);
        border-radius: 50%;
        background: ${textColor};
        transform: translate(-50%, -50%);
      }
      .alerts {
        margin-bottom: 14px;
        overflow: hidden;
        border-radius: 10px;
        color: ${textColor};
        background: rgba(251, 243, 226, .12);
        --alert-icon: #8ed6c8;
        --alert-mark: var(--card-bg);
        --alert-rule: rgba(251, 243, 226, .16);
      }
      .alert {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 9px 12px;
        border: none;
        font: inherit;
        text-align: left;
        cursor: pointer;
        color: inherit;
        background: none;
      }
      .alert-extreme { color: #fbf3e2; background: #c8423a; --alert-icon: #fbf3e2; --alert-mark: #c8423a; --alert-rule: rgba(251, 243, 226, .3); }
      .alert-severe { color: #3a1d17; background: ${accentColor}; --alert-icon: #3a1d17; --alert-mark: ${accentColor}; --alert-rule: rgba(58, 29, 23, .2); }
      /* The EPA AQI colors PurpleAir uses, muted to sit with the card's palette. */
      .air-good { color: #1f3a1c; background: #8cc279; --alert-icon: #1f3a1c; --alert-rule: rgba(31, 58, 28, .22); }
      .air-moderate { color: #3a3410; background: #e3cf62; --alert-icon: #3a3410; --alert-rule: rgba(58, 52, 16, .22); }
      .air-sensitive { color: #3a2210; background: #e0975a; --alert-icon: #3a2210; --alert-rule: rgba(58, 34, 16, .22); }
      .air-unhealthy { color: #fbf3e2; background: #c2564b; --alert-icon: #fbf3e2; --alert-rule: rgba(251, 243, 226, .3); }
      .air-very { color: #fbf3e2; background: #86598c; --alert-icon: #fbf3e2; --alert-rule: rgba(251, 243, 226, .3); }
      .air-hazardous { color: #fbf3e2; background: #74343f; --alert-icon: #fbf3e2; --alert-rule: rgba(251, 243, 226, .3); }
      .alert-icon.aqi-icon path { fill: none; stroke: var(--alert-icon); stroke-width: 2.2; stroke-linecap: round; }
      .alert-moderate { color: #3a2a0c; background: ${sunColor}; --alert-icon: #3a2a0c; --alert-mark: ${sunColor}; --alert-rule: rgba(58, 42, 12, .2); }
      .alert-icon { flex: none; width: 16px; height: 16px; }
      .alert-icon path { fill: var(--alert-icon); stroke: var(--alert-icon); stroke-width: 2; stroke-linejoin: round; }
      .alert-icon .alert-icon-mark { fill: none; stroke: var(--alert-mark); stroke-width: 2.4; stroke-linecap: round; }
      .alert-event { min-width: 0; overflow: hidden; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
      .alert-until { flex: none; margin-left: auto; font-size: 10px; font-weight: 700; letter-spacing: .06em; opacity: .8; white-space: nowrap; }
      .alert-more { flex: none; padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 700; background: rgba(0, 0, 0, .14); }
      .alert-details { max-height: 260px; margin: 0 12px; overflow: auto; border-top: 1px solid var(--alert-rule); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: auto; }
      .alert-detail { padding: 10px 0 4px; }
      .alert-detail + .alert-detail { border-top: 1px solid var(--alert-rule); }
      .alert-detail h3 { margin: 0 0 6px; font-family: Futura, "Futura PT", Jost, "Avenir Next", sans-serif; font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; }
      .alert-detail p { margin: 0 0 8px; font-size: 12.5px; line-height: 1.45; white-space: pre-line; opacity: .82; }
      .alert-detail .alert-headline, .alert-detail .alert-instruction { font-weight: 600; opacity: 1; }
      .footer-note { padding: 4px 0; color: ${mutedColor}; font-size: 9.5px; text-align: center; }
      .sun-times { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: 12px; }
      .sun-time { display: flex; flex-direction: column; gap: 5px; white-space: nowrap; }
      .sun-time.set { align-items: flex-end; }
      .time { font-size: clamp(19px, 4.4cqw, 24px); font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.04em; line-height: .9; }
      .sun-time .unit { color: ${mutedColor}; font-size: 10px; }
      .sun-time .label { color: ${mutedColor}; font-size: 9.5px; }
      .daylight-change { color: ${mutedColor}; font-size: 9.5px; letter-spacing: .18em; line-height: 1.5; text-align: center; }
      .forecast + .sun-block, .footer-note + .sun-block { margin-top: 16px; }
      .forecast + .sun-block.divided, .footer-note + .sun-block.divided { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(251, 243, 226, .12); }
      .year { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(251, 243, 226, .12); }
      .sun-block:not(.divided) + .year { margin-top: 16px; }
      .year-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
      .year-date { font-size: 10.5px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; white-space: nowrap; }
      .year-next { color: ${mutedColor}; font-size: 9.5px; font-weight: 700; letter-spacing: .14em; text-align: right; text-transform: uppercase; }
      .year-bar { position: relative; height: 12px; margin: 4px 0 2px; border-radius: 3px; cursor: crosshair; touch-action: pan-y; }
      .year-season { position: absolute; top: 0; bottom: 0; }
      .year-season:first-child { border-radius: 3px 0 0 3px; }
      .year-season:nth-last-child(4) { border-radius: 0 3px 3px 0; }
      .s-winter { background: #7fa7c9; }
      .s-spring { background: #9cc47a; }
      .s-summer { background: ${sunColor}; }
      .s-fall { background: #e07b4f; }
      .year-season.past { opacity: .25; }
      /* A hairline between every day, faint enough to read as texture. */
      .year-ticks {
        position: absolute;
        inset: 0;
        border-radius: 3px;
        background: repeating-linear-gradient(90deg, transparent 0, transparent calc(100% / var(--days) - .5px), var(--card-bg) calc(100% / var(--days) - .5px), var(--card-bg) calc(100% / var(--days)));
        opacity: .28;
        pointer-events: none;
      }
      .year-today, .year-cursor { position: absolute; top: -4px; bottom: -4px; width: 2px; border-radius: 1px; transform: translateX(-50%); pointer-events: none; }
      .year-today { background: ${textColor}; box-shadow: 0 0 0 1.5px var(--card-bg); }
      .year-cursor { background: ${textColor}; opacity: .6; }
      .year-cursor[hidden] { display: none; }
      .sun-bar { position: relative; height: 8px; margin: 3px 0 11px; border-radius: 999px; background: rgba(251, 243, 226, .12); }
      .sun-fill { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 999px; background: linear-gradient(90deg, #f4a88f, ${sunColor}); }
      .sun-dot {
        position: absolute;
        top: 50%;
        width: 14px;
        height: 14px;
        box-sizing: border-box;
        border: 2px solid ${accentColor};
        border-radius: 50%;
        background: ${sunColor};
        box-shadow: 0 0 0 3px rgba(242, 181, 60, .25);
        transform: translate(-50%, -50%);
      }
      .message { display: grid; box-sizing: border-box; min-height: 156px; padding: 24px; place-items: center; color: ${mutedColor}; font-size: 14px; letter-spacing: .02em; text-align: center; }
      .message.error { color: ${accentColor}; }

      @container (max-width: 460px) {
        .sky { padding: 22px 24px 0; }
        .footer { padding: 11px 24px 11px; }
        .figure { font-size: clamp(34px, 10cqw, 46px); }
        .unit { font-size: 11px; }
        .label { font-size: 9.5px; letter-spacing: .16em; }
        .time { font-size: clamp(17px, 5cqw, 21px); }
        .sun-time .label { font-size: 8.5px; letter-spacing: .14em; }
        .daylight-change { font-size: 8.5px; letter-spacing: .14em; }
        .forecast { column-gap: 8px; }
      }
      @container (max-width: 340px) {
        .sky { padding: 18px 18px 0; }
        .footer { padding: 11px 18px 11px; }
        .figure { font-size: 31px; }
        .clock .figure { font-size: 29px; }
        .time { font-size: 16px; }
        .rain-amount { display: none; }
        .alert-until { display: none; }
        .forecast { grid-template-columns: auto 26px auto minmax(36px, 1fr) auto; }
        .day { font-size: 9.5px; letter-spacing: .14em; }
        .low, .high { font-size: 13px; }
        .daylight-change { letter-spacing: .1em; }
      }
    </style>`;
  }
}

if (globalThis.customElements && !customElements.get("kennedyish-weather-card")) {
  customElements.define("kennedyish-weather-card", KennedyishWeatherCard);
  globalThis.window.customCards = globalThis.window.customCards || [];
  globalThis.window.customCards.push({
    type: "kennedyish-weather-card",
    name: "Kennedyish Weather Card",
    preview: true,
    description: "Clock, weather, sun path, and forecast in a 1950s two-tone style.",
    documentationURL: "https://github.com/briankennedy1/kennedyish-weather-card",
  });
  console.info(`%c KENNEDYISH-WEATHER-CARD %c v${CARD_VERSION} `, "color: white; background: #92530e; font-weight: 700;", "color: #92530e; background: #fffbf2;");
}
