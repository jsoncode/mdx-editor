use std::fs;
use std::path::Path;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::error::{AppError, AppResult};

struct ExportWindowGuard(WebviewWindow);

impl Drop for ExportWindowGuard {
    fn drop(&mut self) {
        let _ = self.0.close();
    }
}

#[cfg(windows)]
fn create_print_settings(
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
) -> AppResult<webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2PrintSettings> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, ICoreWebView2Environment6, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
    };
    use windows_core::Interface;

    #[allow(unsafe_code)]
    unsafe {
        let core2: ICoreWebView2_2 = core.cast().map_err(|_| {
            AppError::Other("无法读取 WebView 环境以配置 PDF 页面。".to_string())
        })?;
        let environment = core2
            .Environment()
            .map_err(|error| AppError::Other(format!("无法读取 WebView 环境: {error}")))?;
        let environment6: ICoreWebView2Environment6 = environment.cast().map_err(|_| {
            AppError::Other("当前 WebView2 版本过低，无法配置 PDF 页面。".to_string())
        })?;
        let settings = environment6
            .CreatePrintSettings()
            .map_err(|error| AppError::Other(format!("无法创建 PDF 打印设置: {error}")))?;

        const INCH_PER_MM: f64 = 1.0 / 25.4;
        settings
            .SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 方向: {error}")))?;
        settings
            .SetPageWidth(210.0 * INCH_PER_MM)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页宽: {error}")))?;
        settings
            .SetPageHeight(297.0 * INCH_PER_MM)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页高: {error}")))?;
        settings
            .SetMarginTop(18.0 * INCH_PER_MM)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页边距: {error}")))?;
        settings
            .SetMarginBottom(18.0 * INCH_PER_MM)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页边距: {error}")))?;
        settings
            .SetMarginLeft(16.0 * INCH_PER_MM)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页边距: {error}")))?;
        settings
            .SetMarginRight(16.0 * INCH_PER_MM)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页边距: {error}")))?;
        settings
            .SetShouldPrintBackgrounds(true)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 背景: {error}")))?;
        settings
            .SetShouldPrintHeaderAndFooter(false)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 页眉页脚: {error}")))?;
        settings
            .SetShouldPrintSelectionOnly(false)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 选区: {error}")))?;
        settings
            .SetScaleFactor(1.0)
            .map_err(|error| AppError::Other(format!("无法设置 PDF 缩放: {error}")))?;

        Ok(settings)
    }
}

#[cfg(windows)]
fn print_core_webview_to_pdf(
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
    output: &Path,
) -> AppResult<()> {
    use webview2_com::{
        CoTaskMemPWSTR,
        Microsoft::Web::WebView2::Win32::ICoreWebView2_7,
        PrintToPdfCompletedHandler,
    };
    use windows_core::Interface;

    #[allow(unsafe_code)]
    unsafe {
        let core7: ICoreWebView2_7 = core.cast().map_err(|_| {
            AppError::Other(
                "当前 WebView2 版本过低，无法导出 PDF。请更新 Microsoft Edge WebView2 运行时。"
                    .to_string(),
            )
        })?;

        let settings = create_print_settings(core)?;
        let path_string = output.to_string_lossy().to_string();
        let path_wide = CoTaskMemPWSTR::from(path_string.as_str());

        PrintToPdfCompletedHandler::wait_for_async_operation(
            Box::new(move |handler| {
                core7
                    .PrintToPdf(*path_wide.as_ref().as_pcwstr(), &settings, &handler)
                    .map_err(webview2_com::Error::WindowsError)
            }),
            Box::new(|error_code, is_successful| {
                error_code?;
                if !is_successful {
                    return Err(windows_core::Error::new(
                        windows_core::HRESULT(1),
                        "PrintToPdf 失败",
                    ));
                }
                Ok(())
            }),
        )
        .map_err(|error| AppError::Other(format!("PDF 导出失败: {error:?}")))?;
    }

    Ok(())
}

#[cfg(windows)]
fn wait_for_page_assets(
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
) -> AppResult<()> {
    use webview2_com::ExecuteScriptCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2;
    use windows_core::Interface;

    let core = core.clone();

    #[allow(unsafe_code)]
    unsafe {
        ExecuteScriptCompletedHandler::wait_for_async_operation(
            Box::new(move |handler| {
                let core: ICoreWebView2 = core.cast().map_err(webview2_com::Error::WindowsError)?;
                core.ExecuteScript(
                    windows_core::w!(
                        r#"(window.__pdfExportReady || Promise.resolve()).then(() => "ready")"#
                    ),
                    &handler,
                )
                .map_err(webview2_com::Error::WindowsError)
            }),
            Box::new(|error_code, _result| {
                error_code?;
                Ok(())
            }),
        )
        .map_err(|error| AppError::Other(format!("PDF 资源加载失败: {error:?}")))?;
    }

    Ok(())
}

#[cfg(windows)]
fn render_html_and_print_pdf(
    platform_webview: tauri::webview::PlatformWebview,
    html: &str,
    output: &Path,
) -> AppResult<()> {
    use webview2_com::{CoTaskMemPWSTR, NavigationCompletedEventHandler};

    #[allow(unsafe_code)]
    unsafe {
        let controller = platform_webview.controller();
        let core = controller
            .CoreWebView2()
            .map_err(|error| AppError::Other(format!("无法访问 PDF 导出 WebView: {error}")))?;

        let (tx, rx) = mpsc::channel();
        let handler = NavigationCompletedEventHandler::create(Box::new(move |_sender, args| {
            if let Some(args) = args {
                let mut success = windows_core::BOOL(0);
                if args.IsSuccess(&mut success).is_ok() && success.0 == 0 {
                    return Ok(());
                }
            }
            let _ = tx.send(());
            Ok(())
        }));

        let mut token = 0;
        core.add_NavigationCompleted(&handler, &mut token)
            .map_err(|error| AppError::Other(format!("无法监听 PDF 页面加载: {error}")))?;

        let html_wide = CoTaskMemPWSTR::from(html);
        core.NavigateToString(*html_wide.as_ref().as_pcwstr())
            .map_err(|error| AppError::Other(format!("无法加载 PDF 内容: {error}")))?;

        webview2_com::wait_with_pump(rx)
            .map_err(|error| AppError::Other(format!("PDF 页面加载失败: {error:?}")))?;

        core.remove_NavigationCompleted(token)
            .map_err(|error| AppError::Other(format!("无法清理 PDF 页面监听: {error}")))?;

        wait_for_page_assets(&core)?;
        print_core_webview_to_pdf(&core, output)?;
    }

    Ok(())
}

#[cfg(windows)]
fn export_html_to_pdf_on_window(
    window: &WebviewWindow,
    html: &str,
    output: &Path,
) -> AppResult<()> {
    let html = html.to_string();
    let output = output.to_path_buf();
    let result = Arc::new(Mutex::new(None::<AppResult<()>>));
    let result_for_webview = Arc::clone(&result);

    window
        .with_webview(move |platform_webview| {
            *result_for_webview
                .lock()
                .expect("pdf export result lock") = Some(render_html_and_print_pdf(
                platform_webview,
                &html,
                &output,
            ));
        })
        .map_err(|error| AppError::Other(format!("无法访问 PDF 导出 WebView: {error}")))?;

    let export_result = result.lock().expect("pdf export result lock").take();
    match export_result {
        Some(value) => value,
        None => Err(AppError::Other("PDF 导出未完成".to_string())),
    }
}

#[cfg(windows)]
pub fn export_html_to_pdf(app: &AppHandle, html: &str, output_path: &Path) -> AppResult<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let label = format!("pdf-export-{}", uuid::Uuid::new_v4());
    let about_blank = WebviewUrl::External(
        Url::parse("about:blank").map_err(|error| AppError::Other(error.to_string()))?,
    );

    let window = WebviewWindowBuilder::new(app, &label, about_blank)
        .visible(false)
        .skip_taskbar(true)
        .focused(false)
        .build()
        .map_err(|error| AppError::Other(format!("创建 PDF 导出窗口失败: {error}")))?;

    let _guard = ExportWindowGuard(window.clone());
    export_html_to_pdf_on_window(&window, html, output_path)
}

#[cfg(not(windows))]
pub fn export_html_to_pdf(_app: &AppHandle, _html: &str, output_path: &Path) -> AppResult<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    Err(AppError::Other(
        "PDF 导出当前仅支持 Windows 平台。".to_string(),
    ))
}
