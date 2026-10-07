import { jest } from '@jest/globals';
import { ExportFormat } from '../../../src/enums/ExportFormat.js';
import { ExportService } from '../../../src/services/ExportService.js';
import { CsvReportExporter } from '../../../src/services/reports/exporters/CsvReportExporter.js';
import { PdfReportExporter } from '../../../src/services/reports/exporters/PdfReportExporter.js';
import { ApiError } from '../../../src/utils/ApiError.js';
import { FakeClock } from '../../helpers/FakeClock.js';

// ExportService (DMS-154.4, contract §14.8) with a fake report service, model,
// storage and exporters: it picks the exporter by format, uploads to reports/
// and records the export.
const NOW = '2026-10-07T09:30:00.000Z';
const report = { id: 'r-1', event: { name: 'Kelani basin floods' } };
const officer = { id: 'u-1' };

const fakeExporter = (format, mimeType) => ({
  format,
  mimeType,
  write: jest.fn(async () => Buffer.from(`${format} file`)),
});

const setup = ({ findById = async () => report } = {}) => {
  const csv = fakeExporter(ExportFormat.CSV, 'text/csv');
  const pdf = fakeExporter(ExportFormat.PDF, 'application/pdf');
  const deps = {
    reportService: { findById: jest.fn(findById) },
    exportModel: { create: jest.fn(async (fields) => ({ _id: 'x-1', ...fields })) },
    storage: { storeFile: jest.fn(async (file, mimeType, folder) => `https://files/${folder}/f`) },
    exporters: [pdf, csv],
    clock: new FakeClock(NOW),
  };
  return { service: new ExportService(deps), ...deps, csv, pdf };
};

describe('ExportService', () => {
  it('DMS-154.4: exports with the PDF and CSV exporters by default', () => {
    const exporters = ExportService.defaultExporters();

    expect(exporters).toHaveLength(2);
    expect(exporters[0]).toBeInstanceOf(PdfReportExporter);
    expect(exporters[1]).toBeInstanceOf(CsvReportExporter);
  });

  it.each([
    [ExportFormat.CSV, 'text/csv'],
    [ExportFormat.PDF, 'application/pdf'],
  ])(
    'TC-21 Main 13: writes a %s file with its exporter and uploads it to reports/ as %s',
    async (format, mimeType) => {
      const { service, storage, csv, pdf } = setup();
      const [used, unused] = format === ExportFormat.CSV ? [csv, pdf] : [pdf, csv];

      await service.generateFile(officer, 'r-1', format);

      expect(used.write).toHaveBeenCalledWith(report);
      expect(unused.write).not.toHaveBeenCalled();
      expect(storage.storeFile).toHaveBeenCalledWith(
        Buffer.from(`${format} file`),
        mimeType,
        'reports',
      );
    },
  );

  it('DMS-154.4: records the export with its report, format, file, officer and time', async () => {
    const { service, exportModel } = setup();

    const created = await service.generateFile(officer, 'r-1', ExportFormat.CSV);

    expect(exportModel.create).toHaveBeenCalledWith({
      report: 'r-1',
      format: 'CSV',
      fileUrl: 'https://files/reports/f',
      createdBy: 'u-1',
      createdAt: new Date(NOW),
    });
    expect(created).toEqual({
      exportId: 'x-1',
      format: 'CSV',
      fileUrl: 'https://files/reports/f',
      createdAt: new Date(NOW),
    });
  });

  it('TC-23 Main 12: an unknown report is 404, and nothing is written, uploaded or recorded', async () => {
    const { service, storage, exportModel, csv } = setup({
      findById: async () => {
        throw new ApiError(404, 'NOT_FOUND', 'Post-event report not found.');
      },
    });

    await expect(service.generateFile(officer, 'nope', ExportFormat.CSV)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(csv.write).not.toHaveBeenCalled();
    expect(storage.storeFile).not.toHaveBeenCalled();
    expect(exportModel.create).not.toHaveBeenCalled();
  });

  it('DMS-154.4: refuses a format no exporter is registered for', async () => {
    const { service, storage } = setup();

    await expect(service.generateFile(officer, 'r-1', 'XLSX')).rejects.toThrow(
      'No report exporter registered for XLSX',
    );
    expect(storage.storeFile).not.toHaveBeenCalled();
  });
});

describe('ExportService — E3 export failure', () => {
  it('TC-44 E3: an exporter that throws is 500 EXPORT_FAILED, and nothing is uploaded or recorded', async () => {
    const { service, storage, exportModel, csv } = setup();
    csv.write.mockRejectedValueOnce(new Error('font missing'));

    await expect(service.generateFile(officer, 'r-1', ExportFormat.CSV)).rejects.toMatchObject({
      status: 500,
      code: 'EXPORT_FAILED',
      message: 'The export file could not be created. Please try again.',
    });
    expect(storage.storeFile).not.toHaveBeenCalled();
    expect(exportModel.create).not.toHaveBeenCalled();
  });

  it("TC-45 E3: StorageService's 502 STORAGE_UNAVAILABLE passes through, and nothing is recorded", async () => {
    const { service, storage, exportModel } = setup();
    const down = new ApiError(
      502,
      'STORAGE_UNAVAILABLE',
      'Could not upload the file. Please try again.',
    );
    storage.storeFile.mockRejectedValueOnce(down);

    await expect(service.generateFile(officer, 'r-1', ExportFormat.PDF)).rejects.toBe(down);
    expect(exportModel.create).not.toHaveBeenCalled();
  });

  it('TC-45 E3: any other storage failure is answered as 502 STORAGE_UNAVAILABLE too', async () => {
    const { service, storage, exportModel } = setup();
    storage.storeFile.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(service.generateFile(officer, 'r-1', ExportFormat.PDF)).rejects.toMatchObject({
      status: 502,
      code: 'STORAGE_UNAVAILABLE',
      message: 'Could not upload the file. Please try again.',
    });
    expect(exportModel.create).not.toHaveBeenCalled();
  });

  it('TC-46 E3: retrying the same request after a failure exports the report', async () => {
    const { service, storage, exportModel } = setup();
    storage.storeFile.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(service.generateFile(officer, 'r-1', ExportFormat.CSV)).rejects.toThrow();

    const created = await service.generateFile(officer, 'r-1', ExportFormat.CSV);

    expect(created.exportId).toBe('x-1');
    expect(storage.storeFile).toHaveBeenCalledTimes(2);
    expect(exportModel.create).toHaveBeenCalledTimes(1);
  });
});
