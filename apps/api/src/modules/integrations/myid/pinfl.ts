/**
 * PINFL format: [C][DD][MM][YY][SSSSS][K]  (14 digits)
 * C = century+gender indicator:
 *   1=male 1800s, 2=female 1800s
 *   3=male 1900s, 4=female 1900s
 *   5=male 2000s, 6=female 2000s
 */
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

export function parsePinflGender(pinfl: string): "male" | "female" {
  return parseInt(pinfl[0]!, 10) % 2 === 1 ? "male" : "female";
}
