use std::path::PathBuf;

fn main() {
    println!("cargo::rustc-check-cfg=cfg(gui_stub)");
    let dist =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("gui/dist");
    println!("cargo:rerun-if-changed={}", dist.display());
    if dist.join("index.html").is_file() {
        return;
    }
    if std::env::var("PROFILE").unwrap() == "release" {
        panic!("gui/dist/index.html missing — run `bun run build` in gui/ first");
    }
    println!("cargo:rustc-cfg=gui_stub");
    println!("cargo:warning=gui/dist missing — embedding stub page (debug only)");
}
