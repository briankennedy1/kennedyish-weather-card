import test from "node:test";
import assert from "node:assert/strict";

import {
  KennedyishWeatherCard,
  activeAlerts,
  aqiFromPm25,
  convertTemperature,
  fetchRainChances,
  formatPrecipitation,
  fetchWeatherAlerts,
  formatDaylightChange,
  getConditionGroup,
  getSeasonStarts,
  getYearDays,
  getSolarTimes,
  getSkyPhase,
  mergeForecasts,
  rainChanceByDay,
  refineCondition,
  skyScene,
  temperatureColor,
  weatherIllustration,
} from "../kennedyish-weather-card.js";

const TZ = "America/Los_Angeles";

function makeCard(config = {}, { condition = "sunny", sun = "above_horizon", features = 3, forecast, now = "2026-09-22T20:05:00Z" } = {}) {
  const card = new KennedyishWeatherCard();
  card.shadowRoot = { innerHTML: "" };
  card._now = () => new Date(now);
  card.setConfig({ entity: "weather.forecast_home", ...config });
  card._forecast = forecast ?? [
    { datetime: "2026-09-22T19:00:00Z", condition: "sunny", temperature: 81, templow: 58, precipitation_probability: 0 },
    { datetime: "2026-09-23T19:00:00Z", condition: "rainy", temperature: 64, templow: 52, precipitation_probability: 70 },
    { datetime: "2026-09-24T19:00:00Z", condition: "cloudy", temperature: 70, templow: 55, precipitation_probability: 10 },
  ];
  card.hass = {
    states: {
      "weather.forecast_home": {
        state: condition,
        attributes: { temperature: 78, temperature_unit: "°F", humidity: 40, supported_features: features },
      },
      "sun.sun": { state: sun, attributes: { elevation: sun === "above_horizon" ? 40 : -20 } },
      "sensor.feels": { state: "24", attributes: { unit_of_measurement: "°C" } },
    },
    config: { time_zone: TZ, unit_system: { temperature: "°F" }, latitude: 37.7749, longitude: -122.4194 },
    locale: { language: "en", time_format: "12" },
  };
  return card;
}

test("renders current conditions, the clock, the date, and one row per forecast day", () => {
  const card = makeCard();
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /class="sky sky-clear sky-day/);
  assert.match(html, /<span class="label">Sunny<\/span>/);
  assert.match(html, /78<span class="deg">°<\/span>/);
  assert.match(html, /<div class="clock">[\s\S]*?1:05<\/strong><span class="unit">PM<\/span>/, "the clock is back, in the sky");
  const sky = html.slice(html.indexOf('class="sky '), html.indexOf('class="footer"'));
  assert.doesNotMatch(sky, /Tuesday/, "the date lives in the year box, not the sky");
  assert.match(html, /class="year-date">Tuesday, Sep 22/);
  assert.equal(html.match(/class="row/g).length, 3);
  assert.match(html, /class="row now"/);
  assert.match(html, /70%/);
  assert.match(html, /class="now-dot"/);
});

test("shows sunrise, sunset, the sun's progress, and the daylight change", () => {
  const html = makeCard().shadowRoot.innerHTML;
  assert.match(html, /6:58/);
  assert.match(html, /7:08/);
  assert.match(html, /Sunrise/);
  assert.match(html, /class="sunburst"/);
  const sky = html.slice(html.indexOf('class="sky '), html.indexOf('class="footer"'));
  assert.doesNotMatch(sky, /class="sun-disc"|class="moon/, "the sky has no sun or moon");
  assert.match(html, /class="sun-bar" role="progressbar"[^>]*aria-valuenow="50"/);
  assert.match(html, /class="sun-dot"/);
  assert.ok(html.indexOf('class="sun-bar"') < html.indexOf('class="sun-times"'), "the progress bar sits above the times");
  assert.match(html, /class="daylight-change"[^>]*>−2 min 25 sec of daylight/);
  assert.doesNotMatch(html, /class="trim"/, "the sky meets the footer with no stripe between");
  const sunTimes = html.indexOf('class="sun-times"');
  assert.ok(sunTimes > html.indexOf('class="forecast"'), "sunrise, sunset, and the daylight change sit below the forecast");
  assert.ok(html.indexOf('class="daylight-change"') > sunTimes);
});

test("paints the whole sky as a scene, behind and in front of the hills", () => {
  const html = makeCard({}, { condition: "rainy" }).shadowRoot.innerHTML;
  assert.match(html, /sky-rain sky-day/);
  assert.match(html, /<svg class="sky-scene scene-rainy"/);
  assert.match(html, /<svg class="sky-front"/, "splashes land in front of the hills");
  assert.doesNotMatch(html, /class="sunburst"/);
  assert.match(makeCard({}, { condition: "fog" }).shadowRoot.innerHTML, /class="fog-bank"/);
});

test("switches to the night sky after sunset, trading the progress bar for a divider", () => {
  const html = makeCard({}, { condition: "partlycloudy", now: "2026-09-23T05:30:00Z" }).shadowRoot.innerHTML;
  assert.match(html, /sky-partly sky-night/);
  assert.match(html, /class="star"/);
  assert.doesNotMatch(html, /class="moon/);
  assert.doesNotMatch(html, /class="sun-bar"/);
  assert.match(html, /class="sun-block divided"/);
  assert.match(html, /Sunrise/);
});

test("updates the clear-weather label and sky at sunrise and sunset before the provider refreshes", () => {
  const { sunrise, sunset } = getSolarTimes(new Date("2026-10-08T19:00:00Z"), 37.7749, -122.4194);
  const cases = [
    [sunrise, -1, "sunny", "night", "Clear night", "clear-night"],
    [sunrise, 1, "clear-night", "dawn", "Clear", "sunny"],
    [sunset, -1, "clear-night", "dusk", "Clear", "sunny"],
    [sunset, 1, "sunny", "night", "Clear night", "clear-night"],
  ];
  for (const [boundary, offset, condition, phase, label, scene] of cases) {
    const card = makeCard({ hide_forecast_section: true }, {
      condition,
      now: new Date(boundary.valueOf() + offset * 1000).toISOString(),
    });
    const html = card.shadowRoot.innerHTML;
    assert.match(html, new RegExp(`class="sky sky-clear sky-${phase}`));
    assert.match(html, new RegExp(`<span class="label">${label}</span>`));
    assert.match(html, new RegExp(`aria-label="${label},`));
    assert.match(html, new RegExp(`class="sky-scene scene-${scene}"`));
  }
  // The daytime label changes at the same 14% boundary as the existing colors.
  const daytime = sunrise.valueOf() + (sunset - sunrise) * 0.14;
  for (const [offset, phase, label] of [[-1, "dawn", "Clear"], [1, "day", "Sunny"]]) {
    const html = makeCard({ hide_forecast_section: true }, {
      condition: "clear-night",
      now: new Date(daytime + offset * 1000).toISOString(),
    }).shadowRoot.innerHTML;
    assert.match(html, new RegExp(`class="sky sky-clear sky-${phase}`));
    assert.match(html, new RegExp(`<span class="label">${label}</span>`));
  }
});

test("uses a configured location over Home Assistant's", () => {
  const html = makeCard({ latitude: 64.1466, longitude: -21.9426, time_zone: "Atlantic/Reykjavik" }).shadowRoot.innerHTML;
  assert.doesNotMatch(html, /6:58/);
  assert.throws(() => new KennedyishWeatherCard().setConfig({ entity: "weather.x", latitude: 10 }), /both latitude and longitude/);
});

test("honors hide options and sensor overrides", () => {
  const html = makeCard({ hide_clock: true, hide_forecast_section: true, apparent_sensor: "sensor.feels", show_humidity: true }).shadowRoot.innerHTML;
  assert.doesNotMatch(html, /1:05/);
  assert.doesNotMatch(html, /class="forecast"/);
  assert.match(html, /Feels 75°/);
  assert.match(html, /40% humidity/);
});

test("uses the legacy forecast attribute when the entity has no forecast features", () => {
  const card = makeCard({}, { features: 0, forecast: null });
  card._hass.states["weather.forecast_home"] = {
    state: "cloudy",
    attributes: {
      temperature: 60,
      temperature_unit: "°F",
      supported_features: 0,
      forecast: [{ datetime: "2026-09-22T19:00:00Z", condition: "cloudy", temperature: 65, templow: 50 }],
    },
  };
  card._render();
  assert.equal(card.shadowRoot.innerHTML.match(/class="row/g).length, 1);
});

test("reports a missing entity and validates config like clock-weather-card", () => {
  const card = makeCard({ entity: "weather.missing" });
  assert.match(card.shadowRoot.innerHTML, /weather.missing was not found/);
  assert.throws(() => new KennedyishWeatherCard().setConfig({}), /entity/);
  assert.throws(() => new KennedyishWeatherCard().setConfig({ entity: "weather.x", forecast_rows: 0 }), /forecast_rows/);
  assert.throws(() => new KennedyishWeatherCard().setConfig({ entity: "weather.x", time_format: "13" }), /time_format/);
  assert.throws(
    () => new KennedyishWeatherCard().setConfig({ entity: "weather.x", hide_today_section: true, hide_forecast_section: true }),
    /cannot both/,
  );
});

test("merges twice-daily entries into local days", () => {
  const rows = mergeForecasts(
    [
      { datetime: "2026-09-23T15:00:00Z", condition: "rainy", temperature: 60, templow: 50, precipitation_probability: 60 },
      { datetime: "2026-09-24T03:00:00Z", condition: "rainy", temperature: 55, templow: 48, precipitation_probability: 90 },
      { datetime: "2026-09-24T15:00:00Z", condition: "sunny", temperature: 70, templow: 52 },
    ],
    { timeZone: TZ, rows: 5 },
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    [rows[0].temperature, rows[0].templow, rows[0].precipitation_probability, rows[0].condition],
    [60, 48, 90, "rainy"],
  );
});

test("converts temperatures and picks sky phases", () => {
  assert.equal(convertTemperature(100, "°C", "°F"), 212);
  assert.equal(Math.round(convertTemperature(50, "°F", "°C")), 10);
  assert.equal(convertTemperature("n/a", "°C", "°F"), null);
  assert.equal(getSkyPhase(0.05), "dawn");
  assert.equal(getSkyPhase(0.5), "day");
  assert.equal(getSkyPhase(0.95), "dusk");
  assert.equal(getSkyPhase(-0.2), "night");
  assert.equal(getSkyPhase(1.3), "night");
  assert.equal(getConditionGroup("lightning-rainy"), "storm");
  assert.equal(getConditionGroup("windy"), "clear");
  assert.equal(getConditionGroup("windy-variant"), "cloudy");
});

test("colors bars from cobalt to coral and draws art for every condition", () => {
  assert.equal(temperatureColor(-40), "#3d5a8a");
  assert.equal(temperatureColor(50), "#c8423a");
  assert.match(temperatureColor(17), /^rgb\(/);
  for (const condition of ["clear-night", "cloudy", "exceptional", "fog", "hail", "lightning", "lightning-rainy", "partlycloudy", "pouring", "rainy", "snowy", "snowy-rainy", "sunny", "windy", "windy-variant"]) {
    assert.match(weatherIllustration(condition), /^<svg class="wx wx-/);
  }
  assert.match(weatherIllustration("sunny", { night: true }), /wx-clear-night/);
});

test("keeps the daylight card's solar math", () => {
  const result = getSolarTimes(new Date("2026-08-11T19:00:00Z"), 35.6266, -120.691);
  const daylightHours = (result.sunset - result.sunrise) / 3_600_000;
  assert.ok(result.sunrise < result.solarNoon && result.solarNoon < result.sunset);
  assert.ok(daylightHours > 13 && daylightHours < 15);
  assert.equal(formatDaylightChange(-124), "-2 min 4 sec of daylight");
  assert.equal(formatDaylightChange(0.2), "No change in daylight");
});

test("corrects the current condition with the station's rain gauge and wind", () => {
  assert.equal(refineCondition("partlycloudy", { rainRate: 0.05 }), "rainy");
  assert.equal(refineCondition("sunny", { rainRate: 0.4 }), "pouring");
  assert.equal(refineCondition("pouring", { rainRate: 0.1 }), "rainy");
  assert.equal(refineCondition("rainy", { rainRate: 0 }), "cloudy");
  assert.equal(refineCondition("lightning-rainy", { rainRate: 0 }), "lightning");
  assert.equal(refineCondition("snowy", { rainRate: 0 }), "snowy");
  assert.equal(refineCondition("snowy-rainy", { rainRate: 0.2 }), "snowy-rainy");
  assert.equal(refineCondition("rainy"), "rainy", "no station reading leaves the condition alone");
  assert.equal(refineCondition("sunny", { windSpeed: 22 }), "windy");
  assert.equal(refineCondition("cloudy", { windSpeed: 5, windGust: 34 }), "windy-variant");
  assert.equal(refineCondition("rainy", { rainRate: 0.1, windSpeed: 25 }), "rainy");
});

test("renders the station's condition and temperature over the forecast service's", () => {
  const card = makeCard({ temperature_sensor: "sensor.station_temp", rain_rate_sensor: "sensor.station_rain", wind_speed_sensor: "sensor.station_wind" });
  card._hass = {
    ...card._hass,
    states: {
      ...card._hass.states,
      "sensor.station_temp": { state: "57.7", attributes: { unit_of_measurement: "°F" } },
      "sensor.station_rain": { state: "2", attributes: { unit_of_measurement: "mm/h" } },
      "sensor.station_wind": { state: "3", attributes: { unit_of_measurement: "mph" } },
    },
  };
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /58<span class="deg">°<\/span>/);
  assert.match(html, /sky-rain/);
  assert.match(html, /<svg class="sky-scene scene-rainy"/);
});

test("keeps only alerts in effect, one per event, most severe first", () => {
  const now = new Date("2026-09-23T18:00:00Z");
  const alerts = activeAlerts(
    [
      { event: "Heat Advisory", severity: "Moderate", ends: "2026-09-24T03:00:00Z" },
      { event: "Heat Advisory", severity: "Moderate", ends: "2026-09-24T05:00:00Z" },
      { event: "Red Flag Warning", severity: "Severe", ends: "2026-09-24T01:00:00Z" },
      { event: "Wind Advisory", severity: "Moderate", ends: "2026-09-23T17:00:00Z" },
      { event: "Frost Advisory", severity: "Minor", messageType: "Cancel", ends: "2026-09-24T12:00:00Z" },
    ],
    now,
  );
  assert.deepEqual(alerts.map((alert) => alert.event), ["Red Flag Warning", "Heat Advisory"]);
  assert.equal(alerts[1].ends, "2026-09-24T05:00:00Z");
});

test("fetches alerts from the National Weather Service", async () => {
  const alerts = await fetchWeatherAlerts(37.77493, -122.41942, async (url) => {
    assert.equal(url, "https://api.weather.gov/alerts/active?point=37.775,-122.419");
    return { ok: true, json: async () => ({ features: [{ properties: { event: "Heat Advisory", severity: "Moderate", ends: "2099-01-01T00:00:00Z" } }] }) };
  });
  assert.equal(alerts[0].event, "Heat Advisory");
  await assert.rejects(fetchWeatherAlerts(0, 0, async () => ({ ok: false, status: 503 })), /503/);
});

test("shows an alert band above the forecast, and its details when opened", () => {
  const card = makeCard();
  card._alerts = [
    { event: "Red Flag Warning", severity: "Severe", ends: "2026-09-23T03:00:00Z", headline: "Red Flag Warning until 8 PM", description: "Gusty winds and low humidity.", instruction: "Avoid outdoor burning." },
    { event: "Heat Advisory", severity: "Moderate", ends: "2026-09-23T03:00:00Z" },
  ];
  card._render();
  let html = card.shadowRoot.innerHTML;
  assert.match(html, /class="alerts alert-severe"/);
  assert.match(html, /Red Flag Warning/);
  assert.match(html, /until 8:00 PM/);
  assert.match(html, /\+1/);
  assert.ok(html.indexOf('class="alerts"') < html.indexOf('class="forecast"'));
  assert.doesNotMatch(html, /Avoid outdoor burning/);
  card._alertsOpen = true;
  card._render();
  html = card.shadowRoot.innerHTML;
  assert.match(html, /Avoid outdoor burning/);
  assert.match(html, /aria-expanded="true"/);
  const box = html.slice(html.indexOf('class="alerts alert-severe open"'), html.indexOf('class="forecast"'));
  assert.match(box, /class="alert-details"/, "the details open inside the alert's own box");

  const quiet = makeCard({ show_alerts: false });
  quiet._alerts = card._alerts;
  quiet._render();
  assert.doesNotMatch(quiet.shadowRoot.innerHTML, /class="alerts"/);
});

test("works out the US AQI from PM2.5", () => {
  assert.equal(aqiFromPm25(0), 0);
  assert.equal(aqiFromPm25(6), 33);
  assert.equal(aqiFromPm25(9), 50);
  assert.equal(aqiFromPm25(35.4), 100);
  assert.equal(aqiFromPm25(55.5), 151);
  assert.equal(aqiFromPm25(600), 500);
  assert.equal(aqiFromPm25(Number.NaN), null);
});

test("fetches NWS rain chances and takes the highest still ahead on each day", async () => {
  const periods = await fetchRainChances(37.77493, -122.41942, async (url) => {
    if (url.includes("/points/")) {
      assert.equal(url, "https://api.weather.gov/points/37.775,-122.419");
      return { ok: true, json: async () => ({ properties: { forecast: "https://api.weather.gov/gridpoints/STO/10,53/forecast" } }) };
    }
    return {
      ok: true,
      json: async () => ({
        properties: {
          periods: [
            { startTime: "2026-09-23T06:00:00-07:00", endTime: "2026-09-23T18:00:00-07:00", probabilityOfPrecipitation: { value: 10 } },
            { startTime: "2026-09-23T18:00:00-07:00", endTime: "2026-09-24T06:00:00-07:00", probabilityOfPrecipitation: { value: 40 } },
            { startTime: "2026-09-24T06:00:00-07:00", endTime: "2026-09-24T18:00:00-07:00", probabilityOfPrecipitation: { value: null } },
          ],
        },
      }),
    };
  });
  assert.equal(periods.length, 3);
  const byDay = rainChanceByDay(periods, { timeZone: TZ, now: new Date("2026-09-23T20:00:00Z") });
  assert.equal(byDay.get("09/23/2026"), 40, "tonight counts toward today");
  assert.equal(byDay.has("09/24/2026"), false, "no chance given, no number shown");
});

test("shows rain in the forecast rows above a 5% chance, with the expected amount", () => {
  const card = makeCard();
  // Met.no gives amounts but no chance of rain; the chance comes from the NWS.
  card._forecast = [
    { datetime: "2026-09-22T19:00:00Z", condition: "rainy", temperature: 64, templow: 52, precipitation: 0.25 },
    { datetime: "2026-09-23T19:00:00Z", condition: "cloudy", temperature: 70, templow: 55, precipitation: 0.02 },
    { datetime: "2026-09-24T19:00:00Z", condition: "sunny", temperature: 80, templow: 57, precipitation: 0 },
  ];
  card._hass.states["weather.forecast_home"].attributes.precipitation_unit = "in";
  card._rainChances = [
    { start: "2026-09-22T13:00:00Z", end: "2026-09-23T13:00:00Z", chance: 60 },
    { start: "2026-09-23T13:00:00Z", end: "2026-09-24T13:00:00Z", chance: 5 },
    { start: "2026-09-24T13:00:00Z", end: "2026-09-25T13:00:00Z", chance: 10 },
  ];
  card._render();
  const rain = [...card.shadowRoot.innerHTML.matchAll(/<span class="rain">([\s\S]*?)<\/span>\s*<span class="low">/g)].map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  assert.deepEqual(rain, ["60% 0.25 in", "", "10%"], "5% or less shows nothing; no amount, no amount line");
  assert.match(card.shadowRoot.innerHTML, /60% chance of rain, 0.25 in expected/);

  card._rainChances = null;
  card._render();
  const noChance = [...card.shadowRoot.innerHTML.matchAll(/<span class="rain">([\s\S]*?)<\/span>\s*<span class="low">/g)].map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  assert.deepEqual(noChance, ["0.25 in", "0.02 in", ""], "without NWS chances, forecast amounts still show");
  assert.equal(formatPrecipitation(0.4, "in"), "0.4 in");
  assert.equal(formatPrecipitation(6.2, "mm"), "6 mm");
});

test("shows a PurpleAir-colored air quality bar only when the air turns bad", () => {
  const card = makeCard({ pm25_sensor: "sensor.pm" });
  const setPm25 = (value) => {
    card._hass = { ...card._hass, states: { ...card._hass.states, "sensor.pm": { state: String(value), attributes: { unit_of_measurement: "µg/m³" } } } };
    card._render();
    return card.shadowRoot.innerHTML;
  };
  assert.doesNotMatch(setPm25(20), /class="alerts air/, "moderate air stays quiet");
  let html = setPm25(40);
  assert.match(html, /class="alerts air air-sensitive"/);
  assert.match(html, /Unhealthy for sensitive groups/);
  assert.match(html, /AQI 112/);
  assert.doesNotMatch(html, /reduce prolonged or heavy exertion/);
  card._aqiOpen = true;
  html = setPm25(160);
  assert.match(html, /class="alerts air air-very open"/);
  assert.match(html, /stay indoors/);
  assert.match(html, /PM2.5 160 µg\/m³/);
  const sky = html.slice(html.indexOf('class="sky '), html.indexOf('class="footer"'));
  assert.doesNotMatch(sky, /AQI/, "no AQI chip in the sky without an aqi_sensor");

  const strict = makeCard({ pm25_sensor: "sensor.pm", aqi_alert_threshold: 51 });
  strict._hass = { ...strict._hass, states: { ...strict._hass.states, "sensor.pm": { state: "20", attributes: {} } } };
  strict._render();
  assert.match(strict.shadowRoot.innerHTML, /class="alerts air air-moderate"/);
});

test("finds the equinoxes and solstices to within a couple of hours", () => {
  const [march, june, september, december] = getSeasonStarts(2026);
  const near = (date, iso) => assert.ok(Math.abs(date - new Date(iso)) < 2 * 3_600_000, `${date.toISOString()} vs ${iso}`);
  near(march, "2026-03-20T14:46:00Z");
  near(june, "2026-06-21T08:24:00Z");
  near(september, "2026-09-23T00:05:00Z");
  near(december, "2026-12-21T20:50:00Z");
});

test("colors each day of the year by season and counts down to the next", () => {
  const year = getYearDays(new Date("2026-09-22T20:05:00Z"), { timeZone: TZ });
  assert.equal(year.days.length, 365);
  assert.equal(year.today, "2026-09-22");
  assert.equal(year.lead, 4, "January 1, 2026 is a Thursday");
  const seasonOn = (day) => year.days.find((entry) => entry.day === day).season;
  assert.equal(seasonOn("2026-01-15"), "winter");
  assert.equal(seasonOn("2026-03-20"), "spring");
  assert.equal(seasonOn("2026-07-04"), "summer");
  assert.equal(seasonOn("2026-09-22"), "fall", "the equinox falls on the evening of Sep 22 in California");
  assert.equal(seasonOn("2026-12-25"), "winter");
  assert.equal(year.season, "fall");
  assert.equal(year.nextSeason, "winter");
  assert.equal(year.daysUntilNext, 90);

  const lateDecember = getYearDays(new Date("2026-12-28T20:00:00Z"), { timeZone: TZ });
  assert.equal(lateDecember.nextSeason, "spring");
  const southern = getYearDays(new Date("2026-09-22T20:05:00Z"), { timeZone: "Australia/Sydney", southern: true });
  assert.equal(southern.season, "spring");
  assert.equal(southern.nextSeason, "summer");
});

test("draws the year as one bar at the foot of the card, muting the days gone by", () => {
  const html = makeCard().shadowRoot.innerHTML;
  assert.match(html, /90 days until Winter/);
  assert.doesNotMatch(html, /Day \d+/);
  const segments = [...html.matchAll(/class="year-season s-(\w+)( past)?" style="left: ([\d.]+)%; width: ([\d.]+)%"/g)].map((m) => [m[1], Boolean(m[2])]);
  assert.deepEqual(segments, [["winter", true], ["spring", true], ["summer", true], ["fall", false], ["winter", false]]);
  assert.match(html, /class="year-today" style="left: 72.466%"/, "the middle of Sep 22, day 265 of 365");
  assert.match(html, /--days: 365/);
  assert.ok(html.indexOf('class="year"') > html.indexOf('class="sun-times"'), "below sunrise and sunset");
  assert.doesNotMatch(makeCard({ hide_year: true }).shadowRoot.innerHTML, /class="year"/);
});

test("knows the first day of each season, and the moment it began", () => {
  const fall = getYearDays(new Date("2026-09-22T20:05:00Z"), { timeZone: TZ }).seasonBegins;
  assert.equal(fall.season, "fall");
  assert.equal(fall.event, "equinox");
  assert.ok(Math.abs(fall.at - new Date("2026-09-23T00:05:00Z")) < 2 * 3_600_000);
  assert.equal(getYearDays(new Date("2026-06-21T18:00:00Z"), { timeZone: TZ }).seasonBegins.event, "solstice");
  assert.equal(getYearDays(new Date("2026-09-23T18:00:00Z"), { timeZone: TZ }).seasonBegins, null, "the day after is ordinary");
  assert.equal(getYearDays(new Date("2026-09-22T10:00:00Z"), { timeZone: "Australia/Sydney", southern: true }).seasonBegins, null, "the evening of Sep 22 in Sydney is the day before");
  assert.equal(getYearDays(new Date("2026-09-23T02:00:00Z"), { timeZone: "Australia/Sydney", southern: true }).seasonBegins.season, "spring");
});

test("celebrates the first day of a season with a theme, a ribbon, and confetti", () => {
  // The test card's day, Sep 22, 2026, is the first day of fall in California.
  const html = makeCard().shadowRoot.innerHTML;
  assert.match(html, /<ha-card[^>]*class="celebrate celebrate-fall"/);
  assert.match(html, /class="celebration celebration-fall"/);
  assert.match(html, /First day of Fall/);
  assert.match(html, /Equinox at 5:\d\d PM/);
  assert.equal((html.match(/<div class="confetti confetti-fall"[\s\S]*?<\/div>/)[0].match(/<svg /g) || []).length, 12);
  assert.ok(html.indexOf('class="celebration') < html.indexOf('class="forecast"'), "the ribbon heads the footer");

  const markup = (card) => card.shadowRoot.innerHTML.split("</style>")[1];
  const quiet = markup(makeCard({ hide_celebrations: true }));
  assert.doesNotMatch(quiet, /celebrate|class="celebration|class="confetti/);
  const nextDay = markup(makeCard({}, { now: "2026-09-23T20:05:00Z" }));
  assert.doesNotMatch(nextDay, /celebrate-|class="celebration|class="confetti/);
});

test("names drizzle, breezy, and smoky from what the station measures", () => {
  assert.equal(refineCondition("cloudy", { rainRate: 0.02 }), "drizzle");
  assert.equal(refineCondition("rainy", { rainRate: 0.01 }), "drizzle");
  assert.equal(refineCondition("cloudy", { rainRate: 0.05 }), "rainy");
  assert.equal(refineCondition("sunny", { windSpeed: 14 }), "breezy");
  assert.equal(refineCondition("clear-night", { windSpeed: 13 }), "breezy");
  assert.equal(refineCondition("partlycloudy", { windSpeed: 14 }), "partlycloudy", "a breeze doesn't hide the clouds");
  assert.equal(refineCondition("sunny", { windSpeed: 22 }), "windy");
  assert.equal(refineCondition("sunny", { aqi: 160 }), "smoky");
  assert.equal(refineCondition("cloudy", { aqi: 120, windSpeed: 25 }), "smoky", "smoke outranks wind");
  assert.equal(refineCondition("fog", { aqi: 160 }), "fog", "the sky's call for fog stands");
  assert.equal(refineCondition("rainy", { rainRate: 0.1, aqi: 160 }), "rainy", "rain outranks smoke");
  assert.equal(refineCondition("sunny", { aqi: 80 }), "sunny");
  assert.equal(getConditionGroup("drizzle"), "rain");
  assert.equal(getConditionGroup("breezy"), "clear");
  assert.equal(getConditionGroup("smoky"), "smoke");
  for (const condition of ["drizzle", "breezy", "smoky"]) assert.match(weatherIllustration(condition), new RegExp(`wx-${condition}`));
});

test("turns the sky amber when station PM2.5 shows smoke", () => {
  const card = makeCard({ pm25_sensor: "sensor.pm" });
  card._hass = { ...card._hass, states: { ...card._hass.states, "sensor.pm": { state: "80", attributes: {} } } };
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /class="sky sky-smoke sky-day/);
  assert.match(html, /class="label">Smoky</);
  assert.match(html, /class="smoke-sun"/);
  assert.match(html, /class="alerts air air-unhealthy"/, "the air quality bar still shows");
});

test("draws rain as Streamliner streaks under halftone clouds, scaled to the sky", () => {
  const size = { width: 435, height: 145 };
  const rainScene = (kind, options) => skyScene(kind, options).back;
  const streaks = (kind) => (rainScene(kind, size).match(/<line /g) || []).length;
  assert.ok(streaks("drizzle") < streaks("rainy") && streaks("rainy") < streaks("pouring"), "heavier rain, more streaks");
  assert.equal(streaks("rainy"), 102, "50 far, 32 middle, 20 near");
  const scene = rainScene("rainy", size);
  assert.match(scene, /viewBox="0 0 435 145"/);
  assert.equal((scene.match(/<clipPath id="sky-cloud-/g) || []).length, 4, "four clouds");
  assert.equal((scene.match(/<pattern id="ht-/g) || []).length, 8, "dots in four sizes, near and far");
  assert.equal((scene.match(/class="shaft"/g) || []).length, 4, "a shaft of rain under each cloud");
  assert.equal(scene, rainScene("rainy", size), "the same scene every render, so nothing jumps");
  assert.match(rainScene("rainy", { width: 600, height: 150 }), /viewBox="0 0 600 150"/);
  assert.notEqual(rainScene("rainy", { ...size, phase: "night" }), scene, "night has its own tones");
});

test("gives every condition its own halftone sky, day and night, the same every render", () => {
  const size = { width: 435, height: 145 };
  const kinds = ["sunny", "clear-night", "partlycloudy", "cloudy", "fog", "drizzle", "rainy", "pouring", "lightning", "lightning-rainy", "snowy", "snowy-rainy", "hail", "windy", "windy-variant", "breezy", "smoky", "exceptional"];
  const seen = new Set();
  for (const kind of kinds) {
    for (const phase of ["day", "dawn", "night"]) {
      const { back, front } = skyScene(kind, { ...size, phase });
      assert.match(back, new RegExp(`^<svg class="sky-scene scene-${kind}"`), kind);
      assert.doesNotMatch(back + front, /NaN|undefined|Infinity/, `${kind} at ${phase} has only real numbers`);
      assert.deepEqual(skyScene(kind, { ...size, phase }), { back, front }, `${kind} is the same every render`);
      if (phase === "day") seen.add(back);
    }
  }
  assert.equal(seen.size, kinds.length, "no two conditions share a sky");
  const scene = (kind, phase = "day") => skyScene(kind, { ...size, phase });
  assert.match(scene("sunny").back, /class="sunburst"/);
  assert.match(scene("clear-night", "night").back, /class="star/);
  assert.match(scene("clear-night", "night").back, /class="meteor"/);
  assert.equal((scene("lightning").back.match(/class="flash bolt-strike"/g) || []).length, 2, "two bolts");
  assert.doesNotMatch(scene("lightning").back, /class="streaks"/, "dry lightning, no rain");
  assert.match(scene("lightning-rainy").back, /class="streaks"/);
  assert.match(scene("snowy").front, /class="snow near"/);
  assert.match(scene("hail").front, /class="hailstone"/);
  assert.match(scene("windy").front, /class="leaf-fly"/);
  assert.match(scene("fog").front, /class="fog-bank"/);
  assert.match(scene("smoky").back, /class="smoke-sun"/);
  assert.equal(scene("sunny").front, "", "nothing in front of the hills on a clear day");
  assert.match(scene("not-a-condition").back, /scene-not-a-condition/, "unknown conditions get an overcast sky");
  assert.match(scene("constructor").back, /ht-front-0/, "an unknown condition never reaches a built-in");
});

test("fades a new sky in when the condition changes, and only then", () => {
  const card = makeCard({}, { condition: "sunny" });
  // Only the markup, not the stylesheet that defines the fade.
  const markup = () => card.shadowRoot.innerHTML.split("</style>")[1];
  assert.doesNotMatch(markup(), /sky-enter/, "no fade on the first render");
  card._hass = { ...card._hass, states: { ...card._hass.states, "weather.forecast_home": { ...card._hass.states["weather.forecast_home"], state: "rainy" } } };
  card._render();
  assert.match(markup(), /class="sky sky-rain sky-day sky-enter"/);
  card._render();
  assert.match(markup(), /sky-enter" style="--t: [\d.]+; --enter: -\d+ms"/, "a quick re-render carries the fade on");
  card._sceneChangedAt -= 5000;
  card._render();
  assert.doesNotMatch(markup(), /sky-enter/, "once faded in, the sky just stays");
});

test("shows the temperature without a unit letter, but still says it aloud", () => {
  const html = makeCard().shadowRoot.innerHTML.split("</style>")[1];
  const reading = html.slice(html.indexOf('class="reading"'), html.indexOf('class="clock"'));
  assert.match(reading, /<strong class="figure">78<span class="deg">°<\/span><\/strong><\/div>/);
  assert.doesNotMatch(reading, /class="unit"/);
  assert.match(html, /aria-label="Sunny, 78 degrees F/);
});

test("rejects a time zone that isn't one", () => {
  assert.throws(() => makeCard({ time_zone: "Europe/Lon" }), /is not a time zone/);
  assert.doesNotThrow(() => makeCard({ time_zone: "Europe/London" }));
});
