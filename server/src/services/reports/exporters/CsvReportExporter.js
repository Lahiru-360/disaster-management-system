import { ExportFormat } from '../../../enums/ExportFormat.js';
import { ReportSectionKey } from '../../../enums/ReportSectionKey.js';
import { ReportExporter } from '../ReportExporter.js';

// Writes a post-event report as one long CSV table for spreadsheets (§14.8):
// one row per data point, the summary figures first and then each section in
// report order. A day inside a gap keeps its row, with an empty value and
// incomplete=true, so a missing day is never read as 0.
export class CsvReportExporter extends ReportExporter {
  static #HEADER = ['section', 'date', 'district', 'item', 'measure', 'value', 'incomplete'];

  // Spreadsheets read UTF-8 (the en dashes in names) only with a byte-order mark.
  static #BOM = '﻿';

  static #SECTION_ROWS = {
    [ReportSectionKey.ALERT_TIMELINE]: (result, add) => {
      result.entries.forEach((entry) => {
        const item = `${entry.alert.referenceNo} v${entry.version} ${entry.status}`;
        add({ date: entry.date, item, measure: 'at', value: entry.at });
        add({ date: entry.date, item, measure: 'hazardType', value: entry.hazardType });
        add({ date: entry.date, item, measure: 'severity', value: entry.severity });
        add({
          date: entry.date,
          item,
          measure: 'areas',
          value: entry.areas.map((area) => area.name).join('; '),
        });
      });
      result.days.forEach((day) => add({ date: day.date, measure: 'entries', value: day.entries }));
    },

    [ReportSectionKey.CITIZENS_REACHED]: (result, add) => {
      result.perChannel.forEach((row) =>
        ['attempted', 'delivered', 'failed', 'deliveryRate'].forEach((measure) =>
          add({ item: row.channel, measure, value: row[measure] }),
        ),
      );
      result.perAlert.forEach((row) => {
        const { referenceNo } = row.alert;
        add({ item: referenceNo, measure: 'citizensReached', value: row.citizensReached });
        row.perChannel.forEach((channel) =>
          ['attempted', 'delivered'].forEach((measure) =>
            add({ item: `${referenceNo} ${channel.channel}`, measure, value: channel[measure] }),
          ),
        );
      });
      result.days.forEach((day) =>
        ['attempted', 'delivered'].forEach((measure) =>
          add({ date: day.date, measure, value: day[measure] }),
        ),
      );
    },

    [ReportSectionKey.OCCUPANCY_OVER_TIME]: (result, add) => {
      result.districts.forEach((row) =>
        row.days.forEach((day) =>
          add({ date: day.date, district: row.district?.name, measure: 'peak', value: day.peak }),
        ),
      );
      result.districts.forEach((row) =>
        add({
          date: row.peak?.date,
          district: row.district?.name,
          measure: 'highestPeak',
          value: row.peak?.value,
        }),
      );
    },

    [ReportSectionKey.RESOURCE_DISTRIBUTION]: (result, add) => {
      result.rows.forEach((row) =>
        add({
          district: row.district?.name,
          item: `${row.supplyType} – ${row.organisation?.name ?? ''}`,
          measure: 'quantity',
          value: row.quantity,
        }),
      );
      result.days.forEach((day) =>
        add({ date: day.date, measure: 'quantity', value: day.quantity }),
      );
    },
  };

  get format() {
    return ExportFormat.CSV;
  }

  get mimeType() {
    return 'text/csv';
  }

  /**
   * The report as CSV text in the §14.8 layout.
   * @param {object} report the report object (§14.2)
   * @returns {Promise<Buffer>} UTF-8 with a byte-order mark, CRLF line ends
   */
  async write(report) {
    const gapDays = this.gapDaysOf(report);
    const rows = [];

    this.figuresOf(report).forEach(({ figure, section }) =>
      rows.push({
        section: 'summary',
        date: figure === 'peakOccupancy' ? report.summary.peakOccupancyDate : null,
        measure: figure,
        value: report.summary[figure],
        incomplete: gapDays.get(section).size > 0,
      }),
    );

    report.sections.forEach(({ key, result }) =>
      CsvReportExporter.#SECTION_ROWS[key](result, (row) =>
        rows.push({ ...row, section: key, incomplete: gapDays.get(key).has(row.date) }),
      ),
    );

    const lines = [
      CsvReportExporter.#HEADER,
      ...rows.map((row) => CsvReportExporter.#HEADER.map((column) => row[column])),
    ].map((cells) => cells.map(CsvReportExporter.#cell).join(','));
    return Buffer.from(`${CsvReportExporter.#BOM}${lines.join('\r\n')}\r\n`, 'utf8');
  }

  // A value as one CSV field: empty for no value, quoted when it holds a
  // comma, a quote or a line break (RFC 4180).
  static #cell(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
}
