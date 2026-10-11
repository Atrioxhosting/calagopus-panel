use super::client::{ApiHttpError, WingsClient};
use futures_util::{SinkExt, StreamExt, ready};
use serde::Deserialize;
use std::{
    io,
    pin::Pin,
    task::{Context, Poll},
    time::Duration,
};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream,
    tungstenite::{Error as WsError, Message},
};

type WsStream = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

pub const MAX_DATAGRAM_SIZE: usize = 65536;

const RECV_TIMEOUT: Duration = Duration::from_secs(5);

const REFUSED_SIGNAL: &str = "refused";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueryProtocol {
    Tcp,
    Udp,
}

impl QueryProtocol {
    fn as_str(self) -> &'static str {
        match self {
            QueryProtocol::Tcp => "tcp",
            QueryProtocol::Udp => "udp",
        }
    }
}

impl WingsClient {
    async fn open_tunnel(&self, endpoint: String) -> Result<WsStream, ApiHttpError> {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::ACCEPT,
            reqwest::header::HeaderValue::from_static("application/msgpack"),
        );

        match self.open_websocket(endpoint, headers).await {
            Err(ApiHttpError::WebSocket(WsError::Http(response))) => {
                let error = match response.body() {
                    Some(body) => {
                        let mut de =
                            rmp_serde::Deserializer::new(body.as_slice()).with_human_readable();
                        match super::ApiError::deserialize(&mut de) {
                            Ok(error) => error,
                            Err(err) => super::ApiError {
                                error: err.to_string().into(),
                            },
                        }
                    }
                    None => super::ApiError {
                        error: "websocket upgrade rejected".into(),
                    },
                };

                Err(ApiHttpError::Http(response.status(), error))
            }
            result => result,
        }
    }

    async fn open_query_tunnel(
        &self,
        server: uuid::Uuid,
        protocol: QueryProtocol,
        port: u16,
    ) -> Result<WsStream, ApiHttpError> {
        self.open_tunnel(format!(
            "/api/servers/{server}/ws/query?protocol={}&port={port}",
            protocol.as_str()
        ))
        .await
    }

    pub async fn open_tunnel_tcp(
        &self,
        server: uuid::Uuid,
        port: u16,
    ) -> Result<QueryStreamTunnel, ApiHttpError> {
        Ok(QueryStreamTunnel {
            stream: self
                .open_query_tunnel(server, QueryProtocol::Tcp, port)
                .await?,
            read: Vec::new(),
            read_pos: 0,
        })
    }

    pub async fn open_tunnel_udp(
        &self,
        server: uuid::Uuid,
        port: u16,
    ) -> Result<QueryUdpTunnel, ApiHttpError> {
        Ok(QueryUdpTunnel {
            stream: self
                .open_query_tunnel(server, QueryProtocol::Udp, port)
                .await?,
        })
    }

    pub async fn open_tunnel_unix(
        &self,
        server: uuid::Uuid,
        path: &str,
        ignored: &[compact_str::CompactString],
    ) -> Result<QueryStreamTunnel, ApiHttpError> {
        let mut endpoint = format!(
            "/api/servers/{server}/ws/socket?path={}",
            urlencoding::encode(path)
        );
        for value in ignored {
            endpoint.push_str("&ignored=");
            endpoint.push_str(&urlencoding::encode(value));
        }

        Ok(QueryStreamTunnel {
            stream: self.open_tunnel(endpoint).await?,
            read: Vec::new(),
            read_pos: 0,
        })
    }
}

pub struct QueryStreamTunnel {
    stream: WsStream,
    read: Vec<u8>,
    read_pos: usize,
}

impl AsyncRead for QueryStreamTunnel {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        loop {
            if self.read_pos < self.read.len() {
                let n = (self.read.len() - self.read_pos).min(buf.remaining());
                let start = self.read_pos;
                buf.put_slice(&self.read[start..start + n]);
                self.read_pos += n;
                return Poll::Ready(Ok(()));
            }

            match ready!(self.stream.poll_next_unpin(cx)) {
                Some(Ok(Message::Binary(data))) => {
                    self.read = data.to_vec();
                    self.read_pos = 0;
                }
                Some(Ok(Message::Close(_))) | None => return Poll::Ready(Ok(())),
                Some(Ok(_)) => {}
                Some(Err(err)) => return Poll::Ready(Err(ws_to_io(err))),
            }
        }
    }
}

impl AsyncWrite for QueryStreamTunnel {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        ready!(self.stream.poll_ready_unpin(cx)).map_err(ws_to_io)?;
        self.stream
            .start_send_unpin(Message::binary(buf.to_vec()))
            .map_err(ws_to_io)?;
        Poll::Ready(Ok(buf.len()))
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.stream.poll_flush_unpin(cx).map_err(ws_to_io)
    }

    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        self.stream.poll_close_unpin(cx).map_err(ws_to_io)
    }
}

pub struct QueryUdpTunnel {
    stream: WsStream,
}

impl QueryUdpTunnel {
    pub async fn send(&mut self, data: &[u8]) -> io::Result<()> {
        self.stream
            .send(Message::binary(data.to_vec()))
            .await
            .map_err(ws_to_io)
    }

    pub async fn recv(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            let message = match tokio::time::timeout(RECV_TIMEOUT, self.stream.next()).await {
                Ok(Some(Ok(message))) => message,
                Ok(Some(Err(err))) => return Err(ws_to_io(err)),
                Ok(None) => return Err(io::ErrorKind::UnexpectedEof.into()),
                Err(_) => return Err(io::ErrorKind::TimedOut.into()),
            };

            match message {
                Message::Binary(data) => {
                    let n = data.len().min(buf.len());
                    buf[..n].copy_from_slice(&data[..n]);
                    return Ok(n);
                }
                Message::Close(_) => return Err(io::ErrorKind::UnexpectedEof.into()),
                Message::Text(text) if text.as_str() == REFUSED_SIGNAL => {
                    return Err(io::ErrorKind::ConnectionRefused.into());
                }
                _ => {}
            }
        }
    }
}

fn ws_to_io(err: WsError) -> io::Error {
    match err {
        WsError::Io(err) => err,
        other => io::Error::other(other),
    }
}
