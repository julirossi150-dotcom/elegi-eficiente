// Lectura de los datos generados en tiempo de compilación (solo componentes de servidor).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Meta } from './types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

export async function readMeta(): Promise<Meta | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, 'meta.json'), 'utf8')) as Meta;
  } catch {
    return null;
  }
}
