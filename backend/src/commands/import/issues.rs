use colored::Colorize;
use dialoguer::{Select, theme::ColorfulTheme};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap},
    io::IsTerminal,
};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
pub struct IssueKey {
    pub table: &'static str,
    pub id: i64,
    pub field: &'static str,
    pub code: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct Issue {
    #[serde(flatten)]
    pub key: IssueKey,
    pub label: String,
    pub value: String,
    pub message: String,
    pub fix: Option<String>,
}

impl Issue {
    fn group(&self) -> GroupKey {
        GroupKey {
            table: self.key.table,
            field: self.key.field,
            code: self.key.code,
            fixable: self.fix.is_some(),
        }
    }

    fn location(&self) -> String {
        format!(
            "{} #{}{}",
            self.key.table,
            self.key.id,
            if self.label.is_empty() {
                String::new()
            } else {
                format!(" ({})", self.label)
            }
        )
    }

    fn describe(&self) -> String {
        let mut line = format!(
            "{} {} = {}: {}",
            self.location(),
            self.key.field,
            display_value(&self.value),
            self.message
        );
        if let Some(fix) = &self.fix {
            line.push_str(&format!(" [fix: {fix}]"));
        }
        line
    }
}

fn display_value(value: &str) -> String {
    const MAX: usize = 80;

    let mut shown: String = value.chars().take(MAX).collect();
    if value.chars().count() > MAX {
        shown.push('…');
    }
    format!("{shown:?}")
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct GroupKey {
    pub table: &'static str,
    pub field: &'static str,
    pub code: &'static str,
    pub fixable: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Decision {
    Fix,
    Skip,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
pub enum OnInvalid {
    /// prompt for every group of problems, aborts when no terminal is attached
    Ask,
    /// report every problem and write nothing
    Abort,
    /// apply the suggested fix where one exists, skip the row otherwise
    Fix,
    /// skip every row that has a problem
    Skip,
}

#[derive(Default)]
pub struct Decisions {
    rows: HashMap<IssueKey, Decision>,
    groups: HashMap<GroupKey, Decision>,
    fallback: Option<OnInvalid>,
    /// Applies fixes of undecided issues so one pass reports as many problems as possible.
    pub provisional: bool,
}

impl Decisions {
    pub fn new(policy: OnInvalid) -> Self {
        Self {
            rows: HashMap::new(),
            groups: HashMap::new(),
            fallback: matches!(policy, OnInvalid::Fix | OnInvalid::Skip).then_some(policy),
            provisional: false,
        }
    }

    pub fn get(&self, key: &IssueKey, fixable: bool) -> Option<Decision> {
        if let Some(decision) = self.rows.get(key) {
            return Some(*decision);
        }

        let group = GroupKey {
            table: key.table,
            field: key.field,
            code: key.code,
            fixable,
        };
        if let Some(decision) = self.groups.get(&group) {
            return Some(*decision);
        }

        match self.fallback {
            Some(OnInvalid::Fix) if fixable => Some(Decision::Fix),
            Some(_) => Some(Decision::Skip),
            None => None,
        }
    }
}

#[derive(Serialize)]
pub struct Resolved {
    #[serde(flatten)]
    pub issue: Issue,
    pub decision: Decision,
}

pub type RowRef = (&'static str, i64);

/// Everything a validation pass learned besides the plan itself.
#[derive(Default)]
pub struct Findings {
    pub pending: Vec<Issue>,
    pub resolved: Vec<Resolved>,
    /// Rows dropped because a row they depend on was dropped, per root row and table.
    pub cascades: HashMap<RowRef, BTreeMap<&'static str, usize>>,
    pub notes: BTreeMap<(&'static str, String), usize>,
}

impl Findings {
    fn cascade_summary<'a>(&self, issues: impl Iterator<Item = &'a Issue>) -> Option<String> {
        let mut totals: BTreeMap<&'static str, usize> = BTreeMap::new();
        let mut seen = std::collections::HashSet::new();

        for issue in issues {
            let row = (issue.key.table, issue.key.id);
            if !seen.insert(row) {
                continue;
            }
            if let Some(cascade) = self.cascades.get(&row) {
                for (table, count) in cascade {
                    *totals.entry(table).or_default() += count;
                }
            }
        }

        if totals.is_empty() {
            return None;
        }

        Some(
            totals
                .into_iter()
                .map(|(table, count)| format!("{count} {table}"))
                .collect::<Vec<_>>()
                .join(", "),
        )
    }

    fn grouped_pending(&self) -> BTreeMap<GroupKey, Vec<&Issue>> {
        let mut groups: BTreeMap<GroupKey, Vec<&Issue>> = BTreeMap::new();
        for issue in &self.pending {
            groups.entry(issue.group()).or_default().push(issue);
        }
        groups
    }

    pub fn print_pending(&self) {
        for (group, issues) in self.grouped_pending() {
            eprintln!(
                "{}",
                format!(
                    "{}.{}: {} row(s), {}",
                    group.table,
                    group.field,
                    issues.len(),
                    if group.fixable {
                        "fix available"
                    } else {
                        "no automatic fix"
                    }
                )
                .yellow()
                .bold()
            );
            for issue in &issues {
                eprintln!("  {}", issue.describe());
            }
            if let Some(cascade) = self.cascade_summary(issues.iter().copied()) {
                eprintln!("  skipping these rows also drops: {cascade}");
            }
        }
    }

    pub fn print_summary(&self) {
        const EXAMPLES: usize = 10;

        let mut groups: BTreeMap<(GroupKey, bool), Vec<&Resolved>> = BTreeMap::new();
        for resolved in &self.resolved {
            groups
                .entry((resolved.issue.group(), resolved.decision == Decision::Fix))
                .or_default()
                .push(resolved);
        }

        for ((group, fixed), resolved) in groups {
            eprintln!(
                "{}",
                format!(
                    "{}.{}: {} {} row(s)",
                    group.table,
                    group.field,
                    if fixed { "fixed" } else { "skipped" },
                    resolved.len()
                )
                .yellow()
            );
            for resolved in resolved.iter().take(EXAMPLES) {
                eprintln!("  {}", resolved.issue.describe());
            }
            if resolved.len() > EXAMPLES {
                eprintln!(
                    "  … and {} more (use --report to write all of them to a file)",
                    resolved.len() - EXAMPLES
                );
            }
            if !fixed && let Some(cascade) = self.cascade_summary(resolved.iter().map(|r| &r.issue))
            {
                eprintln!("  also dropped with them: {cascade}");
            }
        }

        for ((table, note), count) in &self.notes {
            eprintln!("{} {table}: {note} ({count})", "note:".cyan());
        }
    }

    pub fn write_report(&self, path: &str) -> Result<(), anyhow::Error> {
        #[derive(Serialize)]
        struct Note<'a> {
            table: &'a str,
            note: &'a str,
            count: usize,
        }

        #[derive(Serialize)]
        struct Report<'a> {
            unresolved: &'a [Issue],
            resolved: &'a [Resolved],
            notes: Vec<Note<'a>>,
        }

        let report = Report {
            unresolved: &self.pending,
            resolved: &self.resolved,
            notes: self
                .notes
                .iter()
                .map(|((table, note), count)| Note {
                    table,
                    note,
                    count: *count,
                })
                .collect(),
        };

        std::fs::write(path, serde_json::to_vec_pretty(&report)?)?;

        Ok(())
    }
}

pub fn is_interactive() -> bool {
    std::io::stdin().is_terminal() && std::io::stdout().is_terminal()
}

pub struct Aborted;

/// Asks what to do about every group of pending issues, recording the answers in `decisions`.
pub fn prompt(findings: &Findings, decisions: &mut Decisions) -> Result<(), Aborted> {
    const EXAMPLES: usize = 5;

    for (group, issues) in findings.grouped_pending() {
        let cascade = findings.cascade_summary(issues.iter().copied());

        loop {
            println!();
            println!(
                "{}",
                format!(
                    "{}.{}: {} row(s) cannot be imported as they are",
                    group.table,
                    group.field,
                    issues.len()
                )
                .yellow()
                .bold()
            );
            for issue in issues.iter().take(EXAMPLES) {
                println!("  {}", issue.describe());
            }
            if issues.len() > EXAMPLES {
                println!("  … and {} more", issues.len() - EXAMPLES);
            }

            let skip_label = match &cascade {
                Some(cascade) => format!("Skip all {} row(s) (also drops {cascade})", issues.len()),
                None => format!("Skip all {} row(s)", issues.len()),
            };

            let mut items = Vec::new();
            let mut actions = Vec::new();
            if group.fixable {
                items.push(format!(
                    "Apply the suggested fix to all {} row(s)",
                    issues.len()
                ));
                actions.push("fix");
            }
            items.push(skip_label);
            actions.push("skip");
            if issues.len() > 1 {
                items.push("Decide row by row".to_string());
                actions.push("each");
            }
            if issues.len() > EXAMPLES {
                items.push("Show all rows".to_string());
                actions.push("show");
            }
            items.push("Abort the import".to_string());
            actions.push("abort");

            let choice = Select::with_theme(&ColorfulTheme::default())
                .with_prompt("What do you want to do?")
                .items(&items)
                .default(0)
                .interact()
                .map_err(|_| Aborted)?;

            match actions[choice] {
                "fix" => {
                    decisions.groups.insert(group.clone(), Decision::Fix);
                }
                "skip" => {
                    decisions.groups.insert(group.clone(), Decision::Skip);
                }
                "each" => {
                    for issue in &issues {
                        prompt_row(findings, issue, decisions)?;
                    }
                }
                "show" => {
                    for issue in &issues {
                        println!("  {}", issue.describe());
                    }
                    continue;
                }
                _ => return Err(Aborted),
            }

            break;
        }
    }

    Ok(())
}

fn prompt_row(
    findings: &Findings,
    issue: &Issue,
    decisions: &mut Decisions,
) -> Result<(), Aborted> {
    println!();
    println!("  {}", issue.describe());

    let skip_label = match findings.cascade_summary(std::iter::once(issue)) {
        Some(cascade) => format!("Skip this row (also drops {cascade})"),
        None => "Skip this row".to_string(),
    };

    let mut items = Vec::new();
    let mut choices = Vec::new();
    if let Some(fix) = &issue.fix {
        items.push(format!("Apply the fix: {fix}"));
        choices.push(Some(Decision::Fix));
    }
    items.push(skip_label);
    choices.push(Some(Decision::Skip));
    items.push("Abort the import".to_string());
    choices.push(None);

    let choice = Select::with_theme(&ColorfulTheme::default())
        .with_prompt(issue.location())
        .items(&items)
        .default(0)
        .interact()
        .map_err(|_| Aborted)?;

    match choices[choice] {
        Some(decision) => {
            decisions.rows.insert(issue.key.clone(), decision);
            Ok(())
        }
        None => Err(Aborted),
    }
}
