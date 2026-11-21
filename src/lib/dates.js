// Date.toISOString() always converts to UTC first — for anyone in a
// timezone ahead of UTC (Japan, Australia, most of Asia/Europe/Africa),
// local midnight on a given day is still the PREVIOUS day in UTC, so
// `.toISOString().slice(0,10)` silently reports the day before whatever
// was actually picked or computed. This reads the Date's own local
// year/month/day instead, so the string always matches what the device
// itself considers "today" (or whichever day was computed), regardless
// of UTC offset.
export function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function enumerateDates(start, end) {
  const dates = [];
  let cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(toISODateLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
