interface ExpiryResult {
  valid: boolean;
  monthsUntilExpiry: number; // 0 = expires this month, negative = already expired
  monthsSinceCreated: number; // how many months since the card was issued
}

function checkExpiry(value: string, maxYears: number = 5): ExpiryResult {
  // Expecting "YYMM", e.g. "3006" => year 2030, month 06
  if (!/^\d{4}$/.test(value)) {
    return { valid: false, monthsUntilExpiry: 0, monthsSinceCreated: 0 };
  }

  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2));
  if (month < 1 || month > 12) {
    return { valid: false, monthsUntilExpiry: 0, monthsSinceCreated: 0 };
  }

  const now = new Date();
  const current = now.getFullYear() * 12 + (now.getMonth() + 1);
  const expiry = year * 12 + month;

  // card was created maxYears before it expires
  const created = expiry - maxYears * 12;

  const monthsUntilExpiry = expiry - current;
  const monthsSinceCreated = current - created;
  const valid = monthsUntilExpiry >= 0 && monthsUntilExpiry <= maxYears * 12;

  return { valid, monthsUntilExpiry, monthsSinceCreated };
}

const result = checkExpiry('3010'); // { valid: true, monthsUntilExpiry: 74, monthsSinceCreated: 0 }

console.log(result);
