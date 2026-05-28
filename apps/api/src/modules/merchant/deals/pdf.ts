import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = path.join(__dirname, '../../../assets/fonts')
const FONT_REGULAR = path.join(FONTS_DIR, 'NotoSans-Regular.ttf')
const FONT_BOLD = path.join(FONTS_DIR, 'NotoSans-Bold.ttf')

// ---------------------------------------------------------------------------
// Hardcoded Finsum Nasiya company details (v1 — update via config later)
// ---------------------------------------------------------------------------
const COMPANY = {
  ru: {
    name: 'ООО "Finsum Nasiya"',
    address: 'г. Ташкент, Мирзо-Улугбекский р-н',
    stir: '—',
    nds: '—',
    account: '—',
    mfo: '—',
    bank: '—',
  },
  uz: {
    name: 'Finsum Nasiya MChJ',
    address: 'Toshkent sh., Mirzo-Ulug\'bek t.',
    stir: '—',
    nds: '—',
    account: '—',
    mfo: '—',
    bank: '—',
  },
}

const STRINGS = {
  ru: {
    appendixRef: (date: string) => `Приложение № 1 к Публичной оферте\nпоставки товара от ${date}`,
    titleLine1: 'Акт',
    titleLine2: 'приема-передачи товара',
    supplier: 'Поставщик:',
    address: 'Адрес:',
    inn: 'ИНН:',
    nds: 'Регистрационный код плательщика НДС:',
    account: 'Расчётный счет:',
    mfo: 'МФО банка:',
    buyer: 'Покупатель:',
    passport: 'Паспортные данные:',
    pinfl: 'ПИНФЛ:',
    section1: '1. Информация о покупке',
    thNum: '№',
    thShop: 'Магазин',
    thProduct: 'Наименование товара',
    thQty: 'Количество',
    thUnitPrice: 'Цена за единицу',
    thTotal: 'Стоимость',
    totalLabel: 'Итого:',
    section2: '2. Информация о расчетах по покупке товара с рассрочкой платежа',
    purchaseAmount: 'Сумма покупки:',
    installmentTotal: 'Сумма к оплате с рассрочкой:',
    duration: 'Срок рассрочки:',
    durationUnit: 'мес.',
    downPayment: 'Сумма предоплаты:',
    maxMonthly: 'Макс. ежемесячный платёж:',
    paymentDayLabel: 'Ежемесячная день/число платежа:',
    currency: 'сум',
    section3: '3. График платежей по рассрочке',
    thPayNum: '№',
    thDueDate: 'Дата погашения',
    thPayAmount: 'Сумма выплаты',
    thRemaining: 'Остаток долга',
    scheduleTotal: 'Итого:',
    note4: '4. Товар передан в соответствующем количестве и ассортименте.',
    note5: '5. Стороны не имеют взаимных претензий к качеству товара и (или) предоставленной услуге.',
    note6: '6. Настоящий Акт составлен в 2 (двух) экземплярах, имеющих равную юридическую силу.',
    signaturesTitle: 'Подписи Сторон',
    manager: 'Руководитель:',
    deliveredBy: 'Товар передал:',
    stamp1: 'ПЕРЕДАНО',
    acceptedBy: 'Принял:',
    stamp2: 'ПРИНЯЛ',
  },
  uz: {
    appendixRef: (date: string) => `Mahsulotni yetkazib berish bo'yicha\nOmmaviy ofertaga ${date} dagi Ilova`,
    titleLine1: 'Mahsulotni yetkazib berish bo\'yicha',
    titleLine2: 'Dalolatnomasi',
    supplier: 'Sotuvchi:',
    address: 'Manzil:',
    inn: 'STIR:',
    nds: 'QQS to\'lovchining registratsiya raqami:',
    account: 'Hisob raqami:',
    mfo: 'Bank MFO:',
    buyer: 'Xaridor:',
    passport: 'Pasport ma\'lumotlar:',
    pinfl: 'JShShIR:',
    section1: '1. Xarid haqida ma\'lumot',
    thNum: '№',
    thShop: 'Do\'kon',
    thProduct: 'Mahsulot nomi',
    thQty: 'Mahsulot soni',
    thUnitPrice: 'Har bir mahsulot narxi',
    thTotal: 'Miqdori',
    totalLabel: 'Umumiy:',
    section2: '2. Mahsulotni muddatli to\'lovga xarid qilish bo\'yicha hisob-kitob ma\'lumotlari',
    purchaseAmount: 'Xarid miqdori:',
    installmentTotal: 'Bo\'lib to\'lash uchun umumiy miqdor:',
    duration: 'To\'lov muddati:',
    durationUnit: 'oy',
    downPayment: 'Bosh to\'lov miqdori:',
    maxMonthly: 'Eng katta oylik to\'lov:',
    paymentDayLabel: 'Har oydagi to\'lov kuni:',
    currency: 'so\'m',
    section3: '3. To\'lov grafigi',
    thPayNum: '№',
    thDueDate: 'To\'lov kuni',
    thPayAmount: 'To\'lov miqdori',
    thRemaining: 'Qoldiq',
    scheduleTotal: 'Umumiy:',
    note4: '4. Mahsulot tegishli miqdor va sifatda yetkazib berildi.',
    note5: '5. Tomonlarning mahsulot va (yoki) xizmat ko\'rsatish sifatiga e\'tirozi yo\'q.',
    note6: '6. Ushbu Dalolatnoma har bir tomon uchun bittadan, bir xil yuridik kuchga ega 2 (ikki) nusxada tuzildi.',
    signaturesTitle: 'Tomonlarning imzosi',
    manager: 'Boshqaruvchi:',
    deliveredBy: 'Mahsulotni yetkazdi:',
    stamp1: 'TOPSHIRDI',
    acceptedBy: 'Qabul qildi:',
    stamp2: 'QABUL QILDI',
  },
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface KontraktData {
  dealId: string
  createdAt: Date
  clientFullName: string
  clientPinfl: string
  clientPassport: string
  agentName: string
  branchName: string
  merchantInn: string
  /** tiyin */
  amount: number
  /** tiyin */
  totalPayable: number
  termMonths: number
  paymentDay: number
  basket: Array<{
    productName: string
    quantity: number
    /** tiyin per unit */
    tanNarxi: number
  }>
  schedule: Array<{
    index: number
    dueDate: string
    /** tiyin */
    amount: number
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MARGIN = 40
const PAGE_W = 595.28
const CONTENT_W = PAGE_W - MARGIN * 2

function fmt(tiyin: number): string {
  return Math.round(tiyin / 100)
    .toLocaleString('ru-RU')
    .replace(/ /g, ' ')
}

function fmtDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function fmtDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${fmtDate(d)}, ${hh}:${min}`
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

function sectionTitle(doc: PDFKit.PDFDocument, text: string, y: number): number {
  doc.font('Bold').fontSize(9).fillColor('#1a1a1a')
  doc.text(text, MARGIN, y, { width: CONTENT_W })
  return doc.y + 4
}

function drawTable(
  doc: PDFKit.PDFDocument,
  y: number,
  colWidths: number[],
  headers: string[],
  rows: string[][],
  opts: { fontSize?: number; headerFontSize?: number; rowHeight?: number; colAlignments?: Array<'left' | 'center' | 'right'> } = {},
): number {
  const { fontSize = 8, headerFontSize = 7.5, rowHeight = 16, colAlignments } = opts
  const totalW = colWidths.reduce((a, b) => a + b, 0)
  const headerH = rowHeight + 1

  // Header background
  doc.save()
  doc.rect(MARGIN, y, totalW, headerH).fillAndStroke('#eeeeee', '#bbbbbb')
  doc.restore()

  // Header text
  doc.font('Bold').fontSize(headerFontSize).fillColor('#1a1a1a')
  let cx = MARGIN
  for (let i = 0; i < headers.length; i++) {
    const cw = colWidths[i] ?? 0
    doc.text(headers[i] ?? '', cx + 2, y + 3, { width: cw - 4, align: 'center', lineBreak: false })
    cx += cw
  }

  let curY = y + headerH

  // Rows
  doc.font('Regular').fontSize(fontSize).fillColor('#1a1a1a')
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri] ?? []
    const rowBg = ri % 2 === 1 ? '#fafafa' : '#ffffff'
    doc.save()
    doc.rect(MARGIN, curY, totalW, rowHeight).fillAndStroke(rowBg, '#cccccc')
    doc.restore()

    let cx2 = MARGIN
    for (let ci = 0; ci < row.length; ci++) {
      const cw = colWidths[ci] ?? 0
      const cell = row[ci] ?? ''
      const align: 'left' | 'center' | 'right' =
        colAlignments?.[ci] ?? (
          ci === 0 ? 'center'
          : ci === row.length - 1 ? 'right'
          : 'left'
        )
      doc.fillColor('#1a1a1a').text(cell, cx2 + 3, curY + 4, {
        width: cw - 6,
        align,
        lineBreak: false,
      })
      cx2 += cw
    }
    curY += rowHeight
  }

  // outer bottom border
  doc.save()
  doc.moveTo(MARGIN, curY).lineTo(MARGIN + totalW, curY).stroke('#cccccc')
  doc.restore()

  return curY + 8
}

function drawTotalRow(
  doc: PDFKit.PDFDocument,
  y: number,
  colWidths: number[],
  cells: string[],
  opts: { fontSize?: number; rowHeight?: number } = {},
): number {
  const { fontSize = 8, rowHeight = 16 } = opts
  const totalW = colWidths.reduce((a, b) => a + b, 0)

  doc.save()
  doc.rect(MARGIN, y, totalW, rowHeight).fillAndStroke('#f0f0f0', '#cccccc')
  doc.restore()

  doc.font('Bold').fontSize(fontSize).fillColor('#1a1a1a')
  let cx = MARGIN
  for (let i = 0; i < cells.length; i++) {
    const cw = colWidths[i] ?? 0
    const cell = cells[i] ?? ''
    const align: 'left' | 'center' | 'right' =
      i === 0 ? 'center'
      : i === cells.length - 1 ? 'right'
      : 'left'
    doc.text(cell, cx + 3, y + 4, { width: cw - 6, align, lineBreak: false })
    cx += cw
  }

  return y + rowHeight + 8
}

interface MergedCell {
  text: string
  width: number
  align?: 'left' | 'center' | 'right'
}

function drawMergedTotalRow(
  doc: PDFKit.PDFDocument,
  y: number,
  cells: MergedCell[],
  opts: { fontSize?: number; rowHeight?: number } = {},
): number {
  const { fontSize = 8, rowHeight = 16 } = opts
  const totalW = cells.reduce((s, c) => s + c.width, 0)

  doc.save()
  doc.rect(MARGIN, y, totalW, rowHeight).fillAndStroke('#f0f0f0', '#cccccc')
  doc.restore()

  doc.font('Bold').fontSize(fontSize).fillColor('#1a1a1a')
  let cx = MARGIN
  for (const cell of cells) {
    if (cell.text) {
      doc.text(cell.text, cx + 3, y + 4, {
        width: cell.width - 6,
        align: cell.align ?? 'left',
        lineBreak: false,
      })
    }
    cx += cell.width
  }

  return y + rowHeight + 8
}

function drawInfoRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
): number {
  const ROW_H = 14
  doc.save()
  doc.moveTo(x, y + ROW_H).lineTo(x + w, y + ROW_H).stroke('#e0e0e0')
  doc.restore()
  doc.font('Regular').fontSize(8.5).fillColor('#444444')
  doc.text(label, x, y + 2, { width: w * 0.65 - 4, lineBreak: false })
  doc.font('Bold').fillColor('#1a1a1a')
  doc.text(value, x + w * 0.65, y + 2, { width: w * 0.35 - 2, align: 'right', lineBreak: false })
  return y + ROW_H
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateKontrakt(data: KontraktData, lang: 'ru' | 'uz'): Promise<Buffer> {
  const t = STRINGS[lang]
  const co = COMPANY[lang]

  const qrBuffer = await QRCode.toBuffer('https://comfortnasiya.uz/offer', {
    width: 70,
    margin: 1,
    errorCorrectionLevel: 'M',
  })

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: true,
  })

  doc.registerFont('Regular', FONT_REGULAR)
  doc.registerFont('Bold', FONT_BOLD)

  const buffers: Buffer[] = []
  doc.on('data', (chunk: Buffer) => buffers.push(chunk))
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)
  })

  const docDate = fmtDate(data.createdAt)
  const docDateTime = fmtDateTime(data.createdAt)
  const docNumber = data.dealId.split('-')[0]?.toUpperCase() ?? data.dealId

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.image(qrBuffer, MARGIN, MARGIN, { width: 60, height: 60 })

  doc.font('Regular').fontSize(8).fillColor('#444444')
  doc.text(t.appendixRef(docDate), MARGIN + 65, MARGIN, { width: CONTENT_W - 65, align: 'right' })

  // ── Title ──────────────────────────────────────────────────────────────────
  let y = MARGIN + 68
  doc.font('Bold').fontSize(12).fillColor('#1a1a1a')
  doc.text(t.titleLine1, MARGIN, y, { width: CONTENT_W, align: 'center' })
  y = doc.y
  doc.text(t.titleLine2, MARGIN, y, { width: CONTENT_W, align: 'center' })
  y = doc.y
  doc.fontSize(13).text(`№ ${docNumber}`, MARGIN, y, { width: CONTENT_W, align: 'center' })
  y = doc.y + 4

  // ── Date ──────────────────────────────────────────────────────────────────
  doc.font('Regular').fontSize(10).fillColor('#1a1a1a')
  doc.text(docDate, MARGIN, y, { width: CONTENT_W, align: 'right' })
  y = doc.y + 6

  // ── Parties box ───────────────────────────────────────────────────────────
  const colW = (CONTENT_W - 16) / 2
  const partiesTop = y
  const pLines: Array<[string, string]> = [
    [t.supplier, co.name],
    [t.address, co.address],
    [t.inn, co.stir],
    [t.nds, co.nds],
    [t.account, co.account],
    [t.mfo, co.mfo !== '—' ? `${co.mfo} ${co.bank}` : '—'],
  ]
  const clientLines: Array<[string, string]> = [
    [t.buyer, data.clientFullName],
    [t.address, '—'],
    [t.passport, data.clientPassport],
    [t.pinfl, data.clientPinfl],
  ]
  const lineH = 13
  const partiesH = Math.max(pLines.length, clientLines.length) * lineH + 12

  doc.save()
  doc.rect(MARGIN, y, CONTENT_W, partiesH).stroke('#cccccc')
  doc.moveTo(MARGIN + colW + 8, y).lineTo(MARGIN + colW + 8, y + partiesH).stroke('#cccccc')
  doc.restore()

  const drawPartyLines = (lines: Array<[string, string]>, xOff: number) => {
    let ly = partiesTop + 5
    doc.fontSize(8.5)
    for (const [label, val] of lines) {
      doc.font('Bold').fillColor('#1a1a1a').text(label + ' ', xOff, ly, { continued: true, lineBreak: false, width: colW - 6 })
      doc.font('Regular').text(val, { lineBreak: false })
      ly += lineH
    }
  }
  drawPartyLines(pLines, MARGIN + 5)
  drawPartyLines(clientLines, MARGIN + colW + 13)

  y = partiesTop + partiesH + 8

  // ── Section 1 — Products table ────────────────────────────────────────────
  y = sectionTitle(doc, t.section1, y)

  const pColW = [20, 75, CONTENT_W - 20 - 75 - 42 - 80 - 80, 42, 80, 80]
  const pHeaders = [t.thNum, t.thShop, t.thProduct, t.thQty, t.thUnitPrice, t.thTotal]
  const pRows = data.basket.map((item, i) => [
    String(i + 1),
    data.branchName,
    item.productName,
    String(item.quantity),
    `${fmt(item.tanNarxi)} ${t.currency}`,
    `${fmt(item.tanNarxi * item.quantity)} ${t.currency}`,
  ])
  y = drawTable(doc, y, pColW, pHeaders, pRows, { fontSize: 8, rowHeight: 15 })

  const totalQty = data.basket.reduce((s, i) => s + i.quantity, 0)
  const grandTotal = data.basket.reduce((s, i) => s + i.tanNarxi * i.quantity, 0)
  y = drawMergedTotalRow(doc, y - 8, [
    { text: t.totalLabel, width: (pColW[0] ?? 0) + (pColW[1] ?? 0) + (pColW[2] ?? 0), align: 'center' },
    { text: String(totalQty), width: pColW[3] ?? 0, align: 'center' },
    { text: '', width: pColW[4] ?? 0 },
    { text: `${fmt(grandTotal)} ${t.currency}`, width: pColW[5] ?? 0, align: 'right' },
  ], { rowHeight: 15 })

  // ── Section 2 — Payment info ──────────────────────────────────────────────
  y = sectionTitle(doc, t.section2, y)

  const halfW = (CONTENT_W - 16) / 2
  const maxMonthly = Math.round(data.totalPayable / data.termMonths)
  const leftRows: Array<[string, string]> = [
    [t.purchaseAmount, `${fmt(data.amount)} ${t.currency}`],
    [t.installmentTotal, `${fmt(data.totalPayable)} ${t.currency}`],
    [t.duration, `${data.termMonths} ${t.durationUnit}`],
  ]
  const rightRows: Array<[string, string]> = [
    [t.downPayment, `0 ${t.currency}`],
    [t.maxMonthly, `${fmt(maxMonthly)} ${t.currency}`],
    [t.paymentDayLabel, String(data.paymentDay)],
  ]

  const infoTop = y
  let leftY = infoTop
  for (const [label, val] of leftRows) {
    leftY = drawInfoRow(doc, MARGIN, leftY, halfW, label, val)
  }
  let rightY = infoTop
  for (const [label, val] of rightRows) {
    rightY = drawInfoRow(doc, MARGIN + halfW + 16, rightY, halfW, label, val)
  }
  y = Math.max(leftY, rightY) + 8

  // ── Section 3 — Schedule ──────────────────────────────────────────────────
  y = sectionTitle(doc, t.section3, y)

  const sColFixed = 28 + 120
  const sColMoney = (CONTENT_W - sColFixed) / 2
  const sColW = [28, 120, sColMoney, sColMoney]
  const sHeaders = [t.thPayNum, t.thDueDate, t.thPayAmount, t.thRemaining]

  let remaining = data.totalPayable
  const scheduleRows = data.schedule.map((row) => {
    remaining -= row.amount
    return [
      String(row.index),
      fmtDate(row.dueDate),
      `${fmt(row.amount)} ${t.currency}`,
      `${fmt(remaining)} ${t.currency}`,
    ]
  })

  // Opening balance row
  const initRow = ['', '', `0 ${t.currency}`, `${fmt(data.totalPayable)} ${t.currency}`]

  y = drawTable(doc, y, sColW, sHeaders, [initRow, ...scheduleRows], {
    fontSize: 8.5,
    rowHeight: 14,
    colAlignments: ['center', 'left', 'right', 'right'],
  })
  y = drawMergedTotalRow(doc, y - 8, [
    { text: t.scheduleTotal, width: (sColW[0] ?? 0) + (sColW[1] ?? 0), align: 'right' },
    { text: `${fmt(data.totalPayable)} ${t.currency}`, width: sColW[2] ?? 0, align: 'right' },
    { text: '', width: sColW[3] ?? 0 },
  ], { rowHeight: 14 })

  // ── Notes ─────────────────────────────────────────────────────────────────
  doc.font('Regular').fontSize(8.5).fillColor('#1a1a1a')
  doc.text(t.note4, MARGIN, y, { width: CONTENT_W })
  doc.text(t.note5, MARGIN, doc.y, { width: CONTENT_W })
  doc.text(t.note6, MARGIN, doc.y, { width: CONTENT_W })
  y = doc.y + 10

  // ── Signatures ────────────────────────────────────────────────────────────
  doc.save()
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).stroke('#cccccc')
  doc.restore()
  y += 8

  doc.font('Bold').fontSize(10).fillColor('#1a1a1a')
  doc.text(t.signaturesTitle, MARGIN, y, { width: CONTENT_W, align: 'center' })
  y = doc.y + 6

  const sigW = CONTENT_W / 2 - 10
  const stampW = 140
  const sigLineH = 14
  const sigTop = y

  // ── Left signature block ───────────────────────────────────────────────────
  doc.font('Regular').fontSize(8.5).fillColor('#1a1a1a')
  const mgrLabelW = doc.widthOfString(t.manager + ' ')
  doc.text(t.manager + ' ', MARGIN, sigTop, { lineBreak: false })
  doc.font('Bold').text(data.agentName, MARGIN + mgrLabelW, sigTop, {
    lineBreak: false,
    width: sigW - mgrLabelW,
  })

  doc.font('Regular').fontSize(8).fillColor('#555555')
  doc.text(
    `${t.deliveredBy} ${data.branchName} (${data.merchantInn})`,
    MARGIN,
    sigTop + sigLineH,
    { width: sigW },
  )

  const stampY = sigTop + sigLineH * 2 + 6
  doc.save()
  doc.rect(MARGIN, stampY, stampW, 36).stroke('#e67e00')
  doc.restore()
  doc.font('Regular').fontSize(7.5).fillColor('#555555')
  doc.text(docDateTime, MARGIN + 4, stampY + 4, { width: stampW - 8, align: 'center' })
  doc.font('Bold').fontSize(10).fillColor('#e67e00')
  doc.text(t.stamp1, MARGIN + 4, stampY + 18, { width: stampW - 8, align: 'center', characterSpacing: 2 })

  // ── Right signature block ──────────────────────────────────────────────────
  const rSigX = MARGIN + CONTENT_W / 2 + 10
  doc.font('Regular').fontSize(8.5).fillColor('#1a1a1a')
  const acceptLabelW = doc.widthOfString(t.acceptedBy + ' ')
  doc.text(t.acceptedBy + ' ', rSigX, sigTop, { lineBreak: false })
  doc.font('Bold').text(data.clientFullName, rSigX + acceptLabelW, sigTop, {
    lineBreak: false,
    width: sigW - acceptLabelW,
  })

  const rStampX = MARGIN + CONTENT_W - stampW
  doc.save()
  doc.rect(rStampX, stampY, stampW, 36).stroke('#28a745')
  doc.restore()
  doc.font('Regular').fontSize(7.5).fillColor('#555555')
  doc.text(docDateTime, rStampX + 4, stampY + 4, { width: stampW - 8, align: 'center' })
  doc.font('Bold').fontSize(10).fillColor('#28a745')
  doc.text(t.stamp2, rStampX + 4, stampY + 18, { width: stampW - 8, align: 'center', characterSpacing: 2 })

  doc.end()
  return done
}
