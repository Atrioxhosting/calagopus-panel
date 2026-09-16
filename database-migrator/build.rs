use serde::Serialize;
use std::{fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=../database/migrations");
    println!("cargo:rerun-if-changed=../database/extension-migrations");

    let migrations_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap())
        .join("..")
        .join("database")
        .join("migrations");

    let out_dir = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("migrations");
    if out_dir.exists() {
        fs::remove_dir_all(&out_dir).expect("Failed to clear migrations");
    }
    fs::create_dir_all(&out_dir).expect("Failed to create migrations");

    for entry in fs::read_dir(&migrations_dir).expect("Failed to read database/migrations") {
        let entry = entry.expect("Failed to read migration entry");
        if !entry.path().is_dir() {
            continue;
        }

        let destination = out_dir.join(entry.file_name());
        fs::create_dir_all(&destination).expect("Failed to create migration directory");
        fs::copy(
            entry.path().join("migration.sql"),
            destination.join("migration.sql"),
        )
        .unwrap_or_else(|e| panic!("Failed to copy {}: {e}", entry.path().display()));

        let snapshot: serde_json::Value = serde_json::from_slice(
            &fs::read(entry.path().join("snapshot.json"))
                .unwrap_or_else(|e| panic!("Failed to read {}: {e}", entry.path().display())),
        )
        .unwrap_or_else(|e| panic!("Failed to parse {}: {e}", entry.path().display()));

        let mut summary = Summary::default();
        for ddl_entry in snapshot["ddl"].as_array().into_iter().flatten() {
            match ddl_entry["entityType"].as_str() {
                Some("tables") => summary.tables += 1,
                Some("sequences") => summary.sequences += 1,
                Some("enums") => summary.enums += 1,
                Some("columns") => summary.columns += 1,
                Some("indexes") => summary.indexes += 1,
                Some("fks") => summary.foreign_keys += 1,
                Some("pks") => summary.primary_keys += 1,
                _ => {}
            }
        }

        fs::write(
            destination.join("snapshot.json"),
            serde_json::json!({
                "id": snapshot["id"],
                "summary": summary,
            })
            .to_string(),
        )
        .expect("Failed to write reduced snapshot");
    }
}

#[derive(Default, Serialize)]
struct Summary {
    tables: usize,
    sequences: usize,
    enums: usize,
    columns: usize,
    indexes: usize,
    foreign_keys: usize,
    primary_keys: usize,
}
