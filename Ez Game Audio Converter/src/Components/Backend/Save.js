export async function SaveLogs(logs) {
  //save logs
}

import { appCacheDir } from '@tauri-apps/api/path'
    //import { save } from '@tauri-apps/api/dialog';
export async function SaveSetting(){
    //save dark/light mode and last folder

// const filePath = await save({
//   filters: [{
//     name: 'Image',
//     extensions: ['png', 'jpeg']
//   }]
// });
    
}
const appCacheDirPath = await appCacheDir();
console.log(appCacheDirPath, "appCacheDirPath")
