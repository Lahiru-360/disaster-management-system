import PDFDocument from 'pdfkit';
import { ExportFormat } from '../../../enums/ExportFormat.js';
import { ReportSectionKey } from '../../../enums/ReportSectionKey.js';
import { ReportExporter } from '../ReportExporter.js';

// Writes a post-event report as an A4 PDF for reading (§14.8): a title page,
// then the incomplete-data banner, the summary figures and one table per
// requested section. A day with no records reads "no data", never 0.
export class PdfReportExporter extends ReportExporter {
  static #MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  // Sri Lanka keeps UTC+05:30 all year (§14.1).
  static #OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

  static #NO_DATA = 'no data';

  // The PDF's own few colours: it has no access to the web's design tokens.
  static #COLOURS = { muted: '#555555', warning: '#8a4b00', headerFill: '#e8ecf1' };

  static #SECTION_TITLES = {
    [ReportSectionKey.ALERT_TIMELINE]: 'Alert timeline',
    [ReportSectionKey.CITIZENS_REACHED]: 'Citizens reached',
    [ReportSectionKey.OCCUPANCY_OVER_TIME]: 'Occupancy over time',
    [ReportSectionKey.RESOURCE_DISTRIBUTION]: 'Resource distribution',
  };

  static #NUMBER = new Intl.NumberFormat('en-US');

  get format() {
    return ExportFormat.PDF;
  }

  get mimeType() {
    return 'application/pdf';
  }

  /**
   * The report as a PDF document.
   * @param {object} report the report object (§14.2)
   * @returns {Promise<Buffer>}
   */
  async write(report) {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: PdfReportExporter.#title(report), Author: 'Disaster Management System' },
    });
    const finished = new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    PdfReportExporter.#titlePage(doc, report);
    doc.addPage();
    PdfReportExporter.#banner(doc, report);
    this.#summary(doc, report);
    report.sections.forEach(({ key, result }) => {
      PdfReportExporter.#heading(doc, PdfReportExporter.#SECTION_TITLES[key]);
      PdfReportExporter.#SECTION_TABLES[key](doc, result);
    });

    doc.end();
    return finished;
  }

  // --- Page parts ---

  static #titlePage(doc, report) {
    const districts = report.districts.map((district) => district.name);
    doc.moveDown(6).font('Helvetica-Bold').fontSize(24).text(PdfReportExporter.#title(report));
    doc.moveDown(1.5).font('Helvetica').fontSize(13);
    [
      ['Hazard type', PdfReportExporter.#words(report.event.hazardType)],
      ['Period', PdfReportExporter.#range(report.dateFrom, report.dateTo)],
      [`${districts.length} district${districts.length === 1 ? '' : 's'}`, districts.join(', ')],
      [
        'Generated',
        `${PdfReportExporter.#moment(report.generatedAt)} (Sri Lanka time)` +
          (report.generatedBy ? ` by ${report.generatedBy.name}` : ''),
      ],
    ].forEach(([label, value]) =>
      doc
        .font('Helvetica-Bold')
        .text(`${label}: `, { continued: true })
        .font('Helvetica')
        .text(value)
        .moveDown(0.4),
    );
  }

  static #banner(doc, report) {
    if (report.gaps.length === 0) {
      return;
    }
    doc.font('Helvetica-Bold').fontSize(11).fillColor(PdfReportExporter.#COLOURS.warning);
    report.gaps.forEach((gap) =>
      doc.text(
        `(!) ${PdfReportExporter.#range(gap.from, gap.to, { year: false })}: incomplete data – ` +
          `figures partial, not omitted (${PdfReportExporter.#SECTION_TITLES[gap.section].toLowerCase()})`,
      ),
    );
    doc.fillColor('black').moveDown();
  }

  #summary(doc, report) {
    const { summary } = report;
    const shown = new Set(this.figuresOf(report).map(({ figure }) => figure));
    const rows = [];
    if (shown.has('alertsIssued')) {
      rows.push(['Alerts issued', PdfReportExporter.#count(summary.alertsIssued)]);
    }
    if (shown.has('citizensReached')) {
      const rate =
        summary.reachedRate === null ? '' : ` (${PdfReportExporter.#percent(summary.reachedRate)})`;
      rows.push([
        'Citizens reached',
        `${PdfReportExporter.#count(summary.citizensReached)}${rate} of ` +
          `${PdfReportExporter.#count(summary.citizensTargeted)} targeted`,
      ]);
    }
    if (shown.has('peakOccupancy')) {
      rows.push([
        'Peak occupancy',
        summary.peakOccupancy === null
          ? PdfReportExporter.#NO_DATA
          : `${PdfReportExporter.#count(summary.peakOccupancy)} ` +
            `(${PdfReportExporter.#range(summary.peakOccupancyDate, summary.peakOccupancyDate)})`,
      ]);
    }
    if (shown.has('itemsDistributed')) {
      rows.push(['Items distributed', PdfReportExporter.#count(summary.itemsDistributed)]);
    }
    PdfReportExporter.#heading(doc, 'Summary');
    PdfReportExporter.#table(doc, ['Figure', 'Value'], rows);
  }

  // One table per section, from the section's own result (§14.2).
  static #SECTION_TABLES = {
    [ReportSectionKey.ALERT_TIMELINE]: (doc, result) =>
      PdfReportExporter.#table(
        doc,
        ['When', 'Alert', 'Status', 'Ver.', 'Hazard', 'Severity', 'Areas'],
        result.entries.map((entry) => [
          PdfReportExporter.#moment(entry.at, { year: false }),
          entry.alert.referenceNo,
          entry.status,
          entry.version,
          PdfReportExporter.#words(entry.hazardType),
          PdfReportExporter.#words(entry.severity),
          entry.areas.map((area) => area.name).join(', '),
        ]),
      ),

    [ReportSectionKey.CITIZENS_REACHED]: (doc, result) => {
      PdfReportExporter.#table(
        doc,
        ['Channel', 'Attempted', 'Delivered', 'Failed', 'Delivery rate'],
        result.perChannel.map((row) => [
          row.channel,
          PdfReportExporter.#count(row.attempted),
          PdfReportExporter.#count(row.delivered),
          PdfReportExporter.#count(row.failed),
          row.deliveryRate === null ? '–' : PdfReportExporter.#percent(row.deliveryRate, 1),
        ]),
      );
      PdfReportExporter.#table(
        doc,
        ['Alert', 'Citizens reached', 'Push', 'SMS', 'Audible'],
        result.perAlert.map((row) => [
          row.alert.referenceNo,
          PdfReportExporter.#count(row.citizensReached),
          ...row.perChannel.map(
            (channel) =>
              `${PdfReportExporter.#count(channel.delivered)} / ${PdfReportExporter.#count(channel.attempted)}`,
          ),
        ]),
      );
      PdfReportExporter.#dailyTable(doc, result.days, ['Attempted', 'Delivered'], (day) => [
        day.attempted,
        day.delivered,
      ]);
    },

    [ReportSectionKey.OCCUPANCY_OVER_TIME]: (doc, result) => {
      const dates = result.districts[0]?.days.map((day) => day.date) ?? [];
      PdfReportExporter.#table(
        doc,
        ['Day', ...result.districts.map((row) => row.district?.name ?? '')],
        [
          ...dates.map((date, index) => [
            PdfReportExporter.#range(date, date, { year: false }),
            ...result.districts.map((row) =>
              PdfReportExporter.#countOrNoData(row.days[index].peak),
            ),
          ]),
          [
            'Highest',
            ...result.districts.map((row) =>
              row.peak === null
                ? PdfReportExporter.#NO_DATA
                : `${PdfReportExporter.#count(row.peak.value)} (${PdfReportExporter.#range(row.peak.date, row.peak.date, { year: false })})`,
            ),
          ],
        ],
      );
    },

    [ReportSectionKey.RESOURCE_DISTRIBUTION]: (doc, result) => {
      PdfReportExporter.#table(
        doc,
        ['District', 'Supply type', 'Organisation', 'Quantity'],
        [
          ...result.rows.map((row) => [
            row.district?.name ?? '',
            PdfReportExporter.#words(row.supplyType),
            row.organisation?.name ?? '',
            PdfReportExporter.#count(row.quantity),
          ]),
          ['Total', '', '', PdfReportExporter.#count(result.total)],
        ],
      );
      PdfReportExporter.#dailyTable(doc, result.days, ['Quantity'], (day) => [day.quantity]);
    },
  };

  static #dailyTable(doc, days, headers, valuesOf) {
    PdfReportExporter.#table(
      doc,
      ['Day', ...headers],
      days.map((day) => [
        PdfReportExporter.#range(day.date, day.date, { year: false }),
        ...valuesOf(day).map(PdfReportExporter.#countOrNoData),
      ]),
    );
  }

  static #heading(doc, text) {
    doc
      .moveDown()
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(text, doc.page.margins.left)
      .moveDown(0.3);
  }

  static #table(doc, headers, rows) {
    doc.font('Helvetica').fontSize(9);
    doc.table({
      position: { x: doc.page.margins.left },
      defaultStyle: { padding: 3, border: 0.5, borderColor: '#aaaaaa' },
      rowStyles: (index) =>
        index === 0
          ? {
              font: { src: 'Helvetica-Bold' },
              backgroundColor: PdfReportExporter.#COLOURS.headerFill,
            }
          : {},
      data: [headers, ...rows].map((row) => row.map((cell) => String(cell))),
    });
    doc.moveDown(0.8);
  }

  // --- Text ---

  static #title(report) {
    return `Post-Event Report – ${report.event.name}`;
  }

  // "FLOOD" -> "Flood", "HYGIENE_KITS" -> "Hygiene kits".
  static #words(value) {
    const text = String(value ?? '')
      .toLowerCase()
      .replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  static #count(value) {
    return value === null || value === undefined ? '–' : PdfReportExporter.#NUMBER.format(value);
  }

  static #countOrNoData(value) {
    return value === null || value === undefined
      ? PdfReportExporter.#NO_DATA
      : PdfReportExporter.#count(value);
  }

  static #percent(rate, digits = 0) {
    return `${(rate * 100).toFixed(digits)}%`;
  }

  // "2026-06-08".."2026-06-20" -> "8–20 Jun 2026"; one day -> "12 Jun 2026".
  static #range(from, to, { year = true } = {}) {
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
    const [toYear, toMonth, toDay] = to.split('-').map(Number);
    const month = (m) => PdfReportExporter.#MONTHS[m - 1];
    const tail = (y) => (year ? ` ${y}` : '');
    if (from === to) {
      return `${fromDay} ${month(fromMonth)}${tail(fromYear)}`;
    }
    if (fromYear === toYear && fromMonth === toMonth) {
      return `${fromDay}–${toDay} ${month(toMonth)}${tail(toYear)}`;
    }
    if (fromYear === toYear) {
      return `${fromDay} ${month(fromMonth)} – ${toDay} ${month(toMonth)}${tail(toYear)}`;
    }
    return `${fromDay} ${month(fromMonth)} ${fromYear} – ${toDay} ${month(toMonth)} ${toYear}`;
  }

  // An instant in Sri Lanka time: "7 Oct 2026, 14:30", or "8 Jun 06:30".
  static #moment(instant, { year = true } = {}) {
    const local = new Date(new Date(instant).getTime() + PdfReportExporter.#OFFSET_MS);
    const day = local.toISOString().slice(0, 10);
    const time = local.toISOString().slice(11, 16);
    const date = PdfReportExporter.#range(day, day, { year });
    return year ? `${date}, ${time}` : `${date} ${time}`;
  }
}
