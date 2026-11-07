use std::fs;
use std::path::{Path, PathBuf};

/// 用户数据根目录 = exe 所在文件夹下的 data/。
/// 用户要求所有数据存在 exe 所在文件夹、分类子目录、明文可读（2026-11-07）。
fn data_root() -> Result<PathBuf, String> {
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let dir = exe.parent().ok_or("exe 无父目录")?.join("data");
  // 必须先建目录：resolve 的越界检查依赖 canonicalize，目录不存在时
  // canonicalize 失败回退原路径，anchor 上溯到 exe 目录会被误判越界
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

/// 把相对路径解析到数据根内，拒绝任何越出数据根的路径（防 ../ 穿越）。
fn resolve(rel: &str) -> Result<PathBuf, String> {
  let root = data_root()?;
  let clean = rel.replace('\\', "/");
  let target = root.join(clean.trim_start_matches('/'));
  let root_canon = root.canonicalize().map_err(|e| e.to_string())?;
  // 目标可能尚不存在，对已存在的最深祖先做 canonicalize 再比较
  let mut anchor = target.clone();
  while !anchor.exists() {
    match anchor.parent() {
      Some(p) => anchor = p.to_path_buf(),
      None => break,
    }
  }
  let anchor_canon = anchor.canonicalize().unwrap_or(anchor);
  if !anchor_canon.starts_with(&root_canon) {
    return Err(format!("路径越出数据目录: {rel}"));
  }
  Ok(target)
}

#[tauri::command]
fn data_read_text(rel: String) -> Result<String, String> {
  let p = resolve(&rel)?;
  if !p.exists() {
    return Err("ENOENT".into());
  }
  fs::read_to_string(&p).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_write_text(rel: String, content: String) -> Result<(), String> {
  let p = resolve(&rel)?;
  if let Some(parent) = p.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(&p, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_write_bytes(rel: String, bytes: Vec<u8>) -> Result<(), String> {
  let p = resolve(&rel)?;
  if let Some(parent) = p.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::write(&p, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_read_bytes(rel: String) -> Result<Vec<u8>, String> {
  let p = resolve(&rel)?;
  if !p.exists() {
    return Err("ENOENT".into());
  }
  fs::read(&p).map_err(|e| e.to_string())
}

#[tauri::command]
fn data_delete(rel: String) -> Result<(), String> {
  let p = resolve(&rel)?;
  if p.is_dir() {
    fs::remove_dir_all(&p).map_err(|e| e.to_string())
  } else {
    fs::remove_file(&p).map_err(|e| e.to_string())
  }
}

#[tauri::command]
fn data_exists(rel: String) -> Result<bool, String> {
  let p = resolve(&rel)?;
  Ok(p.exists())
}

/// 把 exe 同目录或资源里的文件拷进数据目录（首次迁移视频用）。
#[tauri::command]
fn data_copy_from(rel_src: String, rel_dst: String) -> Result<(), String> {
  let src = Path::new(&rel_src);
  let dst = resolve(&rel_dst)?;
  if !src.exists() {
    return Err("ENOENT".into());
  }
  if let Some(parent) = dst.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  fs::copy(src, &dst).map_err(|e| e.to_string())?;
  Ok(())
}

/// 递归列出数据根下所有文件的相对路径（正斜杠），供导出打包遍历。
fn walk_files(dir: &Path, root: &Path, acc: &mut Vec<String>) -> Result<(), String> {
  for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let p = entry.path();
    if p.is_dir() {
      walk_files(&p, root, acc)?;
    } else if let Ok(rel) = p.strip_prefix(root) {
      acc.push(rel.to_string_lossy().replace('\\', "/"));
    }
  }
  Ok(())
}

#[tauri::command]
fn data_list() -> Result<Vec<String>, String> {
  let root = data_root()?;
  let mut out = Vec::new();
  walk_files(&root, &root, &mut out)?;
  out.sort();
  Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      data_read_text,
      data_write_text,
      data_write_bytes,
      data_read_bytes,
      data_delete,
      data_exists,
      data_copy_from,
      data_list
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
