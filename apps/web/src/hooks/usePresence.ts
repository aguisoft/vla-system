'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOfficeStore } from '@/stores/office.store';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { PresenceStatusEnum } from '@vla/shared';

export function usePresence() {
  const { user } = useAuthStore();
  const { isCheckedIn, myStatus, checkInStartTime, setCheckedIn, setMyStatus } = useOfficeStore();
  const [minutesInOffice, setMinutesInOffice] = useState(0);

  useEffect(() => {
    if (!isCheckedIn || !checkInStartTime) { setMinutesInOffice(0); return; }
    const interval = setInterval(() => {
      setMinutesInOffice(Math.round((Date.now() - checkInStartTime.getTime()) / 60000));
    }, 30000);
    setMinutesInOffice(Math.round((Date.now() - checkInStartTime.getTime()) / 60000));
    return () => clearInterval(interval);
  }, [isCheckedIn, checkInStartTime]);

  const checkIn = useCallback(async () => {
    await api.post('/office/check-in', { source: 'WEB' });
    setCheckedIn(true, new Date());
  }, [setCheckedIn]);

  const checkOut = useCallback(async () => {
    await api.post('/office/check-out');
    setCheckedIn(false);
  }, [setCheckedIn]);

  const changeStatus = useCallback(async (status: PresenceStatusEnum, message?: string) => {
    await api.patch('/office/status', { status, statusMessage: message });
    setMyStatus(status);
  }, [setMyStatus]);

  return { isCheckedIn, myStatus, minutesInOffice, checkIn, checkOut, changeStatus, userId: user?.id };
}
