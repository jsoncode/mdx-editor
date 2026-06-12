#[cfg(windows)]
pub fn disable_browser_accelerator_keys(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|webview| {
        #[allow(unsafe_code)]
        unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings;
            use windows_core::Interface;

            let controller = webview.controller();
            let core = match controller.CoreWebView2() {
                Ok(core) => core,
                Err(_) => return,
            };
            let settings: ICoreWebView2Settings = match core.Settings() {
                Ok(settings) => settings,
                Err(_) => return,
            };
            let settings3: ICoreWebView2Settings3 = match settings.cast() {
                Ok(settings3) => settings3,
                Err(_) => return,
            };
            let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
        }
    });
}

#[cfg(not(windows))]
pub fn disable_browser_accelerator_keys(_window: &tauri::WebviewWindow) {}
