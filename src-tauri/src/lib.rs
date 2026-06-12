mod asset_refs;
mod clipboard;
mod commands;
mod error;
mod git_sync;
mod launch;
mod manifest;
mod manifest_io;
mod mdx;
mod vault;
mod versions;
mod workspace;

use launch::{collect_mdx_paths_from_args, handle_open_files, LaunchState};
use tauri::Manager;
#[cfg(any(target_os = "macos", target_os = "ios"))]
use tauri::RunEvent;
use workspace::WorkspaceManager;

#[tauri::command]
fn take_launch_file(state: tauri::State<'_, LaunchState>) -> Option<String> {
    state.take_pending()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    if let Some(job_path) = git_sync::try_parse_cli_job(&args) {
        if let Err(error) = git_sync::run_job(&job_path) {
            eprintln!("Git sync job failed: {error}");
            std::process::exit(1);
        }
        std::process::exit(0);
    }

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = collect_mdx_paths_from_args(argv.into_iter().skip(1));
            handle_open_files(app, paths, true);
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(WorkspaceManager::new())
        .manage(LaunchState::new())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            let paths = collect_mdx_paths_from_args(std::env::args().skip(1));
            if !paths.is_empty() {
                handle_open_files(app.handle(), paths, false);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            take_launch_file,
            commands::create_document,
            commands::open_document,
            commands::update_document_content,
            commands::save_document,
            commands::autosave_document,
            commands::close_document,
            commands::get_document_manifest,
            commands::apply_document_metadata,
            commands::set_document_file_path,
            commands::get_document_versions,
            commands::append_document_version,
            commands::clear_document_versions,
            commands::scan_vault_tree,
            commands::create_vault_folder_cmd,
            commands::create_vault_document_cmd,
            commands::suggest_vault_document_name,
            commands::get_vault_item_info_cmd,
            commands::delete_vault_file_cmd,
            commands::delete_vault_folder_cmd,
            commands::rename_vault_item_cmd,
            commands::reveal_vault_item_cmd,
            commands::insert_asset_from_path,
            commands::insert_asset_from_bytes,
            commands::read_clipboard_file_paths,
            commands::list_assets,
            commands::get_asset_absolute_path,
            commands::export_markdown,
            commands::export_html,
            commands::git_sync_pull,
            commands::git_sync_push,
            commands::git_sync_test,
            commands::git_sync_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let RunEvent::Opened { urls } = event {
                let paths = launch::paths_from_opened_urls(urls);
                if !paths.is_empty() {
                    handle_open_files(app, paths, true);
                }
            }

            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            let _ = (app, event);
        });
}
