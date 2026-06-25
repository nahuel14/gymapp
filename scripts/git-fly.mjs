import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🚀 Iniciando automatización de envío...\n");

// 1. Lint — falla rápido si hay errores de código (reglas ESLint)
try {
  console.log("🔍 1/6: Ejecutando LINT...");
  execSync('npm run lint', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Lint fallido. Corregí los errores antes de continuar.");
  rl.close();
  process.exit(1);
}

// 2. Dead code — detecta exports sin usar, archivos huérfanos y deps no usadas
try {
  console.log("\n🔍 2/6: Verificando DEAD CODE (knip)...");
  execSync('npm run dead-code', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Código muerto detectado. Eliminá los exports, archivos o dependencias no usadas.");
  rl.close();
  process.exit(1);
}

// 3. Tests — fallan rápido (2 seg), no tiene sentido esperar el build si ya hay un test roto
try {
  console.log("\n🧪 3/6: Ejecutando TESTS...");
  execSync('npm run test:run', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Tests fallidos. Corregí los errores antes de continuar.");
  rl.close();
  process.exit(1);
}

// 4. Coverage — falla si baja del umbral configurado en vitest.config.ts
try {
  console.log("\n📊 4/6: Verificando CODE COVERAGE...");
  execSync('npm run test:coverage', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Coverage por debajo del umbral. Agregá tests para cubrir el código nuevo.");
  rl.close();
  process.exit(1);
}

// 4. Build — verifica tipado y compilación (~1-2 min)
try {
  console.log("\n🏗️  5/6: Ejecutando BUILD de Next.js...");
  execSync('npm run build', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Build fallido. Corregí los errores antes de continuar.");
  rl.close();
  process.exit(1);
}

// 6. Git — solo llegamos acá si lint, dead code, tests, coverage y build pasaron
console.log("\n📦 6/6: Indexando cambios...");
try {
  execSync('git add .', { stdio: 'inherit', shell: true });
} catch {
  console.error("❌ Error al indexar archivos.");
  rl.close();
  process.exit(1);
}

rl.question('\n✍️  Ingresa el mensaje para tu commit: ', (message) => {
  if (!message.trim()) {
    console.log("⚠️ El mensaje no puede estar vacío. Abortando flujo.");
    rl.close();
    process.exit(1);
  }

  try {
    // --no-verify: los tests ya corrieron en el paso 1, evita que Husky los ejecute de nuevo
    execSync(`git commit --no-verify -m "${message}"`, { stdio: 'inherit', shell: true });

    console.log("\n📡 Subiendo cambios al repositorio remoto...");
    execSync('git push', { stdio: 'inherit', shell: true });

    console.log("\n✅ ¡Éxito total! Lint, tests, coverage y build pasaron. Tu código ya está en camino a Vercel.");
  } catch {
    console.error("\n❌ Flujo interrumpido. Revisá los errores en la consola.");
  } finally {
    rl.close();
  }
});
