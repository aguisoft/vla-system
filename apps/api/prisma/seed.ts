import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ZONES = [
  { id: 'reception', name: 'Recepción', x: 0, y: 0, width: 10, height: 8, type: 'common', color: '#E8F5E9', icon: 'door-open', maxOccupancy: null },
  { id: 'sala-juntas-1', name: 'Sala de Juntas', x: 12, y: 0, width: 8, height: 6, type: 'meeting', color: '#E3F2FD', icon: 'users', maxOccupancy: 8 },
  { id: 'academia', name: 'Academia', x: 0, y: 10, width: 12, height: 10, type: 'common', color: '#FFF3E0', icon: 'graduation-cap', maxOccupancy: null },
  { id: 'cobros', name: 'Cobros y Finanzas', x: 14, y: 10, width: 10, height: 8, type: 'common', color: '#FCE4EC', icon: 'credit-card', maxOccupancy: null },
  { id: 'zona-focus', name: 'Zona de Concentración', x: 26, y: 0, width: 14, height: 8, type: 'focus', color: '#F3E5F5', icon: 'headphones', maxOccupancy: null },
  { id: 'cafeteria', name: 'Cafetería ☕', x: 26, y: 10, width: 14, height: 10, type: 'social', color: '#FFF8E1', icon: 'coffee', maxOccupancy: null },
  { id: 'oficina-josue', name: 'Oficina Josué', x: 22, y: 0, width: 4, height: 4, type: 'private', color: '#E0F7FA', icon: 'crown', maxOccupancy: 1 },
];

const STAFF_USERS = [
  { email: 'maria@vla.com', firstName: 'María', lastName: 'González', role: 'STAFF', skinColor: '#F5CBA7', hairStyle: 'long', hairColor: '#8B4513', shirtColor: '#E91E63', accessory: 'none', emoji: '☀️', zone: 'reception', posX: 2, posY: 2 },
  { email: 'carlos@vla.com', firstName: 'Carlos', lastName: 'Ramírez', role: 'STAFF', skinColor: '#D4A574', hairStyle: 'short', hairColor: '#2C2C2C', shirtColor: '#2196F3', accessory: 'glasses', emoji: '💻', zone: 'academia', posX: 3, posY: 3 },
  { email: 'ana@vla.com', firstName: 'Ana', lastName: 'Martínez', role: 'STAFF', skinColor: '#C68642', hairStyle: 'curly', hairColor: '#4A3728', shirtColor: '#9C27B0', accessory: 'earbuds', emoji: '🎯', zone: 'cobros', posX: 1, posY: 1 },
  { email: 'pedro@vla.com', firstName: 'Pedro', lastName: 'López', role: 'STAFF', skinColor: '#8D5524', hairStyle: 'buzz', hairColor: '#1A1A1A', shirtColor: '#4CAF50', accessory: 'headphones', emoji: '🎸', zone: 'zona-focus', posX: 4, posY: 2 },
  { email: 'laura@vla.com', firstName: 'Laura', lastName: 'Sánchez', role: 'PROFESSOR', skinColor: '#F1C27D', hairStyle: 'ponytail', hairColor: '#C4A35A', shirtColor: '#FF9800', accessory: 'none', emoji: '📚', zone: 'cafeteria', posX: 2, posY: 4 },
];

const isProduction = process.env.NODE_ENV === 'production';

async function ensurePresence(userId: string, opts: { zoneId?: string; posX: number; posY: number; checkedIn: boolean }) {
  await prisma.presenceStatus.upsert({
    where: { userId },
    create: { userId, status: 'AVAILABLE', isCheckedIn: opts.checkedIn, currentZoneId: opts.zoneId ?? null, positionX: opts.posX, positionY: opts.posY },
    update: {},
  });
}

async function ensureCheckIn(userId: string) {
  const existing = await prisma.checkInRecord.findFirst({ where: { userId }, orderBy: { checkInAt: 'desc' } });
  if (!existing) {
    await prisma.checkInRecord.create({ data: { userId, source: 'WEB' } });
  }
}

async function main() {
  console.log(`🌱 Seeding VLA database [${isProduction ? 'production' : 'development'}]...`);

  // ── Superadmin (always — both envs) ──────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash('VLA@admin2024!', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'caguinaga@grupovla.com' },
    create: { email: 'caguinaga@grupovla.com', passwordHash: superAdminPassword, firstName: 'Caguinaga', lastName: 'VLA', role: 'ADMIN', isActive: true },
    update: { role: 'ADMIN', isActive: true },
  });

  await prisma.userAvatar.upsert({
    where: { userId: superAdmin.id },
    create: { userId: superAdmin.id, skinColor: '#D4A574', hairStyle: 'short', hairColor: '#1A1A1A', shirtColor: '#1B5E20', accessory: 'none', emoji: '⭐' },
    update: {},
  });
  await ensurePresence(superAdmin.id, { posX: 0, posY: 0, checkedIn: false });
  console.log('✅ Superadmin: caguinaga@grupovla.com / VLA@admin2024!');

  if (isProduction) {
    console.log('🎉 Production seed complete (demo data skipped).');
    return;
  }

  // ── Demo data (development only) ─────────────────────────────────────────────

  // Office layout
  const existingLayout = await prisma.officeLayout.findFirst({ where: { isActive: true } });
  if (!existingLayout) {
    await prisma.officeLayout.create({
      data: { name: 'VLA HQ Virtual', width: 40, height: 30, zones: DEFAULT_ZONES, isActive: true },
    });
    console.log('✅ Office layout created');
  }

  // Demo admin (Josué)
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'josue@vla.com' },
    create: { email: 'josue@vla.com', passwordHash: adminPassword, firstName: 'Josué', lastName: 'Hernández', role: 'ADMIN' },
    update: {},
  });

  await prisma.userAvatar.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, skinColor: '#D4A574', hairStyle: 'short', hairColor: '#2C2C2C', shirtColor: '#1565C0', accessory: 'none', emoji: '👑' },
    update: {},
  });
  await ensurePresence(admin.id, { zoneId: 'oficina-josue', posX: 0, posY: 0, checkedIn: true });
  await ensureCheckIn(admin.id);
  console.log('✅ Demo admin: josue@vla.com / admin123');

  // Demo staff users
  for (const staffData of STAFF_USERS) {
    const password = await bcrypt.hash('staff123', 12);
    const { skinColor, hairStyle, hairColor, shirtColor, accessory, emoji, zone, posX, posY, role, ...userData } = staffData;

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      create: { ...userData, role: role as any, passwordHash: password },
      update: {},
    });

    await prisma.userAvatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, skinColor, hairStyle: hairStyle as any, hairColor, shirtColor, accessory: accessory as any, emoji },
      update: {},
    });
    await ensurePresence(user.id, { zoneId: zone, posX, posY, checkedIn: true });
    await ensureCheckIn(user.id);
  }

  console.log(`✅ ${STAFF_USERS.length} demo staff users created (password: staff123)`);
  console.log('🎉 Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
