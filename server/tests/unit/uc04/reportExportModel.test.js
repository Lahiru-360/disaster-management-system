import mongoose from 'mongoose';
import { ExportFormat } from '../../../src/enums/ExportFormat.js';
import { ReportExport } from '../../../src/models/ReportExport.js';

const exportFields = (fields = {}) => ({
  report: new mongoose.Types.ObjectId(),
  format: ExportFormat.PDF,
  fileUrl: 'https://files/reports/0b6f3c1e.pdf',
  createdBy: new mongoose.Types.ObjectId(),
  ...fields,
});

// The messages Mongoose collected, by path, or {} when the document is valid.
const errorsOf = async (doc) => {
  try {
    await doc.validate();
    return {};
  } catch (err) {
    return Object.fromEntries(Object.entries(err.errors).map(([path, e]) => [path, e.message]));
  }
};

describe('ExportFormat', () => {
  it('DMS-154.2: is PDF or CSV, and is frozen', () => {
    expect(Object.values(ExportFormat)).toEqual(['PDF', 'CSV']);
    expect(Object.isFrozen(ExportFormat)).toBe(true);
  });
});

describe('ReportExport model', () => {
  it('DMS-154.2: stores an export with a createdAt and no updatedAt', async () => {
    const saved = await ReportExport.create(exportFields());

    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeUndefined();
    expect(saved.toJSON()).toEqual(
      expect.objectContaining({ id: saved._id, format: 'PDF', fileUrl: expect.any(String) }),
    );
    expect(saved.toJSON()).not.toHaveProperty('_id');
    expect(saved.toJSON()).not.toHaveProperty('__v');
  });

  it('DMS-154.2: keeps the createdAt it is given, so the service clock decides it', async () => {
    const createdAt = new Date('2026-10-07T09:30:00.000Z');

    const saved = await ReportExport.create(exportFields({ createdAt }));

    expect(saved.createdAt).toEqual(createdAt);
  });

  it('DMS-154.2: needs a report, a format, a file URL and the officer', async () => {
    const errors = await errorsOf(new ReportExport({}));

    expect(Object.keys(errors).sort()).toEqual(['createdBy', 'fileUrl', 'format', 'report']);
  });

  it('DMS-154.2: refuses a format that is not an ExportFormat', async () => {
    const errors = await errorsOf(new ReportExport(exportFields({ format: 'XLSX' })));

    expect(Object.keys(errors)).toEqual(['format']);
  });
});
