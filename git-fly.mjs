import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🚀 Iniciando automatización de envío...\n");

// 1. Lint — falla rápido si hay errores de código (reglas ESLint)
try {
  console.log("🔍 1/4: Ejecutando LINT...");
  execSync('npm run lint', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Lint fallido. Corregí los errores antes de continuar.");
  rl.close();
  process.exit(1);
}

// 2. Tests — fallan rápido (2 seg), no tiene sentido esperar el build si ya hay un test roto
try {
  console.log("\n🧪 2/4: Ejecutando TESTS...");
  execSync('npm run test:run', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Tests fallidos. Corregí los errores antes de continuar.");
  rl.close();
  process.exit(1);
}

// 3. Build — verifica tipado y compilación (~1-2 min)
try {
  console.log("\n🏗️  3/4: Ejecutando BUILD de Next.js...");
  execSync('npm run build', { stdio: 'inherit', shell: true });
} catch {
  console.error("\n❌ Build fallido. Corregí los errores antes de continuar.");
  rl.close();
  process.exit(1);
}

// 4. Git — solo llegamos acá si lint, tests y build pasaron
console.log("\n📦 4/4: Indexando cambios...");
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

    console.log("\n✅ ¡Éxito total! Lint, tests y build pasaron. Tu código ya está en camino a Vercel.");
  } catch {
    console.error("\n❌ Flujo interrumpido. Revisá los errores en la consola.");
  } finally {
    rl.close();
  }
});
