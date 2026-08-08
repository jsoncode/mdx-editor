use tauri::{AppHandle, Manager, WebviewWindow};

use crate::error::{AppError, AppResult};

fn toggle_window_devtools(window: &WebviewWindow) -> AppResult<bool> {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        #[cfg(target_os = "windows")]
        {
            window.open_devtools();
            return Ok(true);
        }

        #[cfg(not(target_os = "windows"))]
        {
            if window.is_devtools_open() {
                window.close_devtools();
                Ok(false)
            } else {
                window.open_devtools();
                Ok(true)
            }
        }
    }

    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        Err(AppError::Other(
            "开发者工具仅在调试版中可用，请使用 npm run tauri dev 启动。".to_string(),
        ))
    }
}

#[tauri::command]
pub fn toggle_devtools(app: AppHandle) -> Result<bool, AppError> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::Other("主窗口不存在".to_string()))?;
    toggle_window_devtools(&window)
}

#[tauri::command]
pub fn open_devtools(app: AppHandle) -> Result<(), AppError> {
    #[cfg(any(debug_assertions, feature = "devtools"))]
    {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| AppError::Other("主窗口不存在".to_string()))?;
        window.open_devtools();
        return Ok(());
    }

    #[cfg(not(any(debug_assertions, feature = "devtools")))]
    {
        Err(AppError::Other(
            "开发者工具仅在调试版中可用，请使用 npm run tauri dev 启动。".to_string(),
        ))
    }
}
