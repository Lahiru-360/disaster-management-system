import { ClusterAssigner } from '../../../src/domain/reports/ClusterAssigner.js';

const at = (iso) => new Date(iso);
const match = (id, clusterId, submittedAt) => ({
  _id: id,
  clusterId,
  submittedAt: at(submittedAt),
});

describe('ClusterAssigner (UC02 A4)', () => {
  const assigner = new ClusterAssigner();

  it('Main 7: starts its own cluster when nothing matched', () => {
    expect(assigner.assign([], 'new')).toBe('new');
  });

  it('Main 7: treats a missing match list as no match', () => {
    expect(assigner.assign(undefined, 'new')).toBe('new');
  });

  it('A4 (TC-25): joins the cluster of the one match', () => {
    expect(assigner.assign([match('a', 'cluster-a', '2026-10-02T05:30:00Z')], 'new')).toBe(
      'cluster-a',
    );
  });

  it('A4 (TC-30): joins the cluster of the oldest match when several match', () => {
    const matches = [
      match('b', 'cluster-b', '2026-10-02T05:30:00Z'),
      match('a', 'cluster-a', '2026-10-02T04:15:00Z'),
      match('c', 'cluster-b', '2026-10-02T05:45:00Z'),
    ];

    expect(assigner.assign(matches, 'new')).toBe('cluster-a');
  });

  it('A4: takes the cluster of the oldest match, not the oldest match id', () => {
    const matches = [
      match('b', 'cluster-a', '2026-10-02T05:00:00Z'),
      match('c', 'cluster-c', '2026-10-02T05:10:00Z'),
    ];

    expect(assigner.assign(matches, 'new')).toBe('cluster-a');
  });

  it('A4: settles matches submitted at the same moment by the smaller id', () => {
    const matches = [
      match('66f9a0c1b2c3d4e5f6a7b802', 'cluster-2', '2026-10-02T05:00:00Z'),
      match('66f9a0c1b2c3d4e5f6a7b801', 'cluster-1', '2026-10-02T05:00:00Z'),
    ];

    expect(assigner.assign(matches, 'new')).toBe('cluster-1');
    expect(assigner.assign([...matches].reverse(), 'new')).toBe('cluster-1');
  });

  it('A4: puts the window start 2 hours before now', () => {
    expect(ClusterAssigner.windowStart(at('2026-10-02T06:00:00.000Z'))).toEqual(
      at('2026-10-02T04:00:00.000Z'),
    );
  });
});
