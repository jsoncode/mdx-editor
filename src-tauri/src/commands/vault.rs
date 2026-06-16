use crate::error::AppError;
use crate::vault::{
    create_vault_document, create_vault_folder, delete_vault_file, delete_vault_folder,
    get_vault_item_info, move_vault_item, rename_vault_item, reveal_vault_item, scan_vault,
    unique_document_name, VaultItemInfo, VaultTreeNode,
};

#[tauri::command]
pub async fn scan_vault_tree(vault_path: String) -> Result<Vec<VaultTreeNode>, AppError> {
    tauri::async_runtime::spawn_blocking(move || scan_vault(&vault_path))
        .await
        .map_err(|error| AppError::Other(format!("扫描工作区失败: {error}")))?
}

#[tauri::command]
pub fn create_vault_folder_cmd(vault_path: String, relative_path: String) -> Result<(), AppError> {
    create_vault_folder(&vault_path, &relative_path)
}

#[tauri::command]
pub fn create_vault_document_cmd(
    vault_path: String,
    relative_path: String,
) -> Result<String, AppError> {
    create_vault_document(&vault_path, &relative_path)
}

#[tauri::command]
pub fn suggest_vault_document_name(
    vault_path: String,
    folder_relative: String,
    base_name: String,
) -> Result<String, AppError> {
    unique_document_name(&vault_path, &folder_relative, &base_name)
}

#[tauri::command]
pub fn get_vault_item_info_cmd(
    vault_path: String,
    item_path: String,
) -> Result<VaultItemInfo, AppError> {
    get_vault_item_info(&vault_path, &item_path)
}

#[tauri::command]
pub fn delete_vault_file_cmd(vault_path: String, file_path: String) -> Result<(), AppError> {
    delete_vault_file(&vault_path, &file_path)
}

#[tauri::command]
pub fn delete_vault_folder_cmd(vault_path: String, relative_path: String) -> Result<(), AppError> {
    delete_vault_folder(&vault_path, &relative_path)
}

#[tauri::command]
pub fn rename_vault_item_cmd(
    vault_path: String,
    relative_path: String,
    new_name: String,
    is_folder: bool,
) -> Result<String, AppError> {
    rename_vault_item(&vault_path, &relative_path, &new_name, is_folder)
}

#[tauri::command]
pub fn move_vault_item_cmd(
    vault_path: String,
    relative_path: String,
    target_folder_relative: String,
    is_folder: bool,
) -> Result<String, AppError> {
    move_vault_item(
        &vault_path,
        &relative_path,
        &target_folder_relative,
        is_folder,
    )
}

#[tauri::command]
pub fn reveal_vault_item_cmd(item_path: String) -> Result<(), AppError> {
    reveal_vault_item(&item_path)
}
