import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath: string) {
  try {
    const lines = readFileSync(filePath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch { /* archivo no encontrado — se ignora */ }
}

async function globalSetup() {
  loadEnvFile(resolve(process.cwd(), '.env.test.local'));
  loadEnvFile(resolve(process.cwd(), '.env'));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn('[E2E setup] Missing Supabase env vars — skipping pre-cleanup');
    return;
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { error, count } = await supabase
    .from('training_plans')
    .delete({ count: 'exact' })
    .like('name', '[E2E]%');

  if (error) {
    console.error('[E2E setup] Error al eliminar planes residuales:', error.message);
  } else if ((count ?? 0) > 0) {
    console.log(`[E2E setup] Pre-limpieza: eliminados ${count} planes [E2E] de runs anteriores`);
  }
}

export default globalSetup;
