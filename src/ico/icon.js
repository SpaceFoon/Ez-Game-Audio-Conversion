const fs = require("fs");
const { load } = require("resedit/cjs");
load().then((ResEdit) => {
  console.log("Icon generator started");
  // ResEdit will be the namespace object of resedit library
  // (for example ResEdit.Data.IconFile is available)
  function windowsPostBuild(output) {
    const exe = ResEdit.NtExecutable.from(fs.readFileSync(output));
    const res = ResEdit.NtExecutableResource.from(exe);
    const iconFile = ResEdit.Data.IconFile.from(
      fs.readFileSync("./src/ico/icon.ico")
    );

    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      1033,
      iconFile.icons.map((item) => item.data)
    );

    const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];

    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        ProductName: "EZ Game Audio Conversion",
        FileDescription: "Simple Game Audio Conversion Tool.",
        CompanyName: "Fooney",
        LegalCopyright: `GPL-3.0`,
      }
    );
    vi.removeStringValue({ lang: 1033, codepage: 1200 }, "OriginalFilename");
    vi.removeStringValue({ lang: 1033, codepage: 1200 }, "InternalName");
    vi.setFileVersion(1, 4, 3, 0);
    vi.setProductVersion(1, 4, 3, 0);
    vi.outputToResourceEntries(res.entries);
    res.outputResource(exe);
    fs.writeFileSync(output, Buffer.from(exe.generate()));
  }
  windowsPostBuild("./dist/EZ-Game-Audio-Conversion/EZ-Game-Audio.exe");
});
