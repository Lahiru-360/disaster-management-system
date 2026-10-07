import { ExportFormat } from '../../../src/enums/ExportFormat.js';
import { CsvReportExporter } from '../../../src/services/reports/exporters/CsvReportExporter.js';
import { PdfReportExporter } from '../../../src/services/reports/exporters/PdfReportExporter.js';
import { ReportExporter } from '../../../src/services/reports/ReportExporter.js';

// The ReportExporter strategy (DMS-154.3, contract §14.8) against a small
// hand-built report object (§14.2): 13-15 Jun over Colombo and Gampaha, with
// a one-day alert gap on 14 Jun and a two-day occupancy gap on 14-15 Jun.
const sampleReport = () => ({
  id: 'r-1',
  event: {
    id: 'e-kelani',
    name: 'Kelani basin floods',
    hazardType: 'FLOOD',
    startDate: '2026-06-08T00:00:00.000Z',
    endDate: '2026-06-20T00:00:00.000Z',
  },
  generatedBy: { id: 'u-1', name: 'Ruwan Jayasinghe' },
  generatedAt: new Date('2026-10-06T09:00:00.000Z'),
  dateFrom: '2026-06-13',
  dateTo: '2026-06-15',
  districts: [
    { id: 'd-col', name: 'Colombo' },
    { id: 'd-gam', name: 'Gampaha' },
  ],
  filters: { hazardType: null, districtId: null, organisationId: null },
  summary: {
    alertsIssued: 1,
    citizensReached: 2,
    citizensTargeted: 3,
    reachedRate: 2 / 3,
    peakOccupancy: 450,
    peakOccupancyDate: '2026-06-13',
    itemsDistributed: 40,
  },
  hasGaps: true,
  gaps: [
    { section: 'alertTimeline', from: '2026-06-14', to: '2026-06-14', reason: 'No alert records' },
    {
      section: 'occupancyOverTime',
      from: '2026-06-14',
      to: '2026-06-15',
      reason: 'No occupancy records',
    },
  ],
  sections: [
    {
      key: 'alertTimeline',
      result: {
        alerts: 1,
        entries: [
          {
            at: '2026-06-13T03:30:00.000Z',
            date: '2026-06-13',
            alert: { id: 'a-1', referenceNo: 'HA-0001' },
            status: 'BROADCAST',
            version: 1,
            hazardType: 'FLOOD',
            severity: 'HIGH',
            areas: [
              { kind: 'RiverBasin', id: 'b-kel', name: 'Kelani' },
              { kind: 'District', id: 'd-kal', name: 'Kalutara' },
            ],
          },
          {
            at: '2026-06-15T04:00:00.000Z',
            date: '2026-06-15',
            alert: { id: 'a-1', referenceNo: 'HA-0001' },
            status: 'CANCELLED',
            version: 2,
            hazardType: 'FLOOD',
            severity: 'HIGH',
            areas: [{ kind: 'RiverBasin', id: 'b-kel', name: 'Kelani' }],
          },
        ],
        days: [
          { date: '2026-06-13', entries: 1 },
          { date: '2026-06-14', entries: null },
          { date: '2026-06-15', entries: 1 },
        ],
      },
    },
    {
      key: 'citizensReached',
      result: {
        citizensReached: 2,
        citizensTargeted: 3,
        reachedRate: 2 / 3,
        perChannel: [
          { channel: 'PUSH', attempted: 4, delivered: 2, failed: 2, deliveryRate: 0.5 },
          { channel: 'SMS', attempted: 4, delivered: 3, failed: 1, deliveryRate: 0.75 },
          { channel: 'AUDIBLE', attempted: 0, delivered: 0, failed: 0, deliveryRate: null },
        ],
        perAlert: [
          {
            alert: { id: 'a-1', referenceNo: 'HA-0001' },
            citizensReached: 2,
            perChannel: [
              { channel: 'PUSH', attempted: 4, delivered: 2 },
              { channel: 'SMS', attempted: 4, delivered: 3 },
              { channel: 'AUDIBLE', attempted: 0, delivered: 0 },
            ],
          },
        ],
        days: [
          { date: '2026-06-13', attempted: 6, delivered: 4 },
          { date: '2026-06-14', attempted: 1, delivered: 0 },
          { date: '2026-06-15', attempted: 1, delivered: 1 },
        ],
      },
    },
    {
      key: 'occupancyOverTime',
      result: {
        districts: [
          {
            district: { id: 'd-col', name: 'Colombo' },
            days: [
              { date: '2026-06-13', peak: 450 },
              { date: '2026-06-14', peak: null },
              { date: '2026-06-15', peak: null },
            ],
            peak: { value: 450, date: '2026-06-13' },
          },
          {
            district: { id: 'd-gam', name: 'Gampaha' },
            days: [
              { date: '2026-06-13', peak: null },
              { date: '2026-06-14', peak: null },
              { date: '2026-06-15', peak: null },
            ],
            peak: null,
          },
        ],
      },
    },
    {
      key: 'resourceDistribution',
      result: {
        rows: [
          {
            district: { id: 'd-col', name: 'Colombo' },
            supplyType: 'WATER',
            organisation: { id: 'o-1', name: 'Sarvodaya, "Colombo"', type: 'NGO' },
            quantity: 40,
          },
        ],
        total: 40,
        days: [
          { date: '2026-06-13', quantity: 25 },
          { date: '2026-06-14', quantity: 10 },
          { date: '2026-06-15', quantity: 5 },
        ],
      },
    },
  ],
  createdAt: new Date('2026-10-06T09:00:00.000Z'),
});

// A report with only the named sections, their gaps and summary figures.
const withSections = (keys) => {
  const report = sampleReport();
  report.sections = report.sections.filter((section) => keys.includes(section.key));
  report.gaps = report.gaps.filter((gap) => keys.includes(gap.section));
  report.hasGaps = report.gaps.length > 0;
  return report;
};

const csvLines = async (report) => {
  const text = (await new CsvReportExporter().write(report)).toString('utf8');
  return text.replace(/^\uFEFF/, '').split('\r\n');
};

const pages = (pdf) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;

describe('ReportExporter', () => {
  class BareExporter extends ReportExporter {}

  it('DMS-154.3: is abstract, and a subclass must define format, mimeType and write', async () => {
    expect(() => new ReportExporter()).toThrow(/abstract/);

    const bare = new BareExporter();
    expect(() => bare.format).toThrow('BareExporter must define format');
    expect(() => bare.mimeType).toThrow('BareExporter must define mimeType');
    await expect(bare.write(sampleReport())).rejects.toThrow(
      'BareExporter must implement write(report)',
    );
  });

  it("DMS-154.3: figuresOf lists only the requested sections' summary figures, in view order", () => {
    const exporter = new BareExporter();

    expect(exporter.figuresOf(sampleReport()).map(({ figure }) => figure)).toEqual([
      'alertsIssued',
      'citizensReached',
      'citizensTargeted',
      'reachedRate',
      'peakOccupancy',
      'itemsDistributed',
    ]);
    expect(
      exporter.figuresOf(withSections(['resourceDistribution'])).map(({ figure }) => figure),
    ).toEqual(['itemsDistributed']);
  });

  it('DMS-154.3: gapDaysOf expands each gap into its days, by section', () => {
    const days = new BareExporter().gapDaysOf(sampleReport());

    expect([...days.get('alertTimeline')]).toEqual(['2026-06-14']);
    expect([...days.get('occupancyOverTime')]).toEqual(['2026-06-14', '2026-06-15']);
    expect(days.get('citizensReached').size).toBe(0);
  });
});

describe('CsvReportExporter', () => {
  it('DMS-154.3: writes text/csv for the CSV format', () => {
    const exporter = new CsvReportExporter();

    expect(exporter.format).toBe(ExportFormat.CSV);
    expect(exporter.mimeType).toBe('text/csv');
  });

  it('TC-19 Main 13: writes UTF-8 with a byte-order mark, the §14.8 header and CRLF line ends', async () => {
    const csv = await new CsvReportExporter().write(sampleReport());

    expect([...csv.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = csv.toString('utf8');
    expect(
      text.slice(1).startsWith('section,date,district,item,measure,value,incomplete\r\n'),
    ).toBe(true);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/\n/);
  });

  it('TC-19 Main 13: lists the summary first, flagging the figures of a section with gaps', async () => {
    const lines = await csvLines(sampleReport());

    expect(lines.slice(1, 7)).toEqual([
      'summary,,,,alertsIssued,1,true',
      'summary,,,,citizensReached,2,false',
      'summary,,,,citizensTargeted,3,false',
      `summary,,,,reachedRate,${2 / 3},false`,
      'summary,2026-06-13,,,peakOccupancy,450,true',
      'summary,,,,itemsDistributed,40,false',
    ]);
  });

  it('TC-19 Main 13: keeps every gap day as a row with an empty value and incomplete=true', async () => {
    const lines = await csvLines(sampleReport());

    expect(lines).toEqual(
      expect.arrayContaining([
        'alertTimeline,2026-06-13,,,entries,1,false',
        'alertTimeline,2026-06-14,,,entries,,true',
        'occupancyOverTime,2026-06-13,Colombo,,peak,450,false',
        'occupancyOverTime,2026-06-14,Colombo,,peak,,true',
        'occupancyOverTime,2026-06-15,Gampaha,,peak,,true',
        // Gampaha has no record on 13 Jun, but Colombo does: not a gap day.
        'occupancyOverTime,2026-06-13,Gampaha,,peak,,false',
      ]),
    );
  });

  it('DMS-154.3: writes one row per data point of each section, in report order', async () => {
    const lines = await csvLines(sampleReport());
    const ofSection = (section) =>
      lines
        .filter((line) => line.startsWith(`${section},`))
        .map((line) => line.slice(section.length + 1));

    expect(ofSection('alertTimeline').slice(0, 4)).toEqual([
      '2026-06-13,,HA-0001 v1 BROADCAST,at,2026-06-13T03:30:00.000Z,false',
      '2026-06-13,,HA-0001 v1 BROADCAST,hazardType,FLOOD,false',
      '2026-06-13,,HA-0001 v1 BROADCAST,severity,HIGH,false',
      '2026-06-13,,HA-0001 v1 BROADCAST,areas,Kelani; Kalutara,false',
    ]);
    expect(ofSection('citizensReached')).toEqual(
      expect.arrayContaining([
        ',,PUSH,deliveryRate,0.5,false',
        ',,AUDIBLE,deliveryRate,,false',
        ',,HA-0001,citizensReached,2,false',
        ',,HA-0001 SMS,delivered,3,false',
        '2026-06-14,,,attempted,1,false',
      ]),
    );
    expect(ofSection('occupancyOverTime').slice(-2)).toEqual([
      '2026-06-13,Colombo,,highestPeak,450,false',
      ',Gampaha,,highestPeak,,false',
    ]);
    expect(ofSection('resourceDistribution')[0]).toBe(
      ',Colombo,"WATER – Sarvodaya, ""Colombo""",quantity,40,false',
    );

    const sectionOrder = [...new Set(lines.slice(1, -1).map((line) => line.split(',')[0]))];
    expect(sectionOrder).toEqual([
      'summary',
      'alertTimeline',
      'citizensReached',
      'occupancyOverTime',
      'resourceDistribution',
    ]);
  });

  it('DMS-154.3: writes only the requested sections and their figures', async () => {
    const lines = await csvLines(withSections(['resourceDistribution']));

    expect(lines.slice(1, -1)).toEqual([
      'summary,,,,itemsDistributed,40,false',
      'resourceDistribution,,Colombo,"WATER – Sarvodaya, ""Colombo""",quantity,40,false',
      'resourceDistribution,2026-06-13,,,quantity,25,false',
      'resourceDistribution,2026-06-14,,,quantity,10,false',
      'resourceDistribution,2026-06-15,,,quantity,5,false',
    ]);
  });

  it('DMS-154.3: leaves the report as it was', async () => {
    const report = sampleReport();

    await new CsvReportExporter().write(report);

    expect(report).toEqual(sampleReport());
  });
});

describe('PdfReportExporter', () => {
  it('DMS-154.3: writes application/pdf for the PDF format', () => {
    const exporter = new PdfReportExporter();

    expect(exporter.format).toBe(ExportFormat.PDF);
    expect(exporter.mimeType).toBe('application/pdf');
  });

  it('TC-20 Main 13: writes a complete PDF with a title page and the report pages', async () => {
    const pdf = await new PdfReportExporter().write(sampleReport());

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pages(pdf)).toBeGreaterThanOrEqual(2);
  });

  it('DMS-154.3: writes a report with one section, no gaps and missing names', async () => {
    const report = withSections(['resourceDistribution']);
    report.generatedBy = null;
    report.districts = [{ id: 'd-col', name: 'Colombo' }];
    report.sections[0].result.rows[0].organisation = null;

    const pdf = await new PdfReportExporter().write(report);

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('DMS-154.3: writes a report whose occupancy has no data at all', async () => {
    const report = withSections(['occupancyOverTime', 'citizensReached']);
    report.summary.peakOccupancy = null;
    report.summary.peakOccupancyDate = null;
    report.summary.reachedRate = null;
    report.sections[1].result.districts = [];
    report.dateFrom = '2026-05-30';
    report.dateTo = '2027-01-02';

    const pdf = await new PdfReportExporter().write(report);

    expect(pages(pdf)).toBeGreaterThanOrEqual(2);
  });

  it('DMS-154.3: leaves the report as it was', async () => {
    const report = sampleReport();

    await new PdfReportExporter().write(report);

    expect(report).toEqual(sampleReport());
  });
});
