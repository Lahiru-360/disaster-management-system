// "Colombo", "Colombo and Gampaha", "Colombo, Gampaha and Kalutara".
export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
