import * as Y from 'yjs';
import { PersistenceExtension } from './persistence.extension';

describe('PersistenceExtension database collab doc guards', () => {
  const pageRepo = { findById: jest.fn(), updatePage: jest.fn() };
  const aiQueue = { add: jest.fn() };
  const historyQueue = { add: jest.fn() };
  const notificationQueue = { add: jest.fn() };
  const collabHistory = { addContributors: jest.fn() };
  const transclusionService = {
    syncPageTransclusions: jest.fn(),
    syncPageReferences: jest.fn(),
  };

  const buildExtension = () =>
    new PersistenceExtension(
      pageRepo as any,
      {} as any,
      aiQueue as any,
      historyQueue as any,
      notificationQueue as any,
      collabHistory as any,
      transclusionService as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('onLoadDocument returns the fresh ydoc without loading page content for db docs', async () => {
    const ext = buildExtension();
    const document = new Y.Doc();

    const result = await ext.onLoadDocument({
      documentName: 'db.page-1',
      document,
    } as any);

    expect(pageRepo.findById).not.toHaveBeenCalled();
    expect(result).toBe(document);
  });

  it('onStoreDocument skips persistence and broadcast for db docs', async () => {
    const ext = buildExtension();
    const document = new Y.Doc();
    (document as any).broadcastStateless = jest.fn();

    await ext.onStoreDocument({
      documentName: 'db.page-1',
      document,
      context: { user: { id: 'u1' } },
    } as any);

    expect(pageRepo.findById).not.toHaveBeenCalled();
    expect(pageRepo.updatePage).not.toHaveBeenCalled();
    expect((document as any).broadcastStateless).not.toHaveBeenCalled();
    expect(aiQueue.add).not.toHaveBeenCalled();
    expect(historyQueue.add).not.toHaveBeenCalled();
  });

  it('onChange does not track contributors for db docs', async () => {
    const ext = buildExtension();

    await ext.onChange({
      documentName: 'db.page-1',
      context: { user: { id: 'u1' } },
    } as any);

    expect((ext as any).contributors.has('db.page-1')).toBe(false);
  });

  it('onChange still tracks contributors for page docs', async () => {
    const ext = buildExtension();

    await ext.onChange({
      documentName: 'page.page-1',
      context: { user: { id: 'u1' } },
    } as any);

    expect((ext as any).contributors.get('page.page-1')).toEqual(
      new Set(['u1']),
    );
  });
});
