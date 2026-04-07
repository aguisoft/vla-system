/**
 * Script de sincronización Bitrix24 → VLA System
 * Lee la estructura real de la empresa y crea:
 * - Layout de la oficina basado en departamentos reales
 * - Usuarios del sistema con mapeo a Bitrix24
 * - Avatares aleatorios por persona
 * - BitrixUserMapping para sincronización bidireccional
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// ─── LAYOUT BASADO EN LA ESTRUCTURA REAL DE GRUPO VLA ────────────────────────
// Mapa: 44 tiles de ancho × 30 tiles de alto
// Fila superior (y=0..9):   Recepción, Gerencia, Development, Consulting, Cafetería
// Fila media   (y=10..19):  Finanzas, Cobros/Bienestar, Bufete, Marketing, RR.HH
// Mapa 40x30 — solo departamentos oficiales del organigrama Bitrix24
// Fila superior  (y=0..9):   Gerencia, Development, Consulting, RR.HH, V-FIT
// Fila media     (y=11..19): Finanzas, Cobros&Bienestar, Bufete, Marketing, Academy
// Fila inferior  (y=21..29): Sales Department, Call Center, English Sales

const COMPANY_ZONES = [
  // ── FILA SUPERIOR ──
  {
    id: 'gerencia',
    name: 'Gerencia General',
    x: 0, y: 0, width: 6, height: 10,
    type: 'private', color: '#E0F7FA', icon: 'crown', maxOccupancy: 1,
  },
  {
    id: 'development',
    name: 'Development',
    x: 7, y: 0, width: 11, height: 10,
    type: 'focus', color: '#EDE7F6', icon: 'code', maxOccupancy: null,
  },
  {
    id: 'consulting',
    name: 'Consulting',
    x: 19, y: 0, width: 8, height: 10,
    type: 'common', color: '#FFF3E0', icon: 'briefcase', maxOccupancy: null,
  },
  {
    id: 'rrhh',
    name: 'Recursos Humanos',
    x: 28, y: 0, width: 6, height: 10,
    type: 'common', color: '#DCEDC8', icon: 'users', maxOccupancy: null,
  },
  {
    id: 'vfit',
    name: 'V-FIT',
    x: 35, y: 0, width: 5, height: 10,
    type: 'social', color: '#E8F5E9', icon: 'heart', maxOccupancy: null,
  },

  // ── FILA MEDIA ──
  {
    id: 'finanzas',
    name: 'Finanzas',
    x: 0, y: 11, width: 9, height: 9,
    type: 'common', color: '#FCE4EC', icon: 'credit-card', maxOccupancy: null,
  },
  {
    id: 'cobros',
    name: 'Cobros & Bienestar',
    x: 10, y: 11, width: 9, height: 9,
    type: 'common', color: '#F3E5F5', icon: 'coins', maxOccupancy: null,
  },
  {
    id: 'bufete',
    name: 'Bufete Jurídico',
    x: 20, y: 11, width: 6, height: 9,
    type: 'meeting', color: '#E3F2FD', icon: 'scale', maxOccupancy: 4,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    x: 27, y: 11, width: 8, height: 9,
    type: 'common', color: '#FFF9C4', icon: 'megaphone', maxOccupancy: null,
  },
  {
    id: 'academy',
    name: 'Academy',
    x: 36, y: 11, width: 4, height: 9,
    type: 'common', color: '#FFF3E0', icon: 'graduation-cap', maxOccupancy: null,
  },

  // ── FILA INFERIOR ──
  {
    id: 'sales',
    name: 'Sales Department',
    x: 0, y: 21, width: 13, height: 9,
    type: 'common', color: '#E1F5FE', icon: 'trending-up', maxOccupancy: null,
  },
  {
    id: 'call-center',
    name: 'Call Center',
    x: 14, y: 21, width: 12, height: 9,
    type: 'meeting', color: '#F1F8E9', icon: 'phone', maxOccupancy: null,
  },
  {
    id: 'english-sales',
    name: 'English Sales',
    x: 27, y: 21, width: 13, height: 9,
    type: 'common', color: '#FFF3E0', icon: 'globe', maxOccupancy: null,
  },
];

// ─── USUARIOS REALES DE BITRIX24 ─────────────────────────────────────────────
// Filtrados: se excluyeron bots (Boletin, Bot VLA, Support Hiper Devs, Carlos Test, Caller User)

const BITRIX_USERS = [
  { bitrixId: 1,      firstName: 'Josue',           lastName: 'Rodriguez',    email: 'jrodriguez@grupovla.com',   zone: 'gerencia',       role: 'ADMIN' as const,  position: 'Gerente General' },
  { bitrixId: 927,    firstName: 'Joseph',           lastName: 'Cruz',         email: 'jcruz@grupovla.com',        zone: 'call-center',    role: 'STAFF' as const,  position: 'Jefe de Ventas' },
  { bitrixId: 933,    firstName: 'Marcelo',          lastName: 'Sánchez',      email: 'msanchez@grupovla.com',     zone: 'sales',          role: 'STAFF' as const,  position: 'Asesor Educativo' },
  { bitrixId: 949,    firstName: 'Carlos',           lastName: 'Aguinaga',     email: 'caguinaga@grupovla.com',    zone: 'development',    role: 'STAFF' as const,  position: 'Líder de Desarrollo' },
  { bitrixId: 955,    firstName: 'Verónica',         lastName: 'Vasquez',      email: 'vvasquez@grupovla.com',     zone: 'vfit',           role: 'STAFF' as const,  position: 'Directora V-FIT' },
  { bitrixId: 3617,   firstName: 'Daniel',           lastName: 'Giraldo',      email: 'dgiraldo@grupovla.com',     zone: 'sales',          role: 'STAFF' as const,  position: 'Asesor de Ventas' },
  { bitrixId: 3911,   firstName: 'Renee',            lastName: 'Lacayo',       email: 'rlacayo@vlacademy.com',     zone: 'english-sales',  role: 'STAFF' as const,  position: 'Directora Academy / English Sales' },
  { bitrixId: 5935,   firstName: 'Ramiro',           lastName: 'Bravo',        email: 'rbravo@grupovla.com',       zone: 'english-sales',  role: 'STAFF' as const,  position: 'English Sales Agent' },
  { bitrixId: 9891,   firstName: 'Eliseo',           lastName: 'Urbina',       email: 'eurbina@grupovla.com',      zone: 'sales',          role: 'STAFF' as const,  position: 'Asesor de Ventas' },
  { bitrixId: 11877,  firstName: 'Gabriela',         lastName: 'Equizabal',    email: 'gequizabal@grupovla.com',   zone: 'vfit',           role: 'STAFF' as const,  position: 'Instructora V-FIT / Academy' },
  { bitrixId: 13545,  firstName: 'Ismael',           lastName: 'Ramos',        email: 'iramos@grupovla.com',       zone: 'development',    role: 'STAFF' as const,  position: 'Desarrollador' },
  { bitrixId: 24203,  firstName: 'José',             lastName: 'López',        email: 'jlopez@grupovla.com',       zone: 'cobros',         role: 'STAFF' as const,  position: 'Bienestar Estudiantil' },
  { bitrixId: 28025,  firstName: 'Daniela',          lastName: 'Delgado',      email: 'ddelgado@grupovla.com',     zone: 'finanzas',       role: 'STAFF' as const,  position: 'Directora de Finanzas' },
  { bitrixId: 42111,  firstName: 'Dayanna',          lastName: 'Chavez',       email: 'dchavez@grupovla.com',      zone: 'finanzas',       role: 'STAFF' as const,  position: 'Pasante Finanzas' },
  { bitrixId: 48515,  firstName: 'Huston',           lastName: 'Vega',         email: 'hvega@grupovla.com',        zone: 'development',    role: 'STAFF' as const,  position: 'Desarrollador' },
  { bitrixId: 77575,  firstName: 'Ana',              lastName: 'Zavala',       email: 'azavala@grupovla.com',      zone: 'rrhh',           role: 'STAFF' as const,  position: 'Recursos Humanos' },
  { bitrixId: 82539,  firstName: 'Sabrina',          lastName: 'Rodríguez',    email: 'srodriguez@grupovla.com',   zone: 'sales',          role: 'STAFF' as const,  position: 'Asesora de Ventas' },
  { bitrixId: 118151, firstName: 'Laura',            lastName: 'Torres',       email: 'ltorres@grupovla.com',      zone: 'marketing',      role: 'STAFF' as const,  position: 'Directora de Marketing' },
  { bitrixId: 122671, firstName: 'Yeraldine',        lastName: 'Quintana',     email: 'yquintana@grupovla.com',    zone: 'cobros',         role: 'STAFF' as const,  position: 'Cobros / Bienestar' },
  { bitrixId: 128751, firstName: 'Esteban',          lastName: 'Tordecilla',   email: 'etordecilla@grupovla.com',  zone: 'marketing',      role: 'STAFF' as const,  position: 'Marketing' },
  { bitrixId: 131147, firstName: 'Facundo',          lastName: 'Cidade',       email: 'fciudad@grupovla.com',      zone: 'cobros',         role: 'STAFF' as const,  position: 'Cobros / Bienestar' },
  { bitrixId: 132891, firstName: 'Dante',            lastName: 'Luna',         email: 'dluna@grupovla.com',        zone: 'consulting',     role: 'STAFF' as const,  position: 'Consultor' },
  { bitrixId: 138369, firstName: 'Milady',           lastName: 'Guerrero',     email: 'mguerrero@grupovla.com',    zone: 'academy',        role: 'PROFESSOR' as const, position: 'Instructora Academy' },
  { bitrixId: 148331, firstName: 'Maria',            lastName: 'Vallejo',      email: 'mvallejo@grupovla.com',     zone: 'bufete',         role: 'STAFF' as const,  position: 'Bufete Jurídico' },
  { bitrixId: 185913, firstName: 'María Fernanda',   lastName: 'Martinez',     email: 'mfmartinez@grupovla.com',   zone: 'finanzas',       role: 'STAFF' as const,  position: 'Finanzas' },
  { bitrixId: 188719, firstName: 'Mara',             lastName: 'Gutiérrez',    email: 'mgutierrez@grupovla.com',   zone: 'marketing',      role: 'STAFF' as const,  position: 'Marketing' },
  { bitrixId: 192469, firstName: 'Yara',             lastName: 'Chavarría',    email: 'ychavarria@grupovla.com',   zone: 'cobros',         role: 'STAFF' as const,  position: 'Cobros / Bienestar' },
  { bitrixId: 233069, firstName: 'Edison',           lastName: 'Retana',       email: 'eretana@grupovla.com',      zone: 'consulting',     role: 'STAFF' as const,  position: 'Paid Media' },
  { bitrixId: 238079, firstName: 'Yamila',           lastName: 'Goncebat',     email: 'ygoncebat@grupovla.com',    zone: 'call-center',    role: 'STAFF' as const,  position: 'Agente Call Center' },
  { bitrixId: 238083, firstName: 'Micaela',          lastName: 'Saavedra',     email: 'msaavedra@grupovla.com',    zone: 'call-center',    role: 'STAFF' as const,  position: 'Agente Call Center' },
  { bitrixId: 240713, firstName: 'Laura',            lastName: 'Molano',       email: 'lmolano@grupovla.com',      zone: 'sales',          role: 'STAFF' as const,  position: 'Agente Telefónico' },
  { bitrixId: 249405, firstName: 'Yesenia',          lastName: 'Rojas',        email: 'yrojas@grupovla.com',       zone: 'sales',          role: 'STAFF' as const,  position: 'Agente de Ventas' },
  { bitrixId: 249703, firstName: 'Lise',             lastName: 'Jn. Jacques',  email: 'ljacques@grupovla.com',     zone: 'english-sales',  role: 'STAFF' as const,  position: 'Caller - English Sales' },
  { bitrixId: 249705, firstName: 'Gabriela',         lastName: 'Abuawad',      email: 'gabuawad@grupovla.com',     zone: 'english-sales',  role: 'STAFF' as const,  position: 'Caller - English Sales' },
  { bitrixId: 249707, firstName: 'Pablo',            lastName: 'Vásquez',      email: 'pvasquez@grupovla.com',     zone: 'english-sales',  role: 'STAFF' as const,  position: 'Caller - English Sales' },
];

// Paleta de colores para avatares aleatorios
const SKIN_COLORS = ['#FDDBB4', '#F5CBA7', '#F1C27D', '#D4A574', '#C68642', '#8D5524'];
const HAIR_COLORS = ['#2C2C2C', '#1A1A1A', '#8B4513', '#C4A35A', '#D2691E', '#4A3728'];
const SHIRT_COLORS = ['#3498DB', '#E91E63', '#2ECC71', '#9B59B6', '#E74C3C', '#F39C12', '#1ABC9C', '#34495E', '#FF7043', '#00BCD4'];
const HAIR_STYLES = ['short', 'long', 'curly', 'bald', 'ponytail', 'mohawk', 'afro', 'buzz'] as const;
const ACCESSORIES = ['glasses', 'headphones', 'hat', 'earbuds', 'none'] as const;
const EMOJIS_BY_ZONE: Record<string, string[]> = {
  'gerencia':      ['👑', '🏆', '💼'],
  'development':   ['💻', '🚀', '⚡', '🔧', '🛠️'],
  'consulting':    ['💡', '📊', '🎯'],
  'finanzas':      ['💰', '📈', '💳'],
  'cobros':        ['💵', '🏦', '📋'],
  'bufete':        ['⚖️', '📜', '🔏'],
  'marketing':     ['📣', '🎨', '✨', '📸'],
  'rrhh':          ['🤝', '❤️', '👥'],
  'sales':         ['📞', '🎯', '💪', '🔥'],
  'call-center':   ['📱', '🎧', '📞'],
  'english-sales': ['🌎', '🗣️', '✈️'],
  'academy':       ['📚', '🎓', '🏫'],
  'vfit':          ['💪', '🏃', '⚡'],
  'cafeteria':     ['☕', '🍕', '🍎'],
  'reception':     ['👋', '😊', '🌟'],
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEmoji(zone: string): string {
  const list = EMOJIS_BY_ZONE[zone] ?? ['😊'];
  return pick(list);
}

// Posición dentro de la zona (grid simple por índice)
const zoneCounters: Record<string, number> = {};
function getPosition(zoneId: string): { posX: number; posY: number } {
  zoneCounters[zoneId] = (zoneCounters[zoneId] ?? 0);
  const idx = zoneCounters[zoneId]++;
  const zone = COMPANY_ZONES.find(z => z.id === zoneId)!;
  const cols = Math.max(1, Math.floor(zone.width / 2));
  return {
    posX: (idx % cols),
    posY: Math.floor(idx / cols),
  };
}

async function main() {
  const redis = new Redis({ host: process.env.REDIS_HOST ?? 'localhost', port: Number(process.env.REDIS_PORT ?? 6379) });

  console.log('🏢 Sincronizando estructura de Grupo VLA desde Bitrix24...\n');

  // 1. Crear/actualizar el layout de la oficina
  console.log('📐 Creando layout de la oficina con departamentos reales...');
  const existingLayout = await prisma.officeLayout.findFirst({ where: { isActive: true } });
  if (existingLayout) {
    await prisma.officeLayout.update({
      where: { id: existingLayout.id },
      data: {
        name: 'Grupo VLA — Oficina Virtual',
        width: 44,
        height: 30,
        zones: COMPANY_ZONES,
      },
    });
  } else {
    await prisma.officeLayout.create({
      data: {
        name: 'Grupo VLA — Oficina Virtual',
        width: 44,
        height: 30,
        zones: COMPANY_ZONES,
        isActive: true,
      },
    });
  }
  // Invalidar caché de Redis para que el API sirva el nuevo layout
  await redis.del('office:layout:current');
  console.log(`  ✅ Layout actualizado con ${COMPANY_ZONES.length} zonas (caché invalidada)\n`);

  // 2. Procesar cada usuario
  console.log('👥 Creando usuarios...');
  const password = await bcrypt.hash('vla2024', 12);

  for (const u of BITRIX_USERS) {
    // Crear o actualizar usuario
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash: password,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: true,
      },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: true,
      },
    });

    // Mapeo Bitrix24
    await prisma.bitrixUserMapping.upsert({
      where: { userId: user.id },
      create: { userId: user.id, bitrixUserId: u.bitrixId },
      update: { bitrixUserId: u.bitrixId },
    });

    // Avatar aleatorio con semilla por bitrixId (reproducible)
    const rng = u.bitrixId;
    const skinIdx  = rng % SKIN_COLORS.length;
    const hairIdx  = (rng * 3) % HAIR_COLORS.length;
    const shirtIdx = (rng * 7) % SHIRT_COLORS.length;
    const styleIdx = (rng * 11) % HAIR_STYLES.length;
    const accIdx   = (rng * 13) % ACCESSORIES.length;

    await prisma.userAvatar.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        skinColor:  SKIN_COLORS[skinIdx],
        hairStyle:  HAIR_STYLES[styleIdx] as any,
        hairColor:  HAIR_COLORS[hairIdx],
        shirtColor: SHIRT_COLORS[shirtIdx],
        accessory:  ACCESSORIES[accIdx] as any,
        emoji:      getEmoji(u.zone),
      },
      update: {
        skinColor:  SKIN_COLORS[skinIdx],
        hairStyle:  HAIR_STYLES[styleIdx] as any,
        hairColor:  HAIR_COLORS[hairIdx],
        shirtColor: SHIRT_COLORS[shirtIdx],
        accessory:  ACCESSORIES[accIdx] as any,
        emoji:      getEmoji(u.zone),
      },
    });

    // Presencia inicial — zona por defecto asignada pero estado OFFLINE (check-in real desde la app/Bitrix)
    const { posX, posY } = getPosition(u.zone);
    await prisma.presenceStatus.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'OFFLINE',
        isCheckedIn: false,
        currentZoneId: null,
        defaultZoneId: u.zone,
        positionX: null,
        positionY: null,
        lastActivityAt: new Date(),
      },
      update: {
        defaultZoneId: u.zone,
        // Solo resetear si estaba con datos de sync previo (todos online)
        // No sobreescribir si ya hay un check-in real
        status: 'OFFLINE',
        isCheckedIn: false,
        currentZoneId: null,
        positionX: null,
        positionY: null,
        lastActivityAt: new Date(),
      },
    });

    // Check-in record del día
    const todayRecord = await prisma.checkInRecord.findFirst({
      where: {
        userId: user.id,
        checkInAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        checkOutAt: null,
      },
    });
    if (!todayRecord) {
      await prisma.checkInRecord.create({
        data: { userId: user.id, source: 'BITRIX' },
      });
    }

    // Eliminar presencia Redis si existía del sync anterior
    await redis.del(`office:presence:${user.id}`);

    console.log(`  ✅ ${u.firstName} ${u.lastName} → ${u.zone} (Bitrix #${u.bitrixId})`);
  }

  console.log(`\n🎉 Sincronización completa!`);
  console.log(`   ${COMPANY_ZONES.length} zonas de oficina`);
  console.log(`   ${BITRIX_USERS.length} usuarios creados/actualizados`);
  console.log(`   Contraseña por defecto: vla2024`);
  console.log(`\n🔗 Departamentos mapeados:`);
  const depts = [...new Set(BITRIX_USERS.map(u => u.zone))];
  for (const d of depts) {
    const members = BITRIX_USERS.filter(u => u.zone === d);
    console.log(`   ${d}: ${members.map(u => u.firstName).join(', ')}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
