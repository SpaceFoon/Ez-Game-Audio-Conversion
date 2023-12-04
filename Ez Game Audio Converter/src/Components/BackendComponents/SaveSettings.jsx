
import { appCacheDir } from '@tauri-apps/api/path'

export async function SaveSetting(settings){
    //save dark/light mode and last folder
    
}
const appCacheDirPath = await appCacheDir();
console.log(appCacheDirPath, "appCacheDirPath")
