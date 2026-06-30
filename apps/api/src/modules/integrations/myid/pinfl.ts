export function parsePinflBirthDate(pinfl: string): string {
  const c = parseInt(pinfl[0]!, 10);
  const day = pinfl.slice(1, 3);
  const month = pinfl.slice(3, 5);
  const year2 = parseInt(pinfl.slice(5, 7), 10);

  let century: number;
  if (c <= 2) century = 1800;
  else if (c <= 4) century = 1900;
  else century = 2000;

  const year = century + year2;
  return `${year}-${month}-${day}`;
}
