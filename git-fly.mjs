import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("🚀 Iniciando automatización de envío...\n");

// 1. Ejecutar git add de manera automática
try {
  console.log("📦 Indexando todos los cambios modificados...");
  execSync('git add .', { stdio: 'inherit', shell: true });
} catch (error) {
  console.error("❌ Error al indexar archivos.");
  process.exit(1);
}

// 2. Solicitar el mensaje de commit
rl.question('✍️  Ingresa el mensaje para tu commit: ', (message) => {
  if (!message.trim()) {
    console.log("⚠️ El mensaje no puede estar vacío. Abortando flujo.");
    rl.close();
    process.exit(1);
  }

  try {
    console.log(`\n🧪 1/3: Guardando commit y ejecutando TESTS (vía Husky)...`);
    // Husky interceptará esto y correrá 'npm run test:run'
    execSync(`git commit -m "${message}"`, { stdio: 'inherit', shell: true });
    
    console.log(`\n🏗️  2/3: Ejecutando BUILD de Next.js (Simulando Vercel)...`);
    // Si falla el tipado estricto o un componente, se corta aquí y NO hace push
    execSync('npm run build', { stdio: 'inherit', shell: true });
    
    console.log("\n📡 3/3: Subiendo cambios al repositorio remoto...");
    execSync('git push', { stdio: 'inherit', shell: true });
    
    console.log("\n✅ ¡Éxito total! Tu código pasó las pruebas, compiló perfecto y ya está en camino a Vercel.");
  } catch (error) {
    console.error("\n❌ Flujo interrumpido. Revisa los errores en la consola arriba antes de reintentar.");
  } finally {
    rl.close();
  }
});