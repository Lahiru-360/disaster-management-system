import { ReportExport as ReportExportModel } from '../models/ReportExport.js';
import { systemClock } from '../utils/SystemClock.js';
import { CsvReportExporter } from './reports/exporters/CsvReportExporter.js';
import { PdfReportExporter } from './reports/exporters/PdfReportExporter.js';
import { postEventReportService as defaultReportService } from './PostEventReportService.js';
import { storageService as defaultStorageService } from './StorageService.js';

// UC04 steps 12-13 (contract §14.8): exports a stored post-event report as a
// file. It writes the file with the ReportExporter for the format, uploads it
// to storage and records a ReportExport. Each request is a new export, even of
// a format exported before: earlier files are kept as an audit trail.
//
// The exporters are injected, so a new format is one ReportExporter
// registered in the list, with no change here (Open/Closed).
export class ExportService {
  // The storage folder every export file goes in.
  static FOLDER = 'reports';

  #reportService;
  #exportModel;
  #storage;
  #exporters;
  #clock;

  constructor({
    reportService = defaultReportService,
    exportModel = ReportExportModel,
    storage = defaultStorageService,
    exporters = ExportService.defaultExporters(),
    clock = systemClock,
  } = {}) {
    this.#reportService = reportService;
    this.#exportModel = exportModel;
    this.#storage = storage;
    this.#exporters = new Map(exporters.map((exporter) => [exporter.format, exporter]));
    this.#clock = clock;
  }

  /** The PDF and CSV exporters (ExportFormat). */
  static defaultExporters() {
    return [new PdfReportExporter(), new CsvReportExporter()];
  }

  /**
   * Writes the report as a file in the format, uploads it and records the
   * export (§14.8). The report itself is only read.
   * @param {{ id: string }} officer the signed-in DMC or duty officer
   * @param {string} reportId
   * @param {string} format an ExportFormat
   * @returns {Promise<{ exportId: string, format: string, fileUrl: string, createdAt: Date }>}
   */
  async generateFile(officer, reportId, format) {
    const report = await this.#reportService.findById(reportId);
    const exporter = this.#exporterFor(format);

    const file = await exporter.write(report);
    const fileUrl = await this.#storage.storeFile(file, exporter.mimeType, ExportService.FOLDER);

    const saved = await this.#exportModel.create({
      report: report.id,
      format,
      fileUrl,
      createdBy: officer.id,
      createdAt: this.#clock.now(),
    });
    return {
      exportId: String(saved._id),
      format: saved.format,
      fileUrl: saved.fileUrl,
      createdAt: saved.createdAt,
    };
  }

  #exporterFor(format) {
    const exporter = this.#exporters.get(format);
    if (!exporter) {
      throw new Error(`No report exporter registered for ${format}`);
    }
    return exporter;
  }
}

export const exportService = new ExportService();
