'use client';

import { useEffect } from 'react';
import { useOfficeStore } from '@/stores/office.store';
import api from '@/lib/api';

export function useOfficeLayout() {
  const { layout, setLayout } = useOfficeStore();

  useEffect(() => {
    if (layout) return;
    api.get('/office/layout')
      .then((res) => setLayout(res.data))
      .catch(console.error);
  }, [layout, setLayout]);

  return { layout };
}
