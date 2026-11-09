// Civil device dates, distinct from absolute event instants.
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validDay(value) {
  if (typeof value !== 'string' || !/^(20\d{2})-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(+date) && dayKey(date) === value;
}
export function shiftDay(day, delta) {
  const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate()+delta); return dayKey(date);
}
