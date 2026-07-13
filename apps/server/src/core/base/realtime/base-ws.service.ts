import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import { BASE_INBOUND_EVENTS, getBaseRoomName } from '../../../ws/ws.utils';
import { EventName } from '../../../common/events/event.contants';
import { BaseSocketEvent } from '../base-events';

// Resolved by BaseRealtimeBridge (ws.gateway) via ModuleRef. Handles the
// inbound base room protocol and relays service-emitted base events to
// the `base-${pageId}` room. Cross-instance fan-out rides the socket.io
// Redis adapter configured on the gateway server.
@Injectable()
export class BaseWsService {
  private readonly logger = new Logger(BaseWsService.name);
  private server: Server | null = null;

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly userRepo: UserRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  isBaseEvent(data: any): boolean {
    return typeof data?.operation === 'string' &&
      BASE_INBOUND_EVENTS.has(data.operation);
  }

  async handleInbound(client: Socket, data: any): Promise<void> {
    switch (data?.operation) {
      case 'base:subscribe':
        await this.subscribe(client, data?.pageId);
        break;
      case 'base:unsubscribe':
        if (typeof data?.pageId === 'string') {
          await client.leave(getBaseRoomName(data.pageId));
        }
        break;
      case 'base:presence':
      case 'base:presence:leave':
        // Presence broadcasting is not implemented in the fork yet.
        break;
    }
  }

  async handleDisconnect(_client: Socket): Promise<void> {
    // Rooms are cleaned up by socket.io on disconnect.
  }

  private async subscribe(client: Socket, pageId: unknown): Promise<void> {
    if (typeof pageId !== 'string') return;
    try {
      const userId: string | undefined = client.data?.userId;
      if (!userId) return;
      const page = await this.pageRepo.findById(pageId);
      if (!page || page.deletedAt || !page.isBase) return;
      const user = await this.userRepo.findById(userId, page.workspaceId);
      if (!user) return;
      const ability = await this.spaceAbility.createForUser(
        user as any,
        page.spaceId,
      );
      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) return;

      await client.join(getBaseRoomName(pageId));
      client.emit('message', {
        operation: 'base:subscribed',
        pageId,
        schemaVersion: page.baseSchemaVersion ?? 0,
      });
    } catch (err) {
      this.logger.debug(`base:subscribe failed: ${(err as any)?.message}`);
    }
  }

  @OnEvent(EventName.BASE_ROW_CREATED)
  @OnEvent(EventName.BASE_ROW_UPDATED)
  @OnEvent(EventName.BASE_ROW_DELETED)
  @OnEvent(EventName.BASE_ROWS_DELETED)
  @OnEvent(EventName.BASE_ROW_REORDERED)
  @OnEvent(EventName.BASE_ROWS_UPDATED)
  @OnEvent(EventName.BASE_PROPERTY_CREATED)
  @OnEvent(EventName.BASE_PROPERTY_UPDATED)
  @OnEvent(EventName.BASE_PROPERTY_DELETED)
  @OnEvent(EventName.BASE_PROPERTY_REORDERED)
  @OnEvent(EventName.BASE_VIEW_CREATED)
  @OnEvent(EventName.BASE_VIEW_UPDATED)
  @OnEvent(EventName.BASE_VIEW_DELETED)
  @OnEvent(EventName.BASE_SCHEMA_BUMPED)
  @OnEvent(EventName.BASE_FORMULA_RECOMPUTE_STARTED)
  @OnEvent(EventName.BASE_FORMULA_RECOMPUTE_COMPLETED)
  relay(payload: BaseSocketEvent): void {
    if (!this.server || !payload?.pageId) return;
    this.server
      .to(getBaseRoomName(payload.pageId))
      .emit('message', payload);
  }
}
