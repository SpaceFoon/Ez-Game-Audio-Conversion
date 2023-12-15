// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }
use std::process::Command as StdCommand;

#[tauri::command]
fn play_midi_file(path: String) -> Result<(), String> {
    let _ = StdCommand::new("play_midi_file")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn convert_audio(
    input_file: String,
    output_file: String,
    output_format: String,
    codec: String,
    additional_options: String,
) -> Result<(), String> {
    let (codec, additional_options) = match output_format.as_str() {
        "ogg" => ("libopus", vec!["-b:a", "192k"]),
        "mp3" => ("libmp3lame", vec!["-q:a", "3"]),
        "wav" => ("pcm_s16le", vec![]),
        "m4a" => ("aac", vec!["-q:a", "1.0"]),
        "flac" => ("flac", vec!["-compression_level", "8"]),
        _ => return Err(format!("Unsupported output format: {}", output_format)),
    };
    // Use the Command struct from the std::process module to spawn a new process
    let output = std::process::Command::new("ffmpeg")
        .arg("-i")
        .arg(input_file)
        .arg("-c:a")
        .arg(codec)
        .args(additional_options)
        .arg("-y")
        .arg(output_file)
        .output()
        .expect("Failed to execute command");

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![convert_audio, play_midi_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
