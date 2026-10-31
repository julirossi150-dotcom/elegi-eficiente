// Lectura de los datos generados en tiempo de compilación (solo componentes de servidor).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { OfficialTariffs } from './tariffs';
import type { Meta } from './types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

export async function readTariffs(): Promise<OfficialTariffs | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, 'tarifas.json'), 'utf8')) as OfficialTariffs;
  } catch {
    return null;
  }
}

export async function readMeta(): Promise<Meta | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, 'meta.json'), 'utf8')) as Meta;
  } catch {
    return null;
  }
}
