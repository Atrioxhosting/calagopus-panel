use super::BuildStage;

const OOM_MARKERS: [&str; 2] = ["SIGKILL", "signal: 9"];

#[derive(Debug, Clone)]
pub struct Suspect {
    pub package_name: String,
    pub identifier: String,
    pub npm_name: Option<String>,
}

impl Suspect {
    pub fn from_identifier(identifier: &str, npm_name: Option<String>) -> Self {
        Self {
            package_name:
                shared::extensions::distr::MetadataToml::convert_identifier_to_package_name(
                    identifier,
                ),
            identifier: identifier.to_string(),
            npm_name,
        }
    }

    fn named_in(&self, text: &str) -> bool {
        contains_token(text, &self.identifier, |_| true)
            || contains_token(text, &self.package_name, |_| true)
            || self
                .npm_name
                .as_deref()
                .is_some_and(|name| contains_token(text, name, |after| after.starts_with('@')))
    }
}

pub fn blame(log: &str, suspects: &[Suspect]) -> Vec<String> {
    let log = strip_ansi(log);
    let lines: Vec<&str> = log.lines().collect();

    let Some((stage_at, stage)) = lines
        .iter()
        .enumerate()
        .rev()
        .find_map(|(index, line)| Some((index, super::classify_stage(line)?)))
    else {
        return Vec::new();
    };
    let stage_lines = &lines[stage_at + 1..];

    let errors = match stage {
        BuildStage::BuildingBackend => cargo_errors(stage_lines),
        BuildStage::InstallingDependencies | BuildStage::BuildingFrontend => {
            node_errors(stage_lines)
        }
    };

    suspects
        .iter()
        .filter(|suspect| errors.iter().any(|error| suspect.named_in(error)))
        .map(|suspect| suspect.package_name.clone())
        .collect()
}

fn cargo_errors(lines: &[&str]) -> Vec<String> {
    let last_attempt = lines
        .iter()
        .rposition(|line| {
            let line = line.trim();
            line.starts_with("using ") && line.ends_with(" parallel jobs")
        })
        .map_or(lines, |index| &lines[index + 1..]);

    let mut blocks = Vec::new();
    let mut current: Option<String> = None;

    for line in last_attempt {
        if starts_cargo_error(line) {
            blocks.extend(current.replace(line.to_string()));
        } else if line.trim().is_empty() || line.starts_with("warning") {
            blocks.extend(current.take());
        } else if let Some(block) = current.as_mut() {
            block.push('\n');
            block.push_str(line);
        }
    }
    blocks.extend(current);

    blocks.retain(|block| !OOM_MARKERS.iter().any(|marker| block.contains(marker)));

    blocks
}

fn starts_cargo_error(line: &str) -> bool {
    let Some(rest) = line.strip_prefix("error") else {
        return false;
    };

    let rest = match rest.strip_prefix("[E") {
        Some(code) => match code.split_once(']') {
            Some((digits, rest))
                if !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()) =>
            {
                rest
            }
            _ => return false,
        },
        None => rest,
    };

    rest.starts_with(':')
}

fn node_errors(lines: &[&str]) -> Vec<String> {
    let Some(start) = lines.iter().position(|line| {
        line.trim_start().to_ascii_lowercase().starts_with("error") || line.contains("ERR_PNPM")
    }) else {
        return Vec::new();
    };

    vec![lines[start..].join("\n")]
}

fn is_word_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}

fn contains_token(text: &str, token: &str, accept_after: impl Fn(&str) -> bool) -> bool {
    if token.is_empty() {
        return false;
    }

    text.match_indices(token).any(|(start, _)| {
        let end = start + token.len();
        let before = text.as_bytes()[..start].last().copied();
        let after = text.as_bytes().get(end).copied();

        !before.is_some_and(is_word_byte)
            && !after.is_some_and(is_word_byte)
            && accept_after(&text[end..])
    })
}

fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();

    while let Some(c) = chars.next() {
        if c != '\u{1b}' {
            out.push(c);
            continue;
        }

        if chars.clone().next() == Some('[') {
            chars.next();
            for c in chars.by_ref() {
                if ('@'..='~').contains(&c) {
                    break;
                }
            }
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn suspect(identifier: &str, npm_name: Option<&str>) -> Suspect {
        Suspect::from_identifier(identifier, npm_name.map(String::from))
    }

    fn broken_and_fine() -> Vec<Suspect> {
        vec![
            suspect("dev_test_broken", None),
            suspect("dev_test_fine", None),
        ]
    }

    const CARGO_LOG: &str = "building backend...
using 4 parallel jobs
   Compiling dev_test_broken v1.0.0 (/app/backend-extensions/dev_test_broken)
   Compiling dev_test_fine v1.0.0 (/app/backend-extensions/dev_test_fine)
warning: unused variable: `unused`
 --> backend-extensions/dev_test_fine/src/lib.rs:1:25
  |
1 | pub fn f() -> u32 { let unused = 1; 2 }
  |                         ^^^^^^ help: if this is intentional, prefix it with an underscore: `_unused`

error[E0425]: cannot find value `nope` in this scope
 --> backend-extensions/dev_test_broken/src/lib.rs:1:37
  |
1 | pub fn f() -> u32 { let unused = 1; nope }
  |                                     ^^^^ not found in this scope

warning: `dev_test_fine` (lib) generated 1 warning
For more information about this error, try `rustc --explain E0425`.
error: could not compile `dev_test_broken` (lib) due to 1 previous error
";

    // Suspect::from_identifier
    #[test]
    fn from_identifier_maps_underscores_to_dots() {
        let s = suspect("dev_acme_tickets", Some("tickets-frontend"));
        assert_eq!(s.package_name, "dev.acme.tickets");
        assert_eq!(s.identifier, "dev_acme_tickets");
        assert_eq!(s.npm_name.as_deref(), Some("tickets-frontend"));
    }

    // blame
    #[test]
    fn cargo_error_blames_broken_not_warned() {
        assert_eq!(
            blame(CARGO_LOG, &broken_and_fine()),
            vec!["dev.test.broken"]
        );
    }

    #[test]
    fn cargo_oom_blames_nobody() {
        let log = "building backend...
using 4 parallel jobs
   Compiling dev_test_fine v1.0.0 (/app/backend-extensions/dev_test_fine)
error: could not compile `dev_test_fine` (lib)
Caused by:
  process didn't exit successfully: `rustc --crate-name dev_test_fine` (signal: 9, SIGKILL: kill)
";
        assert!(blame(log, &broken_and_fine()).is_empty());
    }

    #[test]
    fn cargo_only_last_attempt_counts() {
        let log = "building backend...
using 8 parallel jobs
error: could not compile `dev_test_fine` (lib) due to 1 previous error

using 4 parallel jobs
error: could not compile `dev_test_broken` (lib) due to 1 previous error
";
        assert_eq!(blame(log, &broken_and_fine()), vec!["dev.test.broken"]);
    }

    #[test]
    fn no_stage_marker_blames_nobody() {
        let log = "error: could not compile `dev_test_broken` (lib) due to 1 previous error\n";
        assert!(blame(log, &broken_and_fine()).is_empty());
    }

    #[test]
    fn only_last_stage_counts() {
        let log = "installing dependencies...
error: something about dev_test_fine
building frontend...
Error: [vite]: Rolldown failed to resolve import \"does-not-exist\" from \"/app/frontend/extensions/dev_test_broken/src/index.ts\".
";
        assert_eq!(blame(log, &broken_and_fine()), vec!["dev.test.broken"]);
    }

    #[test]
    fn vite_error_with_ansi_ignores_output_before_error() {
        let log = "\x1b[1mbuilding frontend...\x1b[0m
vite v8.3.2 building client environment for production...
transforming extensions/dev_test_fine/src/index.ts
\u{2713} 5 modules transformed.
dist/assets/index-BjZRHoRA.js  0.71 kB \u{2502} gzip: 0.41 kB
\u{2717} Build failed in 14ms
error during build:
Build failed with 1 error:

\x1b[31m[builtin:vite-transform] \x1b[0mUnexpected token
   \x1b[38;5;246m\u{256d}\u{2500}[\x1b[0m extensions/dev_test_broken/src/index.ts:1:14 \x1b[38;5;246m]\x1b[0m
    at aggregateBindingErrorsIntoJsError (file:///app/frontend/node_modules/.pnpm/rolldown@1.2.12/dist/index.js)
";
        assert_eq!(blame(log, &broken_and_fine()), vec!["dev.test.broken"]);
    }

    #[test]
    fn pnpm_error_blames_by_npm_name_followed_by_at() {
        let suspects = vec![
            suspect("dev_acme_tickets", Some("tickets-frontend")),
            suspect("dev_acme_pad", Some("left-padx")),
        ];
        let log = "installing dependencies...
 ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/left-padx: Not Found - 404
This error happened while installing the dependencies of tickets-frontend@1.0.0
";
        assert_eq!(blame(log, &suspects), vec!["dev.acme.tickets"]);
    }

    #[test]
    fn identifier_must_match_as_whole_token() {
        let log = "building frontend...
error: extensions/dev_acme_ticketsx/src/index.ts and xdev_acme_tickets failed
";
        assert!(blame(log, &[suspect("dev_acme_tickets", None)]).is_empty());
    }

    #[test]
    fn package_name_matches_and_results_follow_suspect_order_without_duplicates() {
        let suspects = vec![
            suspect("dev_acme_alpha", None),
            suspect("dev_acme_beta", None),
            suspect("dev_acme_gamma", None),
        ];
        let log = "building frontend...
error: dev.acme.beta broke
dev_acme_alpha broke `dev_acme_alpha` too, and dev_acme_beta again
";
        assert_eq!(
            blame(log, &suspects),
            vec!["dev.acme.alpha", "dev.acme.beta"]
        );
    }
}
