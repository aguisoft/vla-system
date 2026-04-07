'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOfficeStore } from '@/stores/office.store';
import {
  PresenceUpdatePayload,
  UserJoinedPayload,
  UserLeftPayload,
  UserMovedPayload,
  StatusChangedPayload,
  ActivityFeedPayload,
  UserPresence,
  PresenceStatusEnum,
} from '@vla/shared';

export function useOfficeSocket() {
  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { updatePresence, removePresence, addActivityEvent, setConnected, setAllPresences } = useOfficeStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const socket = io(`${apiUrl}/office`, {
      withCredentials: true, // sends vla_token httpOnly cookie
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      setConnected(true);
      pingIntervalRef.current = setInterval(() => {
        socket.emit('office:ping');
      }, 30000);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    });

    socket.on('office:snapshot', ({ presence }: { presence: UserPresence[] }) => {
      // Use snapshot to seed/merge — preserves any offline users already in store
      setAllPresences(presence);
    });

    socket.on('office:presence_update', (payload: PresenceUpdatePayload) => {
      updatePresence(payload.userId, {
        status: payload.status,
        isCheckedIn: payload.isCheckedIn,
        currentZoneId: payload.currentZoneId,
        positionX: payload.positionX,
        positionY: payload.positionY,
        avatar: payload.avatar,
      });
    });

    socket.on('office:user_joined', (payload: UserJoinedPayload) => {
      updatePresence(payload.userId, {
        firstName: payload.firstName,
        lastName: payload.lastName,
        status: PresenceStatusEnum.AVAILABLE,
        isCheckedIn: true,
        currentZoneId: payload.currentZoneId,
        positionX: payload.positionX,
        positionY: payload.positionY,
        avatar: payload.avatar,
        lastActivityAt: new Date(payload.timestamp),
      });
    });

    socket.on('office:user_left', (payload: UserLeftPayload) => {
      // Mark offline instead of removing — user stays visible as faded in their home zone
      updatePresence(payload.userId, {
        isCheckedIn: false,
        status: PresenceStatusEnum.OFFLINE,
        currentZoneId: undefined,
        positionX: undefined,
        positionY: undefined,
      });
    });

    socket.on('office:user_moved', (payload: UserMovedPayload) => {
      updatePresence(payload.userId, {
        currentZoneId: payload.toZone,
        positionX: payload.positionX,
        positionY: payload.positionY,
      });
    });

    socket.on('office:status_changed', (payload: StatusChangedPayload) => {
      updatePresence(payload.userId, {
        status: payload.newStatus,
        statusMessage: payload.statusMessage,
      });
    });

    socket.on('office:activity_feed', (payload: ActivityFeedPayload) => {
      addActivityEvent(payload);
    });

    socketRef.current = socket;
  }, [updatePresence, removePresence, addActivityEvent, setConnected, setAllPresences]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
  }, []);

  const emitMove = useCallback((zoneId: string, positionX: number, positionY: number) => {
    socketRef.current?.emit('office:move', { zoneId, positionX, positionY });
  }, []);

  const emitChangeStatus = useCallback((status: PresenceStatusEnum, statusMessage?: string) => {
    socketRef.current?.emit('office:change_status', { status, statusMessage });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, emitMove, emitChangeStatus, socket: socketRef.current };
}
