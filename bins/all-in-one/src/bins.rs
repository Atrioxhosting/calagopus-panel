use std::path::PathBuf;
use tokio::io::AsyncWriteExt;

pub const WINGS_VERSION: &str = env!("WINGS_VERSION");
pub static WINGS_BIN: &[u8] = include_bytes!("../bins/wings-rs");

pub async fn get_wings_bin_path() -> Result<PathBuf, std::io::Error> {
    pub static BIN_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _lock = BIN_LOCK.lock().await;

    let tmp_dir = std::env::temp_dir().join("calagopus");
    match tokio::fs::create_dir(&tmp_dir).await {
        Ok(()) => {
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let perms = std::fs::Permissions::from_mode(0o700);
                tokio::fs::set_permissions(&tmp_dir, perms).await?;
            }
        }
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
            let metadata = tokio::fs::symlink_metadata(&tmp_dir).await?;

            #[cfg(unix)]
            let owned = {
                use std::os::unix::fs::MetadataExt;
                metadata.uid() == rustix::process::geteuid().as_raw()
                    && metadata.mode() & 0o077 == 0
            };
            #[cfg(not(unix))]
            let owned = true;

            if !metadata.is_dir() || !owned {
                return Err(std::io::Error::other(format!(
                    "{} exists but is not a private directory owned by this process",
                    tmp_dir.display()
                )));
            }
        }
        Err(err) => return Err(err),
    }

    let decompressed =
        tokio::task::spawn_blocking(|| zstd::decode_all(WINGS_BIN).map_err(std::io::Error::other))
            .await??;

    let tmp_path = tmp_dir.join("panel_wings_bin_tmp");
    match tokio::fs::remove_file(&tmp_path).await {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => return Err(err),
    }

    let mut options = tokio::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    options.mode(0o755);

    let mut file = options.open(&tmp_path).await?;
    file.write_all(&decompressed).await?;
    file.flush().await?;
    drop(file);

    let bin_path = tmp_dir.join(format!("panel_wings_bin_{WINGS_VERSION}"));
    tokio::fs::rename(&tmp_path, &bin_path).await?;

    Ok(bin_path)
}
