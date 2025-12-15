/**
 * Icon and metadata injection script using resedit
 *
 * This script adds icon and version information to the Windows executable.
 * Only runs on Windows and only if resedit is installed.
 *
 * To enable: npm install --save-dev resedit
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (platform() !== 'win32') {
  console.log('⚠️  Icon script only works on Windows - skipping');
  process.exit(0);
}

try {
  // Try to import resedit
  const ResEdit = await import('resedit').catch(() => null);

  if (!ResEdit) {
    console.log('⚠️  resedit not installed - skipping icon/metadata');
    console.log('    Install with: npm install --save-dev resedit');
    process.exit(0);
  }

  const exePath = join(__dirname, '../../release/ez-game-audio.exe');
  const iconPath = join(__dirname, '../../media/ico/icon.ico');

  console.log('🎨 Adding icon and metadata to executable...');

  // Read the executable
  const exe = ResEdit.NtExecutable.from(readFileSync(exePath));
  const res = ResEdit.NtExecutableResource.from(exe);

  // Add icon
  try {
    const iconFile = ResEdit.Data.IconFile.from(readFileSync(iconPath));
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1, // Icon ID
      1033, // Language (English US)
      iconFile.icons.map((icon) => icon.data)
    );
    console.log('  ✅ Icon added');
  } catch (error) {
    console.log('  ⚠️  Could not add icon:', error.message);
  }

  // Add version information
  try {
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8')
    );

    const versionInfo = ResEdit.Resource.VersionInfo.createEmpty();
    versionInfo.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        ProductName: 'EZ Game Audio Conversion',
        FileDescription: 'Batch audio converter for game developers',
        CompanyName: packageJson.author || 'SpaceFoon',
        LegalCopyright: '© 2024',
        FileVersion: packageJson.version,
        ProductVersion: packageJson.version,
      }
    );

    versionInfo.setFileVersion(
      ...packageJson.version.split('.').map(Number),
      0
    );
    versionInfo.setProductVersion(
      ...packageJson.version.split('.').map(Number),
      0
    );

    versionInfo.outputToResourceEntries(res.entries);
    console.log('  ✅ Version info added');
  } catch (error) {
    console.log('  ⚠️  Could not add version info:', error.message);
  }

  // Write the modified executable
  res.outputResource(exe);
  writeFileSync(exePath, Buffer.from(exe.generate()));

  console.log('✨ Icon and metadata successfully applied!\n');
} catch (error) {
  console.error('❌ Error applying icon/metadata:', error.message);
  process.exit(1);
}
