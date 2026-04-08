'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export interface PluginRegistration {
  name: string;
  version: string;
  description: string;
  route: string;
  icon: string;
  adminOnly: boolean;
  isActive: boolean;
  hasFrontend?: boolean;
}

export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginRegistration[]>([]);

  useEffect(() => {
    api.get('/plugins').then((res) => setPlugins(res.data)).catch(() => {});
  }, []);

  return plugins;
}
