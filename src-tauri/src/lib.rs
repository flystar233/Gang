//! Tauri 应用库入口
//! 
//! 包含应用构建逻辑，支持桌面和移动平台

mod commands;
mod constants;
mod error;
mod http_client;
mod proxy;

#[cfg(desktop)]
use tauri::Manager;
#[cfg(desktop)]
use commands::CloseActionState;

/// 构建并运行 Tauri 应用
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init());
    
    #[cfg(desktop)]
    let builder = {
        let builder = builder.manage(CloseActionState::new());
        let builder = builder.setup(|app| {
            // 创建系统托盘菜单项（仅桌面平台）
            let show_item = tauri::menu::MenuItem::with_id(app, "show", "显示", true, None::<&str>)?;
            let hide_item = tauri::menu::MenuItem::with_id(app, "hide", "隐藏", true, None::<&str>)?;
            let quit_item = tauri::menu::MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            
            // 创建菜单
            let menu = tauri::menu::Menu::with_items(app, &[
                &show_item,
                &hide_item,
                &quit_item,
            ])?;
            
            // 创建系统托盘图标
            let mut tray_builder = tauri::tray::TrayIconBuilder::with_id("main_tray");
            
            // 如果应用有默认图标，则使用它
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            
            let _tray = tray_builder
                .menu(&menu)
                .tooltip("纲一下")
                .on_menu_event(|app, event| {
                    if let Some(window) = app.get_webview_window("main") {
                        match event.id.as_ref() {
                            "show" => {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            "hide" => {
                                let _ = window.hide();
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                // 点击托盘图标时，显示窗口并聚焦
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();
                            }
                        }
                    }
                })
                .build(app)?;
            
            Ok(())
        });
        
        builder.on_window_event(|app, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 根据设置决定是退出还是隐藏窗口
                let close_action = app.state::<CloseActionState>().get();
                if close_action == "quit" {
                    // 退出程序 - 不阻止关闭，让窗口正常关闭
                    // 当所有窗口关闭时，应用会自动退出
                } else {
                    // 隐藏窗口到托盘
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                    api.prevent_close();
                }
            }
        })
    };
    
    builder
        .invoke_handler(tauri::generate_handler![
            commands::minimize_window,
            commands::close_window,
            commands::hide_window,
            commands::select_folder,
            commands::download_file,
            commands::get_app_version,
            commands::check_for_update,
            commands::download_update,
            commands::install_update,
            commands::http_request,
            commands::proxy_audio,
            commands::start_proxy_server,
            commands::set_close_action,
            commands::get_close_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
