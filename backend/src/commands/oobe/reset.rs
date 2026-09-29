use clap::{Args, FromArgMatches};
use colored::Colorize;

#[derive(Args)]
pub struct ResetArgs {
    #[arg(
        long = "step",
        help = "the step to reset the OOBE to",
        default_value = "configuration",
        value_parser = clap::builder::PossibleValuesParser::new(shared::settings::OOBE_STEPS)
    )]
    step: String,
}

pub struct ResetCommand;

impl shared::extensions::commands::CliCommand<ResetArgs> for ResetCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = ResetArgs::from_arg_matches(&arg_matches)?;
                let state = shared::AppState::new_cli(env).await?;

                if args.step == "register" {
                    let mut settings = state.settings.get_mut().await?;
                    settings.app.registration_enabled = true;
                    settings.app.password_login_enabled = true;
                    settings.save().await?;

                    eprintln!(
                        "enabled user registration and password login, the register step cannot run without them"
                    );

                    if shared::models::user::User::count(&state.database).await > 0 {
                        eprintln!(
                            "{}",
                            "users already exist, the account created by the register step will not be an admin".yellow()
                        );
                    }
                }

                state
                    .settings
                    .set_oobe_step(Some(args.step.as_str().into()))
                    .await?;

                eprintln!("oobe has been reset to step {}", args.step.cyan());
                eprintln!("a running panel caches settings for up to 60 seconds");

                Ok(0)
            })
        })
    }
}
