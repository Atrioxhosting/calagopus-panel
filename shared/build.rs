use flate2::{Compression, read::GzDecoder, write::GzEncoder};
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::Command,
};

const COMPRESSIBLE_EXTENSIONS: &[&str] = &[
    "css",
    "html",
    "ico",
    "js",
    "json",
    "svg",
    "webmanifest",
    "woff",
];
const MIN_COMPRESS_SIZE: usize = 1024;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let is_git_repo = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if is_git_repo {
        println!("cargo:rerun-if-changed=../.git/HEAD");

        if let Ok(head) = std::fs::read_to_string("../.git/HEAD")
            && head.starts_with("ref: ")
        {
            let head_ref = head.trim_start_matches("ref: ").trim();
            println!("cargo:rerun-if-changed=../.git/{head_ref}");
            println!(
                "cargo:rustc-env=CARGO_GIT_BRANCH={}",
                head_ref.rsplit('/').next().unwrap_or("unknown")
            );
        } else {
            println!("cargo:rustc-env=CARGO_GIT_BRANCH=unknown");
        }

        println!("cargo:rerun-if-changed=../.git/index");
    } else {
        println!("cargo:rustc-env=CARGO_GIT_BRANCH=unknown");
    }

    let mut git_hash = "unknown".to_string();

    if is_git_repo
        && let Ok(output) = Command::new("git")
            .args(["rev-parse", "--short", "HEAD"])
            .output()
        && output.status.success()
        && let Ok(hash) = String::from_utf8(output.stdout)
    {
        git_hash = hash.trim().to_string();
    }

    let target_arch =
        std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "unknown".to_string());
    let target_env = if std::env::var("CARGO_CFG_TARGET_ENV").is_ok_and(|s| s.is_empty()) {
        "unknown".to_string()
    } else {
        std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_else(|_| "unknown".to_string())
    };

    println!("cargo:rustc-env=CARGO_GIT_COMMIT={git_hash}");
    println!("cargo:rustc-env=CARGO_TARGET={target_arch}-{target_env}");

    slim_frontend_dist();
}

fn slim_frontend_dist() {
    let dist_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
        .join("..")
        .join("frontend")
        .join("dist");
    println!("cargo:rerun-if-changed={}", dist_dir.display());

    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("frontend-dist");
    if out_dir.exists() {
        fs::remove_dir_all(&out_dir).expect("Failed to clear frontend-dist");
    }
    fs::create_dir_all(&out_dir).expect("Failed to create frontend-dist");

    if !dist_dir.is_dir() {
        panic!(
            "frontend/dist not found at {}, build the frontend first",
            dist_dir.display()
        );
    }

    slim_dir(&dist_dir, &out_dir).expect("Failed to slim frontend/dist");
}

fn slim_dir(source: &Path, destination: &Path) -> io::Result<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();

        if path.is_dir() {
            let destination = destination.join(&file_name);
            fs::create_dir_all(&destination)?;
            slim_dir(&path, &destination)?;
            continue;
        }

        let name = file_name.to_string_lossy();
        if name.ends_with(".gz") {
            continue;
        }

        let destination_gz = destination.join(format!("{name}.gz"));
        let contents = fs::read(&path)?;

        let mut gz_path = path.clone().into_os_string();
        gz_path.push(".gz");
        if let Ok(twin) = fs::read(&gz_path)
            && gzip_matches(&twin, &contents)
        {
            fs::write(&destination_gz, twin)?;
            continue;
        }

        if contents.len() >= MIN_COMPRESS_SIZE
            && path
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| {
                    COMPRESSIBLE_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str())
                })
        {
            let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
            io::Write::write_all(&mut encoder, &contents)?;
            let compressed = encoder.finish()?;

            if compressed.len() < contents.len() {
                fs::write(&destination_gz, compressed)?;
                continue;
            }
        }

        fs::copy(&path, destination.join(&file_name))?;
    }

    Ok(())
}

fn gzip_matches(compressed: &[u8], contents: &[u8]) -> bool {
    let mut decompressed = Vec::with_capacity(contents.len());

    io::Read::read_to_end(&mut GzDecoder::new(compressed), &mut decompressed).is_ok()
        && decompressed == contents
}
