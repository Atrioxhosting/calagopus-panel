use hickory_resolver::{
    TokioResolver,
    config::LookupIpStrategy,
    lookup_ip::{LookupIp, LookupIpIter},
};
use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use std::{
    net::SocketAddr,
    str::FromStr,
    sync::{Arc, OnceLock},
};

const MAX_REDIRECTS: usize = 10;

pub fn host_to_ip(host: &str) -> Option<std::net::IpAddr> {
    let host = host
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(host);

    std::net::IpAddr::from_str(host).ok()
}

pub fn is_blocked_ip(cidrs: &[cidr::IpCidr], ip: &std::net::IpAddr) -> bool {
    let ip = ip.to_canonical();

    cidrs.iter().any(|cidr| cidr.contains(&ip))
}

#[derive(Clone)]
pub struct BlockedIpResolver {
    env: Arc<crate::env::Env>,
    context: &'static str,
    state: Arc<TokioResolver>,
}

fn tokio_resolver() -> TokioResolver {
    let mut builder =
        TokioResolver::builder_tokio().expect("failed to create TokioResolver builder");
    builder.options_mut().ip_strategy = LookupIpStrategy::Ipv4AndIpv6;

    builder.build().expect("failed to build TokioResolver")
}

impl BlockedIpResolver {
    pub fn new(env: &Arc<crate::env::Env>, context: &'static str) -> Self {
        Self {
            env: Arc::clone(env),
            context,
            state: Arc::new(tokio_resolver()),
        }
    }
}

impl Resolve for BlockedIpResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let resolver = self.clone();

        Box::pin(async move {
            let lookup = resolver.state.lookup_ip(name.as_str()).await?;
            let addrs: Addrs = Box::new(SocketAddrs::new(
                Arc::clone(&resolver.env),
                resolver.context,
                lookup,
                |l| l.iter(),
            ));

            Ok(addrs)
        })
    }
}

#[ouroboros::self_referencing]
struct SocketAddrs {
    env: Arc<crate::env::Env>,
    context: &'static str,
    lookup: LookupIp,

    #[borrows(mut lookup)]
    #[covariant]
    iter: LookupIpIter<'this>,
}

impl Iterator for SocketAddrs {
    type Item = SocketAddr;

    fn next(&mut self) -> Option<Self::Item> {
        let next = self
            .with_iter_mut(|iter| iter.next())
            .map(|ip_addr| SocketAddr::new(ip_addr, 0))?;

        if is_blocked_ip(&self.borrow_env().app_blocked_cidrs, &next.ip()) {
            tracing::warn!(
                "blocking internal IP address in {}: {}",
                self.borrow_context(),
                next.ip()
            );

            return self.next();
        }

        Some(next)
    }
}

static RESOLVER: OnceLock<TokioResolver> = OnceLock::new();

/// Resolves `host` and drops every address covered by `APP_BLOCKED_CIDRS`, for connections that
/// cannot be routed through [`outbound_client`] and have to dial the returned addresses directly.
pub async fn resolve_allowed_addresses(
    env: &Arc<crate::env::Env>,
    host: &str,
    port: u16,
    context: &'static str,
) -> Result<Vec<SocketAddr>, anyhow::Error> {
    if let Some(ip) = host_to_ip(host) {
        if is_blocked_ip(&env.app_blocked_cidrs, &ip) {
            tracing::warn!("blocking internal IP address in {}: {}", context, ip);

            return Err(anyhow::anyhow!("IP address {ip} is blocked"));
        }

        return Ok(vec![SocketAddr::new(ip, port)]);
    }

    let lookup = RESOLVER.get_or_init(tokio_resolver).lookup_ip(host).await?;

    let addresses: Vec<SocketAddr> = lookup
        .iter()
        .filter(|ip| {
            if is_blocked_ip(&env.app_blocked_cidrs, ip) {
                tracing::warn!("blocking internal IP address in {}: {}", context, ip);

                false
            } else {
                true
            }
        })
        .map(|ip| SocketAddr::new(ip, port))
        .collect();

    if addresses.is_empty() {
        return Err(anyhow::anyhow!(
            "{host} does not resolve to any allowed IP address"
        ));
    }

    Ok(addresses)
}

static OUTBOUND_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// A [`reqwest::Client`] for requests to user-provided urls, refusing to connect to any address
/// covered by `APP_BLOCKED_CIDRS`, both on the initial request and on every redirect.
pub fn outbound_client(env: &Arc<crate::env::Env>) -> &'static reqwest::Client {
    OUTBOUND_CLIENT.get_or_init(|| {
        let redirect_env = Arc::clone(env);

        reqwest::Client::builder()
            .user_agent(format!("github.com/calagopus/panel {}", crate::VERSION))
            .connect_timeout(std::time::Duration::from_secs(10))
            .read_timeout(std::time::Duration::from_secs(30))
            .no_proxy()
            .dns_resolver(Arc::new(BlockedIpResolver::new(env, "outbound request")))
            .redirect(reqwest::redirect::Policy::custom(move |attempt| {
                if attempt.previous().len() >= MAX_REDIRECTS {
                    return attempt.error(anyhow::anyhow!("too many redirects"));
                }

                if let Some(host) = attempt.url().host_str()
                    && let Some(ip) = host_to_ip(host)
                    && is_blocked_ip(&redirect_env.app_blocked_cidrs, &ip)
                {
                    tracing::warn!(
                        "blocking redirect to internal IP address in outbound request: {}",
                        ip
                    );

                    return attempt.error(anyhow::anyhow!("IP address {ip} is blocked"));
                }

                attempt.follow()
            }))
            .build()
            .expect("Failed to create HTTP client")
    })
}
