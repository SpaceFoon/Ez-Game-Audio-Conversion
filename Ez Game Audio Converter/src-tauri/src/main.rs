// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
use std::process::Command as StdCommand;

#[tauri::command]
fn play_midi_file(path: String) -> Result<(), String> {
    let _ = StdCommand::new("play_midi_file")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, play_midi_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
