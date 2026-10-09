<h1 align="center">Kennedyish Weather Card</h1>

<p align="center">
  <em>A mid-century weather card for Home Assistant: halftone skies, a forecast, the length of the day, and the turning of the seasons, all in one card.</em>
</p>

<p align="center">
  <a href="https://hacs.xyz"><img alt="HACS Custom" src="https://img.shields.io/badge/HACS-Custom-41BDF5.svg"></a>
  <a href="https://github.com/briankennedy1/kennedyish-weather-card/releases"><img alt="Version" src="https://img.shields.io/github/package-json/v/briankennedy1/kennedyish-weather-card?color=ef7656&label=version"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-123f3c.svg"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sunny.png" width="560" alt="A sunny afternoon: a turquoise sky with a halftone sunburst over a teal forecast">
</p>

The sky is drawn like a 1950s travel poster, shaded in Ben-Day dots, and it changes with the weather and the time of day. Below it are your forecast, sunrise and sunset, and a bar showing the whole year.

It is one JavaScript file with no build step and no dependencies. It works anywhere in the world with any Home Assistant weather entity. It also uses your own weather station, if you have one.

<p align="center">
  <img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/rainy.png" width="45%" alt="A rainy day: slate skies with rain falling from dotted clouds">
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/clear-night.png" width="45%" alt="A clear night: a navy sky with stars and the Milky Way">
</p>

## Features

- **A sky for every condition.** Sunbursts, gulls, and glints on clear days. Stars, a shooting star, and a satellite on clear nights. Rain falls in three depths, lightning strikes the hills, snow sways, hail bounces, fog drifts, wind bends the poplars, and wildfire smoke dims the sun. Dawn warms the sky to peach and golden hour turns it coral.
- **A forecast at a glance.** Daily or hourly rows with temperature bars that run from cobalt through turquoise and mustard to coral. In the US, the chance of rain shows when it passes 5%.
- **Daylight.** Sunrise, sunset, how far through the day you are, and how much daylight you gained or lost since yesterday.
- **The year.** A bar of the whole year in season colors, with a countdown to the next season. Point at or drag along it to see any day. The seasons flip in the southern hemisphere.
- **Season celebrations.** On the first day of each season, the footer takes on the season's colors and a ribbon gives the exact time of the equinox or solstice. Blossoms, starbursts, leaves, or snowflakes drift through the sky.
- **Weather alerts (US).** National Weather Service alerts appear as a band colored by severity. Tap it to read the full alert.
- **Your own weather station.** Point the card at your station's sensors and its readings take over. Rain in the gauge becomes drizzle, rain, or a downpour, wind becomes breezy or windy, and smoky air turns the sky amber, with an air quality band when the air turns unhealthy.

<p align="center">
  <img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/celebration.png" width="40%" alt="The first day of fall: a rust-colored footer with a ribbon announcing the equinox, and leaves drifting through the sky">
  &nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/alert.png" width="40%" alt="A Heat Advisory band in mustard yellow at the top of the forecast">
</p>
<p align="center"><sub>The first day of fall, and a National Weather Service heat advisory.</sub></p>

## Every sky

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-first-light.png" alt="First light"><br><sub>First light</sub></td>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-partly-cloudy.png" alt="Partly cloudy"><br><sub>Partly cloudy</sub></td>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-golden-hour.png" alt="Golden hour"><br><sub>Golden hour</sub></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-fog.png" alt="Fog"><br><sub>Fog</sub></td>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-windy.png" alt="Windy"><br><sub>Windy</sub></td>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-smoky.png" alt="Smoky"><br><sub>Smoky</sub></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-thunderstorms.png" alt="Thunderstorms"><br><sub>Thunderstorms</sub></td>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-pouring.png" alt="Pouring, at night"><br><sub>Pouring, at night</sub></td>
    <td><img src="https://raw.githubusercontent.com/briankennedy1/kennedyish-weather-card/main/images/sky-snowy.png" alt="Snowy"><br><sub>Snowy</sub></td>
  </tr>
</table>

The skies are animated on the dashboard. The clouds hold still while the light, rain, snow, and wind move.

## Install

### HACS (recommended)

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=briankennedy1&repository=kennedyish-weather-card&category=plugin)

Or by hand:

1. In HACS, open the menu (⋮) and choose **Custom repositories**.
2. Add `https://github.com/briankennedy1/kennedyish-weather-card` with the type **Dashboard**.
3. Find **Kennedyish Weather Card** in HACS and download it. HACS adds the dashboard resource for you.

### Manual

1. Download [`kennedyish-weather-card.js`](https://github.com/briankennedy1/kennedyish-weather-card/raw/main/kennedyish-weather-card.js) and put it in `/config/www/`.
2. In Home Assistant, go to **Settings → Dashboards**, open the menu (⋮), and choose **Resources**. Add this URL as a **JavaScript module**:

   ```text
   /local/kennedyish-weather-card.js?v=4.0.0
   ```

   Change the `?v=` number whenever you update the file, because Home Assistant caches files in `/local`.

## Set up the card

Add a card to your dashboard and search for **Kennedyish Weather Card**. It has a visual editor, so you can pick your weather entity and sensors from menus. In YAML, all it needs is a weather entity:

```yaml
type: custom:kennedyish-weather-card
entity: weather.forecast_home
```

### Your location

By default, the card uses the home location and time zone from **Settings → System → General**. To show the weather somewhere else, such as a cabin or a family member's city, set these yourself:

```yaml
type: custom:kennedyish-weather-card
entity: weather.cabin
latitude: 44.0582
longitude: -121.3153
time_zone: America/Los_Angeles
title: The Cabin
```

The latitude and longitude set sunrise, sunset, the seasons (northern or southern hemisphere), and where US weather alerts and rain chances come from. The weather entity supplies the condition and forecast, so use one for the same place.

### Your weather station

If you have a home weather station (Ambient Weather, Ecowitt, Netatmo, WeatherFlow Tempest, and so on), give the card its sensors. Each one is optional. Units are converted automatically, so km/h, m/s, knots, mm/h, and °C all work.

```yaml
type: custom:kennedyish-weather-card
entity: weather.forecast_home
temperature_sensor: sensor.my_station_temperature
humidity_sensor: sensor.my_station_humidity
rain_rate_sensor: sensor.my_station_rain_rate
wind_speed_sensor: sensor.my_station_wind_speed
wind_gust_sensor: sensor.my_station_wind_gust
pm25_sensor: sensor.my_station_pm2_5
```

The station takes over the current temperature. The weather service still decides the sky (clear, cloudy, fog, storms, snow), and the station corrects it:

- **Rain:** under 0.03 in/h shows as drizzle, and 0.3 in/h or more as pouring. A dry gauge turns a forecast of rain into cloudy.
- **Wind:** 12 mph turns a clear sky breezy. 20 mph, or gusts of 30, turns it windy.
- **Air:** once PM2.5 brings the AQI to 101, a clear or cloudy sky turns smoky, and an air quality band appears with the EPA's health guidance.

### All options

| Option | Default | Description |
| --- | --- | --- |
| `entity` | — | **Required.** A weather entity |
| `title` | — | A small label above the temperature |
| `latitude`, `longitude` | Home Assistant's home | Where to calculate the sun and seasons, and fetch US alerts |
| `time_zone` | Home Assistant's time zone | An IANA time zone, like `Europe/London` |
| `use_browser_time` | `false` | Use the browser's time zone instead |
| `locale` | Home Assistant's language | Locale for dates and weekday names |
| `time_format` | Home Assistant's setting | `12` or `24` |
| `forecast_rows` | `5` | Number of forecast rows |
| `hourly_forecast` | `false` | Show hours instead of days |
| `show_humidity` | `false` | Show humidity under the condition |
| `show_decimal` | `false` | Show the current temperature to one decimal |
| `hide_clock` | `false` | Hide the clock |
| `hide_date` | `false` | Hide the date above the year bar |
| `hide_year` | `false` | Hide the year bar and date |
| `hide_celebrations` | `false` | Skip the first-day-of-season theme |
| `hide_today_section` | `false` | Hide the sky |
| `hide_forecast_section` | `false` | Hide the forecast (sunrise and sunset stay) |
| `temperature_sensor` | — | A sensor for the current temperature |
| `humidity_sensor` | — | A sensor for humidity |
| `apparent_sensor` | — | A sensor for the "feels like" temperature |
| `rain_rate_sensor` | — | A station's rain rate, in in/h or mm/h |
| `wind_speed_sensor` | — | A station's sustained wind speed |
| `wind_gust_sensor` | — | A station's wind gust speed |
| `pm25_sensor` | — | PM2.5 in µg/m³; the card works out the US AQI |
| `aqi_sensor` | — | An air quality index sensor, shown as a chip |
| `aqi_alert_threshold` | `101` | The AQI at which the air quality band appears |
| `show_alerts` | `true` | National Weather Service alerts (US only) |
| `show_rain_chance` | `true` | NWS chance of rain in the forecast rows (US only) |
| `background`, `text_color`, `muted_color`, `accent_color`, `sun_color` | Deep teal and cream | Footer and sun colors, as any CSS color |

Weather alerts and rain chances come from the free [National Weather Service API](https://www.weather.gov/documentation/services-web-api), so they appear only when Home Assistant's country is the United States. Everything else works worldwide.

### Coming from clock-weather-card

This card started as a fork of [clock-weather-card](https://github.com/pkissling/clock-weather-card), and its options carry over. Change the type to `custom:kennedyish-weather-card` and you're done. A few options don't apply:

- `time_pattern` and `date_pattern` are not supported.
- `weather_icon_type` is not supported, because the card draws its own art.
- `sun_entity` is ignored, because the card calculates the sun itself.

## Kennedyish Button

`kennedyish-button-card.js` is a small square button in the same style, for a light, switch, or fan. It glows in the bulb's color (or turquoise for a fan or plug) when on. Tap to toggle, or press and hold for Home Assistant's controls. HACS installs only the weather card, so add this one by hand like the manual install above, as `/local/kennedyish-button-card.js`.

```yaml
type: custom:kennedyish-button-card
entity: light.front_porch
```

The options are `name`, `icon` (`bulb`, `fan`, or `plug`), and `timer`, a timer entity whose time left shows under the name while it runs.

## Notes

- Sunrise and sunset are calculated in the browser using the standard −0.833° altitude, and are normally within a minute or two of published times.
- Text is set in Futura where the device has it, and in the similar free [Jost](https://fonts.google.com/specimen/Jost) font elsewhere.
- Condition names use Home Assistant's translations. The few other labels ("Sunrise", "Sunset", and so on) are in English.

## Develop

```bash
npm test
```

```bash
npm run serve
```

Then open [http://localhost:4174/](http://localhost:4174/). The staging page shows the card with controls for the time, date, condition, station readings, alerts, and width, and it reloads whenever `kennedyish-weather-card.js` changes. [Every sky](http://localhost:4174/demo/skies.html) shows each condition on the full card. To refresh the README images, run `npm run screenshots` while the server is running (it uses Google Chrome).

## Credits

Kennedyish Weather Card is by Brian Kennedy. It began as a fork of [clock-weather-card](https://github.com/pkissling/clock-weather-card) by Patrick Kissling. Released under the [MIT License](LICENSE).
