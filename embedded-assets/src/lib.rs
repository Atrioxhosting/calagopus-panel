use include_dir::{Dir, include_dir};

static FRONTEND_ASSETS: Dir<'static> = include_dir!("$OUT_DIR/frontend-dist");
static EXTENSION_MIGRATIONS: Dir<'static> =
    include_dir!("$CARGO_MANIFEST_DIR/../database/extension-migrations");
const INDEX_HTML: &str = include_str!("../../frontend/dist/index.html");

pub fn register() {
    shared::register_frontend(shared::EmbeddedFrontend {
        assets: &FRONTEND_ASSETS,
        index_html: INDEX_HTML,
    });
    database_migrator::register_extension_migrations(&EXTENSION_MIGRATIONS);
}
