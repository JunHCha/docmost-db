import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthenticationExtension } from './authentication.extension';
import { SpaceRole } from '../../common/helpers/types/permission';
import { JwtType } from '../../core/auth/dto/jwt-payload';

// DB view collab docs ride the same Hocuspocus auth as page docs: their
// document name is `db.<pageId>` (vs `page.<pageId>`), and getPageId returns
// the `.`-delimited tail either way. These tests pin that the permission
// machinery — page lookup, space role, page-level restrictions, readOnly — is
// reused unchanged for the `db.` prefix.
describe('AuthenticationExtension db.<pageId> permission reuse', () => {
  const tokenService = { verifyJwt: jest.fn() };
  const userRepo = { findById: jest.fn() };
  const pageRepo = { findById: jest.fn() };
  const spaceMemberRepo = { getUserSpaceRoles: jest.fn() };
  const pagePermissionRepo = { canUserEditPage: jest.fn() };

  const buildExtension = () =>
    new AuthenticationExtension(
      tokenService as any,
      userRepo as any,
      pageRepo as any,
      spaceMemberRepo as any,
      pagePermissionRepo as any,
    );

  const buildPayload = (overrides: Partial<any> = {}) =>
    ({
      documentName: 'db.page-1',
      token: 'collab-token',
      connectionConfig: { readOnly: false },
      ...overrides,
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenService.verifyJwt.mockResolvedValue({
      sub: 'user-1',
      workspaceId: 'ws-1',
    });
    userRepo.findById.mockResolvedValue({
      id: 'user-1',
      deactivatedAt: null,
      deletedAt: null,
    });
    pageRepo.findById.mockResolvedValue({
      id: 'page-1',
      spaceId: 'space-1',
      deletedAt: null,
    });
    spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([
      { role: SpaceRole.WRITER },
    ]);
    pagePermissionRepo.canUserEditPage.mockResolvedValue({
      hasAnyRestriction: false,
      canAccess: true,
      canEdit: true,
    });
  });

  it('resolves the page from the db.<pageId> doc name and verifies a collab token', async () => {
    const ext = buildExtension();
    const data = buildPayload();

    const result = await ext.onAuthenticate(data);

    // pageId is the tail after the prefix, not the whole document name.
    expect(pageRepo.findById).toHaveBeenCalledWith('page-1');
    expect(tokenService.verifyJwt).toHaveBeenCalledWith(
      'collab-token',
      JwtType.COLLAB,
    );
    expect(result).toEqual({
      user: { id: 'user-1', deactivatedAt: null, deletedAt: null },
    });
    // An editor keeps a writable connection.
    expect(data.connectionConfig.readOnly).toBe(false);
  });

  it('grants a space reader presence-only (readOnly) access', async () => {
    spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([
      { role: SpaceRole.READER },
    ]);
    const ext = buildExtension();
    const data = buildPayload();

    await ext.onAuthenticate(data);

    expect(data.connectionConfig.readOnly).toBe(true);
  });

  it('honours page-level restrictions: access without edit is readOnly', async () => {
    pagePermissionRepo.canUserEditPage.mockResolvedValue({
      hasAnyRestriction: true,
      canAccess: true,
      canEdit: false,
    });
    const ext = buildExtension();
    const data = buildPayload();

    await ext.onAuthenticate(data);

    expect(data.connectionConfig.readOnly).toBe(true);
  });

  it('denies a user with no space role on the resolved page', async () => {
    spaceMemberRepo.getUserSpaceRoles.mockResolvedValue([]);
    const ext = buildExtension();

    await expect(ext.onAuthenticate(buildPayload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects when the resolved page does not exist', async () => {
    pageRepo.findById.mockResolvedValue(null);
    const ext = buildExtension();

    await expect(ext.onAuthenticate(buildPayload())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(pageRepo.findById).toHaveBeenCalledWith('page-1');
  });
});
