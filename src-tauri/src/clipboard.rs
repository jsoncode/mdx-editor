use crate::error::AppError;

#[cfg(target_os = "windows")]
pub fn read_file_paths() -> Result<Vec<String>, AppError> {
    use clipboard_win::{formats, get_clipboard};

    match get_clipboard::<Vec<String>, _>(formats::FileList) {
        Ok(paths) => Ok(paths),
        Err(_) => Ok(Vec::new()),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn read_file_paths() -> Result<Vec<String>, AppError> {
    Ok(Vec::new())
}
