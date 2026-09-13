#!/usr/bin/env node
// Refreshes german-weather.html with the latest Open-Meteo forecast for the
// fixed 2026-09-19 ~ 2026-09-27 Germany road trip itinerary.
// Safe to run daily: it stops touching the file once the trip window has passed.

const fs = require('fs');
const path = require('path');

const CUTOFF_DATE = '2026-09-26'; // return day (19:40 Frankfurt departure)
const CUTOFF_HOUR = '18'; // stop after German time 9/26 18:00 — no point refreshing past departure
const htmlPath = path.join(__dirname, '..', 'german-weather.html');

// Display the update time in Germany's own local time (Europe/Berlin) since
// that's the timezone the forecast itself is anchored to, and the routine fires
// hourly (German time).
const now = new Date();
const todayBerlin = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
const hourBerlin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false }).format(now);
const minuteBerlin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', minute: '2-digit' }).format(now).padStart(2, '0');
const weekdayBerlin = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(now);
const pastCutoff = todayBerlin > CUTOFF_DATE || (todayBerlin === CUTOFF_DATE && hourBerlin > CUTOFF_HOUR);
if (pastCutoff) {
  console.log(`지금(${todayBerlin} ${hourBerlin}시, 독일시간)은 갱신 종료 시점(${CUTOFF_DATE} ${CUTOFF_HOUR}시)을 지났습니다. 아무 것도 하지 않습니다.`);
  process.exit(0);
}

function iconFor(code) {
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  // fog (45/48) renders as plain cloud instead of a separate fog icon — a
  // distinct fog glyph next to otherwise-cloudy neighboring columns/cities
  // reads as an error rather than real weather variation, so keep it uniform.
  if (code === 45 || code === 48) return '☁️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code === 85 || code === 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '';
}

// order matches daily grid rows top-to-bottom (index 0 = Seoul)
const DAILY_NAMES = ['인천/서울','프랑크푸르트','뷔르츠부르크','로텐부르크','뉘른베르크','뮌헨','퓌센','호엔슈방가우','오버아머가우','에탈','가르미슈파르텐키르헨','켐프텐','티티제','프라이부르크','트리베르크','메칭겐','슈투트가르트','하이델베르크','뤼데스하임','비스바덴'];
const DAILY_LAT = ['37.46','50.11','49.79','49.38','49.45','48.14','47.57','47.55','47.60','47.57','47.49','47.73','47.90','47.995','48.13','48.54','48.78','49.41','49.98','50.08'];
const DAILY_LON = ['126.70','8.68','9.93','10.18','11.08','11.58','10.70','10.74','11.07','11.10','11.10','10.32','8.16','7.85','8.23','9.28','9.18','8.71','7.91','8.24'];
// last row in the daily grid table repeats Frankfurt (return-day column)
const ROW_ORDER = DAILY_NAMES.concat(['프랑크푸르트']);

// hourly table: 19 unique locations (Frankfurt appears twice as column 1 & 20)
const HOURLY_NAMES = ['프랑크푸르트','뷔르츠부르크','로텐부르크','뉘른베르크','뮌헨','퓌센','호엔슈방가우','오버아머가우','에탈','가르미슈파르텐키르헨','켐프텐','티티제','프라이부르크','트리베르크','메칭겐','슈투트가르트','하이델베르크','뤼데스하임','비스바덴'];
const HOURLY_LAT = ['50.11','49.79','49.38','49.45','48.14','47.57','47.55','47.60','47.57','47.49','47.73','47.90','47.995','48.13','48.54','48.78','49.41','49.98','50.08'];
const HOURLY_LON = ['8.68','9.93','10.18','11.08','11.58','10.70','10.74','11.07','11.10','11.10','10.32','8.16','7.85','8.23','9.28','9.18','8.71','7.91','8.24'];
// [locIndex into HOURLY_*, date] per hourly-table column, in header order.
// Nürnberg appears twice (09-20 stay, then again the morning of 09-21 before driving to Munich).
const HOURLY_COLUMNS = [
  [0,'2026-09-19'],[1,'2026-09-20'],[2,'2026-09-20'],[3,'2026-09-20'],[3,'2026-09-21'],[4,'2026-09-21'],
  [5,'2026-09-22'],[6,'2026-09-22'],[7,'2026-09-22'],[8,'2026-09-22'],[9,'2026-09-22'],
  [10,'2026-09-23'],[11,'2026-09-23'],[12,'2026-09-24'],[13,'2026-09-24'],[14,'2026-09-24'],
  [15,'2026-09-25'],[16,'2026-09-25'],[17,'2026-09-26'],[18,'2026-09-26'],[0,'2026-09-26'],
];

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${url}`);
  return res.json();
}

async function main() {
  const dailyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${DAILY_LAT.join(',')}&longitude=${DAILY_LON.join(',')}&daily=temperature_2m_max,temperature_2m_min,weathercode,sunset&timezone=auto&start_date=2026-09-19&end_date=2026-09-27`;
  const hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${HOURLY_LAT.join(',')}&longitude=${HOURLY_LON.join(',')}&hourly=temperature_2m,weathercode&timezone=auto&start_date=2026-09-19&end_date=2026-09-26`;

  const [daily, hourly] = await Promise.all([fetchJSON(dailyUrl), fetchJSON(hourlyUrl)]);

  let html = fs.readFileSync(htmlPath, 'utf8');

  // ---- daily grid table ----
  function getDailyValues(cityName) {
    const idx = DAILY_NAMES.indexOf(cityName);
    const d = daily[idx].daily;
    return d.time.map((t, i) => ({
      val: `${Math.round(d.temperature_2m_max[i])}/${Math.round(d.temperature_2m_min[i])}`,
      icon: iconFor(d.weathercode[i]),
    }));
  }

  const dgStart = html.indexOf('<table class="weather-grid">');
  const dgEnd = html.indexOf('</table>', dgStart) + '</table>'.length;
  let dgSection = html.slice(dgStart, dgEnd);
  const cityOccurrence = {};
  dgSection = dgSection.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/g, (trMatch, trInner) => {
    const cityMatch = trInner.match(/<td class="wg-city">([^<]+)<\/td>/);
    if (!cityMatch) return trMatch;
    const cityName = cityMatch[1];
    cityOccurrence[cityName] = (cityOccurrence[cityName] || 0) + 1;
    const values = getDailyValues(cityName);
    let cellIdx = 0;
    const newTrInner = trInner.replace(
      /(<td class="([^"]*wg-cell[^"]*)">)([0-9]+\/[0-9]+)(<span class="wx-icon">)([^<]*)(<\/span><\/td>)/g,
      (m, p1, classes, oldVal, p4, oldIcon, p6) => {
        const v = values[cellIdx++];
        return `${p1}${v.val}${p4}${v.icon}${p6}`;
      }
    );
    return trMatch.replace(trInner, newTrInner);
  });
  html = html.slice(0, dgStart) + dgSection + html.slice(dgEnd);

  if (ROW_ORDER.some((name) => !cityOccurrence[name])) {
    throw new Error('daily grid row mapping mismatch — aborting to avoid corrupting the file');
  }

  // ---- hourly table ----
  function findHourIdx(times, dateStr, hh) {
    return times.indexOf(`${dateStr}T${hh}:00`);
  }

  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const hourlyRowVals = {};
  hours.forEach((hh) => {
    hourlyRowVals[hh] = HOURLY_COLUMNS.map(([locIdx, dateStr]) => {
      const loc = hourly[locIdx];
      const idx = findHourIdx(loc.hourly.time, dateStr, hh);
      const temp = Math.round(loc.hourly.temperature_2m[idx]);
      const code = loc.hourly.weathercode[idx];
      return { val: `${temp}°`, icon: iconFor(code) };
    });
  });

  const dailyNamesNoSeoul = DAILY_NAMES.slice(1);
  function dailyForColumn(locIdx, dateStr) {
    const cityName = HOURLY_NAMES[locIdx];
    const dIdx = dailyNamesNoSeoul.indexOf(cityName) + 1; // +1 offset for Seoul at index 0
    const dloc = daily[dIdx].daily;
    const ti = dloc.time.indexOf(dateStr);
    return { dloc, ti };
  }
  const sunsetVals = HOURLY_COLUMNS.map(([locIdx, dateStr]) => {
    const { dloc, ti } = dailyForColumn(locIdx, dateStr);
    return dloc.sunset[ti].split('T')[1];
  });
  const minmaxVals = HOURLY_COLUMNS.map(([locIdx, dateStr]) => {
    const { dloc, ti } = dailyForColumn(locIdx, dateStr);
    return `${Math.round(dloc.temperature_2m_min[ti])}/${Math.round(dloc.temperature_2m_max[ti])}`;
  });

  // there are two <table class="hourly-table"> elements (a 6-hour summary and a
  // 1-hour detail table) — refresh cells in both, wherever their rows appear.
  function refreshHourlySection(htSection) {
    htSection = htSection.replace(/<tr([^>]*)><td>(\d{2}시)<\/td>([\s\S]*?)<\/tr>/g, (m, trAttrs, label, cellsBlock) => {
      const hh = label.slice(0, 2);
      const vals = hourlyRowVals[hh];
      let cellIdx = 0;
      const newCells = cellsBlock.replace(
        /(<td class="mono">)(\d+)°(<span class="wx-icon">)([^<]*)(<\/span><\/td>)/g,
        (mm, p1, oldTemp, p3, oldIcon, p5) => {
          const v = vals[cellIdx++];
          return `${p1}${v.val.replace('°', '')}°${p3}${v.icon}${p5}`;
        }
      );
      return `<tr${trAttrs}><td>${label}</td>${newCells}</tr>`;
    });

    htSection = htSection.replace(/(<tr class="wg-sunset-row"><td>🌇 일몰<\/td>)([\s\S]*?)(<\/tr>)/, (m, p1, cellsBlock, p3) => {
      let cellIdx = 0;
      const newCells = cellsBlock.replace(/(<td class="mono">)(\d{2}:\d{2})(<\/td>)/g, (mm, a, oldTime, c) => `${a}${sunsetVals[cellIdx++]}${c}`);
      return p1 + newCells + p3;
    });

    htSection = htSection.replace(/(<tr class="wg-minmax-row"><td>[^<]*<\/td>)([\s\S]*?)(<\/tr>)/, (m, p1, cellsBlock, p3) => {
      let cellIdx = 0;
      const newCells = cellsBlock.replace(/(<td class="mono">)(\d+\/\d+)(<\/td>)/g, (mm, a, oldVal, c) => `${a}${minmaxVals[cellIdx++]}${c}`);
      return p1 + newCells + p3;
    });

    return htSection;
  }

  let searchFrom = 0;
  let tableCount = 0;
  while (true) {
    const htStart = html.indexOf('<table class="hourly-table">', searchFrom);
    if (htStart === -1) break;
    const htEnd = html.indexOf('</table>', htStart) + '</table>'.length;
    const refreshed = refreshHourlySection(html.slice(htStart, htEnd));
    html = html.slice(0, htStart) + refreshed + html.slice(htEnd);
    searchFrom = htStart + refreshed.length;
    tableCount++;
  }
  if (tableCount !== 2) {
    throw new Error(`expected 2 hourly-table elements, found ${tableCount} — aborting to avoid corrupting the file`);
  }

  // ---- update the "YYYY-MM-DD(요일) 독일시간 HH시 MM분 기준(Open-Meteo, ...)" line ----
  const dateLine = `${todayBerlin}(${weekdayBerlin}) 독일시간 ${hourBerlin}시 ${minuteBerlin}분 기준(Open-Meteo 기상예보서비스)`;
  html = html.replace(/\d{4}-\d{2}-\d{2}[^<]*Open-Meteo[^<]*\)/, dateLine);

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`german-weather.html을 ${dateLine} 데이터로 갱신했습니다.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
