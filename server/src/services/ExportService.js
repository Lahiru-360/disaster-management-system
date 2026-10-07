import { ReportExport as ReportExportModel } from '../models/ReportExport.js';
import { ApiError } from '../utils/ApiError.js';
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
// E3: when the file can't be written (500 EXPORT_FAILED) or uploaded (502
// STORAGE_UNAVAILABLE), nothing is recorded, so the same request can simply be
// sent again while the report stays on screen.
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
   * @throws {ApiError} 404 NOT_FOUND, or for E3 500 EXPORT_FAILED / 502 STORAGE_UNAVAILABLE
   */
  async generateFile(officer, reportId, format) {
    const report = await this.#reportService.findById(reportId);
    const exporter = this.#exporterFor(format);

    const file = await ExportService.#write(exporter, report);
    const fileUrl = await this.#upload(file, exporter.mimeType);

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

  // E3.1: whatever stopped the exporter, the officer can only try again.
  static async #write(exporter, report) {
    try {
      return await exporter.write(report);
    } catch {
      throw new ApiError(
        500,
        'EXPORT_FAILED',
        'The export file could not be created. Please try again.',
      );
    }
  }

  // StorageService already answers 502 STORAGE_UNAVAILABLE; any other
  // storage failure is given the same code, since it is just as safe to retry.
  async #upload(file, mimeType) {
    try {
      return await this.#storage.storeFile(file, mimeType, ExportService.FOLDER);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(
        502,
        'STORAGE_UNAVAILABLE',
        'Could not upload the file. Please try again.',
      );
    }
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
