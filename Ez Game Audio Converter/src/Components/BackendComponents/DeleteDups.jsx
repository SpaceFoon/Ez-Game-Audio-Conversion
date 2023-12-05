//deletes duplicate files with different extname
import { join, dirname, basename, extname } from "@tauri-apps/api/path";

export async function deleteDuplicateFiles(files){
    const priorityList = ['ogg', '.mp3', '.m4a', '.wav', '.flac'];
    //console.log('files', files);
    const fileobjs = files.map(file => [join(dirname(file), basename(file, extname(file))), extname(file)]);

    const uniq = new Map();

    for (const [name, ext] of fileobjs) {
        //console.log('name :>> ', name);
        //console.log('ext :>> ', ext);
        if(!uniq.has(name)) {
            uniq.set(name, ext);
            continue;
        }

        const current = uniq.get(name);
        // console.log('current :>> ', current);
        // console.log('priorityList.indexOf(ext) :>> ', priorityList.indexOf(ext));
        // console.log('priorityList.indexOf(current) :>> ', priorityList.indexOf(current));
        // console.log('priorityList.indexOf(ext) > priorityList.indexOf(current) :>> ', priorityList.indexOf(ext) > priorityList.indexOf(current));
        if(priorityList.indexOf(ext) > priorityList.indexOf(current)){
            uniq.set(name, ext)
        }
    }

    return Array.from(uniq.entries()).reduce((p,c) => [...p, `${c[0]}${c[1]}`], [])

}