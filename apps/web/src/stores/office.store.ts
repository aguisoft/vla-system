import { create } from 'zustand';
import {
  UserPresence,
  OfficeZone,
  PresenceStatusEnum,
  ActivityFeedPayload,
} from '@vla/shared';

interface OfficeLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  zones: OfficeZone[];
}

interface OfficeState {
  layout: OfficeLayout | null;
  presences: Map<string, UserPresence>;
  activityFeed: ActivityFeedPayload[];
  isCheckedIn: boolean;
  myStatus: PresenceStatusEnum;
  checkInStartTime: Date | null;
  isConnected: boolean;
  selectedUserId: string | null;

  setLayout: (layout: OfficeLayout) => void;
  setAllPresences: (presences: UserPresence[]) => void;
  updatePresence: (userId: string, data: Partial<UserPresence>) => void;
  removePresence: (userId: string) => void;
  addActivityEvent: (event: ActivityFeedPayload) => void;
  setCheckedIn: (value: boolean, startTime?: Date) => void;
  setMyStatus: (status: PresenceStatusEnum) => void;
  setConnected: (value: boolean) => void;
  setSelectedUser: (userId: string | null) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  layout: null,
  presences: new Map(),
  activityFeed: [],
  isCheckedIn: false,
  myStatus: PresenceStatusEnum.OFFLINE,
  checkInStartTime: null,
  isConnected: false,
  selectedUserId: null,

  setLayout: (layout) => set({ layout }),

  setAllPresences: (presences) =>
    set({ presences: new Map(presences.map((p) => [p.userId, p])) }),

  updatePresence: (userId, data) =>
    set((state) => {
      const updated = new Map(state.presences);
      const existing = updated.get(userId);
      if (existing) {
        const merged = { ...existing, ...data };
        // When going offline, restore currentZoneId to defaultZoneId so avatar stays in home dept
        if (data.isCheckedIn === false && !data.currentZoneId) {
          merged.currentZoneId = existing.defaultZoneId;
        }
        updated.set(userId, merged);
      } else {
        updated.set(userId, { userId, firstName: '', lastName: '', status: PresenceStatusEnum.OFFLINE, isCheckedIn: false, lastActivityAt: new Date(), ...data });
      }
      return { presences: updated };
    }),

  removePresence: (userId) =>
    set((state) => {
      const updated = new Map(state.presences);
      updated.delete(userId);
      return { presences: updated };
    }),

  addActivityEvent: (event) =>
    set((state) => ({
      activityFeed: [event, ...state.activityFeed].slice(0, 50),
    })),

  setCheckedIn: (value, startTime) =>
    set({ isCheckedIn: value, checkInStartTime: startTime ?? null, myStatus: value ? PresenceStatusEnum.AVAILABLE : PresenceStatusEnum.OFFLINE }),

  setMyStatus: (status) => set({ myStatus: status }),
  setConnected: (value) => set({ isConnected: value }),
  setSelectedUser: (userId) => set({ selectedUserId: userId }),
}));
