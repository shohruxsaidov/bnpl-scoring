// One line of a fiscal receipt. Mirrors params.items[] in integration-docs/epos-api.md.
//
// classCode (ИКПУ) and packageCode are optional — EPOS accepts a line without
// them, and they are omitted rather than sent as null.
//
// `label` is a single marking code (markirovka). A labeled product bought in
// quantity 3 carries three distinct codes, so it becomes three lines of
// amount: 1 — not one line of amount: 3.
//
// `vat` is not an input: it is derived from price × amount and vatPercent by
// extractVat, so the sum on the receipt cannot disagree with the rate on it.
export interface CreateReceiptLine {
  /** Per-unit price in som, e.g. "1000.00". Converted to tiyin for EPOS. */
  price: string;
  name: string;
  vatPercent: number;
  /** Units on this line. Always 1 for labeled products. */
  amount: number;
  classCode?: string;
  packageCode?: string;
  label?: string;
}

export interface CreateReceiptCommand {
  products: CreateReceiptLine[];
}
