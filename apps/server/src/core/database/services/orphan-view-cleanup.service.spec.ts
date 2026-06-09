import { OrphanViewCleanupService } from './orphan-view-cleanup.service';

describe('OrphanViewCleanupService', () => {
  let viewRepo: { hardDeleteOrphanedBefore: jest.Mock };
  let service: OrphanViewCleanupService;

  beforeEach(() => {
    viewRepo = { hardDeleteOrphanedBefore: jest.fn().mockResolvedValue(0) };
    service = new OrphanViewCleanupService(viewRepo as any);
  });

  it('hard-deletes views orphaned before a 7-day cutoff', async () => {
    const before = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await service.cleanupOrphanedViews();
    expect(viewRepo.hardDeleteOrphanedBefore).toHaveBeenCalledTimes(1);
    const cutoff: Date = viewRepo.hardDeleteOrphanedBefore.mock.calls[0][0];
    // within a couple seconds of now - 7d
    expect(Math.abs(cutoff.getTime() - before)).toBeLessThan(5000);
  });

  it('swallows repo errors so the interval keeps running', async () => {
    viewRepo.hardDeleteOrphanedBefore.mockRejectedValue(new Error('boom'));
    await expect(service.cleanupOrphanedViews()).resolves.toBeUndefined();
  });
});
