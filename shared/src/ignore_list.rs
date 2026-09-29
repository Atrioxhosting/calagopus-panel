use std::{path::Path, sync::Arc};

#[derive(Clone)]
pub struct IgnoreList {
    matcher: ignore::gitignore::Gitignore,
    descend: Arc<[DescendRule]>,
    descend_all: bool,
}

impl IgnoreList {
    pub fn builder() -> IgnoreListBuilder {
        let mut builder = ignore::gitignore::GitignoreBuilder::new("");
        builder.allow_unclosed_class(false);

        IgnoreListBuilder {
            builder,
            descend: Vec::new(),
            descend_all: false,
        }
    }

    pub fn try_from_lines<S: AsRef<str>>(
        lines: impl IntoIterator<Item = S>,
    ) -> Result<Self, ignore::Error> {
        let mut builder = Self::builder();
        for line in lines {
            builder.try_push_line(line.as_ref())?;
        }

        builder.build()
    }

    fn should_descend(&self, path: &Path) -> bool {
        if self.descend_all {
            return true;
        }

        let path = path.to_string_lossy();
        let path = path.trim_start_matches("./").trim_start_matches('/');

        self.descend.iter().any(|rule| rule.covers(path))
    }

    fn excluded(&self, path: &Path, is_dir: bool) -> bool {
        if path.as_os_str().is_empty() || path == Path::new(".") {
            return false;
        }

        self.matcher.matched(path, is_dir).is_ignore()
    }

    pub fn is_ignored(&self, path: &Path, is_dir: bool) -> bool {
        self.excluded(path, is_dir)
    }

    pub fn is_ignored_subtree(&self, path: &Path, is_dir: bool) -> bool {
        self.excluded(path, is_dir) && !(is_dir && self.should_descend(path))
    }
}

pub struct IgnoreListBuilder {
    builder: ignore::gitignore::GitignoreBuilder,
    descend: Vec<DescendRule>,
    descend_all: bool,
}

impl IgnoreListBuilder {
    pub fn try_push_line(&mut self, line: &str) -> Result<(), ignore::Error> {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            return Ok(());
        }

        let (negated, body) = match trimmed.strip_prefix('!') {
            Some(body) => ("!", body),
            None => ("", trimmed),
        };
        if body.is_empty() {
            return Ok(());
        }

        self.builder.add_line(None, trimmed)?;

        let dir_only = body.ends_with('/');
        let stem = body.trim_end_matches('/');
        let mut needs_descend = !negated.is_empty();
        let companion = match stem.strip_suffix("/**") {
            Some("") => None,
            Some(_) if dir_only => {
                needs_descend = true;
                None
            }
            Some(parent) if parent.contains('/') => Some(format!("{negated}{parent}")),
            Some(parent) => Some(format!("{negated}/{parent}")),
            None if stem.is_empty() => None,
            None if stem.contains('/') => Some(format!("{negated}{stem}/**")),
            None => Some(format!("{negated}**/{stem}/**")),
        };
        if let Some(companion) = companion {
            self.builder.add_line(None, &companion).ok();
        }

        if needs_descend {
            match DescendRule::parse(body) {
                Some(rule) => self.descend.push(rule),
                None => self.descend_all = true,
            }
        }

        Ok(())
    }

    pub fn build(self) -> Result<IgnoreList, ignore::Error> {
        Ok(IgnoreList {
            matcher: self.builder.build()?,
            descend: self.descend.into(),
            descend_all: self.descend_all,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DescendRule {
    prefix: compact_str::CompactString,
    tail: Option<usize>,
}

impl DescendRule {
    fn parse(pattern: &str) -> Option<Self> {
        let pattern = pattern.trim_end_matches('/');
        if !pattern.contains('/') {
            return None;
        }

        let pattern = pattern.trim_start_matches('/');
        let mut segments = pattern.split('/').peekable();
        let mut prefix = compact_str::CompactString::default();

        while let Some(segment) = segments.next_if(|segment| !segment.contains(['*', '?', '['])) {
            if !prefix.is_empty() {
                prefix.push('/');
            }
            prefix.push_str(segment);
        }

        if prefix.is_empty() {
            return None;
        }

        let tail = segments.try_fold(0, |tail, segment| {
            (!segment.contains("**")).then_some(tail + 1)
        });

        Some(Self { prefix, tail })
    }

    fn covers(&self, path: &str) -> bool {
        if path == self.prefix {
            return true;
        }

        if let Some(rest) = self.prefix.strip_prefix(path) {
            return rest.starts_with('/');
        }

        match path.strip_prefix(self.prefix.as_str()) {
            Some(rest) if rest.starts_with('/') => self
                .tail
                .is_none_or(|tail| rest.matches('/').count() < tail),
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // IgnoreList
    #[test]
    fn point_checks_deny_the_whole_subtree_of_a_denied_name() -> Result<(), anyhow::Error> {
        let ignore = IgnoreList::try_from_lines(["secrets", "/config.yml"])?;

        assert!(ignore.is_ignored(Path::new("secrets"), true));
        assert!(ignore.is_ignored(Path::new("secrets/deep/token.txt"), false));
        assert!(ignore.is_ignored(Path::new("game/secrets/token.txt"), false));
        assert!(ignore.is_ignored(Path::new("config.yml"), false));
        assert!(!ignore.is_ignored(Path::new("game/config.yml"), false));
        assert!(!ignore.is_ignored(Path::new("secrets.txt"), false));

        Ok(())
    }

    #[test]
    fn a_descended_directory_is_denied_itself_but_not_as_a_subtree() -> Result<(), anyhow::Error> {
        let ignore = IgnoreList::try_from_lines(["*", "!game/csgo/cfg"])?;

        assert!(ignore.is_ignored(Path::new("game"), true));
        assert!(!ignore.is_ignored_subtree(Path::new("game"), true));
        assert!(!ignore.is_ignored_subtree(Path::new("game/csgo"), true));
        assert!(ignore.is_ignored_subtree(Path::new("other"), true));
        assert!(ignore.is_ignored_subtree(Path::new("game/x.txt"), false));
        assert!(!ignore.is_ignored(Path::new("game/csgo/cfg"), true));
        assert!(!ignore.is_ignored(Path::new("game/csgo/cfg/server.cfg"), false));

        Ok(())
    }

    #[test]
    fn a_slash_free_reinclude_keeps_every_directory_enterable() -> Result<(), anyhow::Error> {
        let ignore = IgnoreList::try_from_lines(["*", "!.pteroignore"])?;

        assert!(ignore.is_ignored(Path::new("game"), true));
        assert!(!ignore.is_ignored_subtree(Path::new("game/csgo"), true));
        assert!(!ignore.is_ignored(Path::new("game/csgo/.pteroignore"), false));

        Ok(())
    }

    #[test]
    fn a_later_exclude_outranks_an_earlier_reinclude() -> Result<(), anyhow::Error> {
        let ignore = IgnoreList::try_from_lines(["*", "!config", "config/secret.key"])?;

        assert!(!ignore.is_ignored(Path::new("config"), true));
        assert!(!ignore.is_ignored(Path::new("config/server.yml"), false));
        assert!(ignore.is_ignored(Path::new("config/secret.key"), false));

        Ok(())
    }

    #[test]
    fn the_root_is_never_an_entry_of_its_own_list() -> Result<(), anyhow::Error> {
        let ignore = IgnoreList::try_from_lines(["*"])?;

        for root in ["", "."] {
            assert!(!ignore.is_ignored(Path::new(root), true));
            assert!(!ignore.is_ignored_subtree(Path::new(root), true));
        }
        assert!(ignore.is_ignored(Path::new("x"), false));

        Ok(())
    }

    #[test]
    fn an_unparsable_line_is_refused() {
        assert!(IgnoreList::try_from_lines(["[abc", "*.log"]).is_err());
        assert!(IgnoreList::try_from_lines(["*.log", "!keep.log", "logs/", "# note", ""]).is_ok());
    }

    // DescendRule
    #[test]
    fn descend_rule_bounds_the_wildcard_tail() {
        let rule = |prefix: &str, tail| DescendRule {
            prefix: prefix.into(),
            tail,
        };

        for (pattern, expected) in [
            ("game/csgo/addons", Some(rule("game/csgo/addons", Some(0)))),
            ("/game/csgo/", Some(rule("game/csgo", Some(0)))),
            ("game/*/data", Some(rule("game", Some(2)))),
            ("game/**/cfg", Some(rule("game", None))),
            (".pteroignore", None),
            ("*", None),
            ("[abc]/x", None),
        ] {
            assert_eq!(DescendRule::parse(pattern), expected, "{pattern}");
        }
    }

    #[test]
    fn descend_rule_covers_ancestors_and_the_bounded_tail_only() {
        let literal = DescendRule::parse("game/csgo/addons").unwrap();
        assert!(literal.covers("game"));
        assert!(literal.covers("game/csgo/addons"));
        assert!(!literal.covers("game/csgo/addons/x"));
        assert!(!literal.covers("game/csgo/other"));
        assert!(!literal.covers("gam"));

        let bounded = DescendRule::parse("game/*/cfg").unwrap();
        assert!(bounded.covers("game/csgo"));
        assert!(!bounded.covers("game/csgo/cfg/nested"));

        let unbounded = DescendRule::parse("game/**/cfg").unwrap();
        assert!(unbounded.covers("game/a/b/c/d"));
    }
}
