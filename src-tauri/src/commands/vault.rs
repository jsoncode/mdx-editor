use crate::error::AppError;
use crate::vault::{
    create_vault_document, create_vault_folder, scan_vault, unique_document_name, VaultTreeNode,
};

#[tauri::command]
pub fn scan_vault_tree(vault_path: String) -> Result<Vec<VaultTreeNode>, AppError> {
    scan_vault(&vault_path)
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
