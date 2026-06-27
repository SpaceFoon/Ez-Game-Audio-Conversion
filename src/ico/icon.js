/**
 * Icon and metadata injection script using resedit
 *
 * This script adds icon and version information to the Windows executable.
 * Best-effort: if prerequisites are missing, it will skip without failing.
 *
 * Usage:
 *   node src/ico/icon.js [exePath] [iconPath]
 *
 * Notes:
 * - SEA executables are based on the Node.js binary and often still contain a
 *   certificate table after SEA injection. We must parse with ignoreCert.
 * - Modifying resources will invalidate any existing signature.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseVersion(version) {
  if (typeof version !== 'string')
    return { major: 0, minor: 0, patch: 0, build: 0 };
  const parts = version
    .split('.')
    .map((p) => Number.parseInt(p, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    build: parts[3] ?? 0,
  };
}

try {
  // These are pure-JS deps; they can run on non-Windows hosts too.
  // Keep them as dynamic imports so this script remains optional.
  const PELibrary = await import('pe-library').catch(() => null);
  const ResEdit = await import('resedit').catch(() => null);

  if (!PELibrary || !ResEdit) {
    console.log(
      '⚠️  Icon injection deps not installed - skipping icon/metadata'
    );
    console.log('    Install with: npm install --save-dev resedit');
    process.exit(0);
  }

  const defaultExePath = join(__dirname, '../../release/EZ-Game-Audio.exe');
  const defaultIconPath = join(__dirname, '../../media/ico/icon.ico');

  const exePath = resolve(process.argv[2] || defaultExePath);
  const iconPath = resolve(process.argv[3] || defaultIconPath);

  // Only attempt to modify Windows executables.
  if (!exePath.toLowerCase().endsWith('.exe')) {
    console.log('⚠️  Target is not a .exe - skipping icon/metadata');
    process.exit(0);
  }

  // Skip gracefully if files are missing (keeps packaging resilient).
  // Using sync read with try/catch avoids separate exists checks.
  let exeBuffer;
  let iconBuffer;
  try {
    exeBuffer = readFileSync(exePath);
  } catch (error) {
    console.log(
      `⚠️  Executable not found - skipping icon/metadata: ${exePath} Error: ${error.message}`
    );
    process.exit(0);
  }
  try {
    iconBuffer = readFileSync(iconPath);
  } catch (error) {
    console.log(
      `⚠️  Icon file not found - skipping icon/metadata: ${iconPath} Error: ${error.message}`
    );
    process.exit(0);
  }

  console.log('🎨 Adding icon and metadata to executable...');

  // Read the executable
  const exe = PELibrary.NtExecutable.from(exeBuffer, { ignoreCert: true });
  const res = PELibrary.NtExecutableResource.from(exe);

  // Add icon - completely replace ALL icon groups
  try {
    const iconFile = ResEdit.Data.IconFile.from(iconBuffer);
    const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);

    console.log(`  Found ${iconGroups.length} existing icon group(s)`);

    // Replace each existing icon group with the new icon
    if (iconGroups.length > 0) {
      for (const group of iconGroups) {
        console.log(`  Replacing icon group ${group.id}...`);
        ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
          res.entries,
          group.id,
          1033, // Language (English US)
          iconFile.icons.map((icon) => icon.data)
        );
      }
    } else {
      // No existing groups, create one with ID 1
      console.log('  Creating new icon group 1...');
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033, // Language (English US)
        iconFile.icons.map((icon) => icon.data)
      );
    }

    console.log('  ✅ Icon(s) replaced successfully');
  } catch (error) {
    console.log('  ⚠️  Could not add icon:', error.message);
    console.log('       Error details:', error.stack);
  }

  // Add version information
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8')
    );

    const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
    const versionInfo =
      viList.length > 0
        ? viList[0]
        : ResEdit.Resource.VersionInfo.createEmpty();

    const { major, minor, patch, build } = parseVersion(packageJson.version);
    versionInfo.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        ProductName: 'EZ Game Audio Conversion',
        FileDescription: 'Batch audio converter for game developers',
        CompanyName: packageJson.author || 'SpaceFoon',
        LegalCopyright: `© ${new Date().getFullYear()}`,
        FileVersion: packageJson.version,
        ProductVersion: packageJson.version,
      }
    );

    // The last argument is lang.
    versionInfo.setFileVersion(major, minor, patch, build, 1033);
    versionInfo.setProductVersion(major, minor, patch, build, 1033);

    versionInfo.outputToResourceEntries(res.entries);
    console.log('  ✅ Version info added');
  } catch (error) {
    console.log('  ⚠️  Could not add version info:', error.message);
  }

  // Write the modified executable
  // Critical: persist res.entries back into the PE before generating bytes.
  res.outputResource(exe);
  const newExeBuffer = Buffer.from(exe.generate());
  const originalSize = exeBuffer.length;
  const newSize = newExeBuffer.length;

  console.log(`  Writing executable: ${originalSize} → ${newSize} bytes`);
  writeFileSync(exePath, newExeBuffer);

  // Verify the write succeeded
  const verifyBuffer = readFileSync(exePath);
  if (verifyBuffer.length === newSize) {
    console.log('  ✅ Executable written and verified');
  } else {
    console.warn(
      `  ⚠️  Size mismatch after write: expected ${newSize}, got ${verifyBuffer.length}`
    );
  }

  console.log('✨ Icon and metadata successfully applied!\n');
} catch (error) {
  console.error('❌ Error applying icon/metadata:', error.message);
  process.exit(1);
}
