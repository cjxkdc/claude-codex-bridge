export function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
