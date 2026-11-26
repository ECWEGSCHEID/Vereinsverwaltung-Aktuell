'use strict';

const courts = new Set(['Bahn 1', 'Bahn 2', 'Bahn 3', 'Bahn 4', 'Vereinsheim']);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const berlinClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function validDate(date) {
  if (typeof date !== 'string' || !datePattern.test(date)) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function validBooking(input, now = new Date()) {
  const {date, resource, timeFrom, timeTo} = input || {};
  if (!validDate(date) || !courts.has(resource) ||
      typeof timeFrom !== 'string' || !timePattern.test(timeFrom) ||
      typeof timeTo !== 'string' || !(timePattern.test(timeTo) || timeTo === '24:00') || timeFrom >= timeTo) return false;
  const parts = Object.fromEntries(berlinClock.formatToParts(now).map(({type, value}) => [type, value]));
  return date + ' ' + timeFrom >= parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;
}

function normalizedName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de') : '';
}

function overlaps(existing, requested, playerName, uid) {
  if (existing?.date !== requested.date ||
      !(requested.timeFrom < existing.timeTo && requested.timeTo > existing.timeFrom)) return false;
  if (existing.resource === requested.resource || existing.ownerUid === uid) return true;
  // Teilnehmer einer Vereinsheim-Buchung (z. B. Vorstandssitzung) blockieren keine Bahnen und umgekehrt.
  if (existing.resource === 'Vereinsheim' || requested.resource === 'Vereinsheim') return false;
  const participants = [existing.bookedBy];
  for (const team of [existing.homeTeam, existing.guestTeam]) {
    if (Array.isArray(team)) participants.push(...team);
  }
  const requestedPlayers = new Set([playerName, ...(requested.homeTeam || []), ...(requested.guestTeam || [])].map(normalizedName).filter(Boolean));
  return participants.some(name => requestedPlayers.has(normalizedName(name)));
}

module.exports = {validBooking, validDate, overlaps, normalizedName};
