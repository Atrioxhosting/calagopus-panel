# Atrioxhosting Calagopus rebuild specification

## Status van dit document

Dit document is een **uitvoerspecificatie** voor Codex.

Alle regels zijn harde eisen.

Codex neemt geen ontwerpbeslissingen buiten deze specificatie.
Codex onderzoekt niet of een expliciet vastgelegde eis wenselijk is.
Codex vervangt geen vastgelegde keuze door een alternatief.
Codex stelt geen vragen over keuzes die in dit document al zijn vastgelegd.

Woorden zoals "misschien", "eventueel", "indien gewenst", "waar nodig", "als dat nodig is" en vergelijkbare open formuleringen horen niet in de uitvoering.

---

# 1. Uitgangssituatie

Wanneer Codex op een van deze VM's wordt gestart, is de Atrioxhosting bootstrap **volledig afgerond**.

Codex voert de bootstrap niet opnieuw uit.
Codex wijzigt de bootstrap niet.
Codex wijzigt geen bestaande bootstrapinstellingen tenzij een latere sectie van dit document expliciet een concrete wijziging voorschrijft.

De drie development-VM's zijn:

- `dev-panel.atrioxhost.com`
- `dev-wings-1.atrioxhost.com`
- `dev-wings-2.atrioxhost.com`

---

# 2. Harde veiligheidsregels voor Codex

## Actieve SSH/Codex-sessie

Codex verbreekt de actieve SSH/Codex-sessie **niet**.

Codex voert **niet** uit:

- `reboot`
- `shutdown`
- `poweroff`
- een restart van de host networking
- een down/up van de actieve netwerkinterface
- een wijziging die de actieve SSH-route verbreekt
- een stop of restart van de SSH-service
- een firewallwijziging die de actieve SSH-sessie kan blokkeren
- iedere andere hostactie die redelijkerwijs de SSH/Codex-sessie verbreekt

Een hostreboot wordt uitsluitend door Menno uitgevoerd.

Wanneer een wijziging pas na een reboot actief wordt, voert Codex alle niet-verbrekende voorbereidende werkzaamheden uit, stopt daarna en meldt exact:

1. dat een reboot vereist is;
2. waarom de reboot vereist is;
3. welke controle Menno na de reboot moet uitvoeren.

Codex voert de reboot zelf nooit uit.

## Docker-data

Codex verwijdert geen Docker-volumes.

Codex gebruikt nooit `docker compose down -v` en verwijdert nooit Docker-volumes.

```bash
docker compose down -v
```

Container recreation, `docker compose down`, Compose-netwerk-recreation en vergelijkbare niet-destructieve Docker-acties zijn toegestaan nadat Codex de persistente opslag van alle betrokken containers concreet heeft gecontroleerd.

Codex controleert vóór zo'n actie:

- de actieve Compose-file;
- de daadwerkelijke container mounts;
- PostgreSQL `PGDATA`;
- de hostmount achter PostgreSQL `/data`;
- de hostmount achter Calagopus panel-data;
- de hostmount achter Valkey `/data`;
- de hostmount achter Calagopus logs;
- de actieve Compose project-directory.

---

# 3. VM-netwerkconfiguratie

## Panel
- Hostname: `dev-panel.atrioxhost.com`
- IPv4: `82.153.147.6/32`
- IPv4 gateway: `82.153.147.1`
- IPv6: `2a0c:b641:620::6/64`
- IPv6 gateway: `2a0c:b641:620::1`
- Interface: `ens18`
- vCPU: `16`

## Wings 1
- Hostname: `dev-wings-1.atrioxhost.com`
- IPv4: `82.153.147.7/32`
- IPv4 gateway: `82.153.147.1`
- IPv6: `2a0c:b641:620::7/64`
- IPv6 gateway: `2a0c:b641:620::1`
- Interface: `ens18`
- Resources:
  - 8 vCPU
  - 16 GiB RAM
  - 50 GiB disk

## Wings 2
- Hostname: `dev-wings-2.atrioxhost.com`
- IPv4: `82.153.147.8/32`
- IPv4 gateway: `82.153.147.1`
- IPv6: `2a0c:b641:620::8/64`
- IPv6 gateway: `2a0c:b641:620::1`
- Interface: `ens18`
- Resources:
  - 8 vCPU
  - 16 GiB RAM
  - 50 GiB disk

Codex verandert deze adressen, gateways, hostnames en interface niet.

---

# 4. Bootstrap-baseline

De bootstrap is vóór Codex al afgerond.

De bestaande baseline bevat:
- Debian 13
- hostname
- timezone `Europe/Amsterdam`
- IPv4 forwarding
- IPv6 forwarding
- root SSH key-only
- SSH-poort `25170`
- systemd-resolved
- DNS
- `btop`
- `bmon`
- `tcpdump`
- `mtr-tiny`
- Atrioxhosting basis-hardening

Codex herinstalleert of vervangt deze baseline niet.

Op de Panel-VM staat SSH TCP forwarding aan voor de lokale OpenLiteSpeed WebAdmin-tunnel.

---

# 5. Git en broncode

Git, Git-authenticatie, Codex en `bubblewrap` zijn vóór aanvang van de Calagopus-installatie volledig geïnstalleerd en werkend. Codex installeert, verwijdert of vervangt Git, Git-authenticatie, Codex en `bubblewrap` niet.

De enige Git-working-tree voor de Calagopus Panel broncode staat op `/root/workspace/calagopus-panel`.

Deze working tree is een clone van de Atrioxhosting-fork `git@github.com:Atrioxhosting/calagopus-panel.git`.

De Git-remotes zijn vastgelegd:
- `origin`: `git@github.com:Atrioxhosting/calagopus-panel.git`
- `upstream`: `https://github.com/calagopus/panel.git`

De lokale branch `main` trackt `origin/main`. Codex controleert vóór de deployment dat de working tree schoon is en dat `origin` en `upstream` exact naar bovenstaande repositories verwijzen. Codex maakt geen nieuwe clone en verandert de bestaande remote-architectuur niet.

Atrioxhosting-specifieke broncodewijzigingen worden uitsluitend binnen `/root/workspace/calagopus-panel` uitgevoerd en uitsluitend naar `origin` gepusht. Codex pusht nooit naar `upstream`.

Nieuwe officiële Calagopus-wijzigingen worden via `upstream` opgehaald en pas daarna gecontroleerd in de Atrioxhosting-working-tree verwerkt. Tijdens deze rebuild voert Codex geen zelfstandige upstream-merge, rebase of branchwissel uit.

Broncode en runtime deployment blijven strikt gescheiden:
- Git-working-tree: `/root/workspace/calagopus-panel`
- Actieve runtime deployment: `/opt/calagopus-panel`

De runtime Compose-configuratie wordt gebaseerd op de standalone `compose.yml` uit de bestaande Git-working-tree en als zelfstandige runtimeconfiguratie geplaatst op `/opt/calagopus-panel/compose.yml`. `/opt/calagopus-panel` is geen Git-working-tree en wordt niet via een symlink aan de working tree gekoppeld. Hostspecifieke runtimeconfiguratie wordt niet teruggeschreven naar de broncode-working-tree.

De Git-working-tree wordt tijdens deze rebuild niet gebruikt om een eigen Calagopus Panel container-image te bouwen. De runtime gebruikt de officiële stabiele Calagopus container-image zoals vastgelegd in hoofdstuk 10. Wanneer een eis uit deze specificatie uitsluitend door een broncodewijziging kan worden gerealiseerd, stopt Codex vóór die wijziging en meldt exact welke wijziging nodig is.

Geheimen worden niet gecommit. Dit geldt voor `.env`, private keys, join tokens, node tokens, wachtwoorden, TLS-private keys, database dumps met gevoelige gegevens en andere credentials.

---

# 6. Centrale firewallarchitectuur

De centrale firewall gebruikt nftables en draait op de centrale router, niet op de Panel- of Wings-VM's. Codex wijzigt, herlaadt of valideert de centrale routerconfiguratie niet vanaf deze VM's.

## Calagopus Wings-sets

Wings 1 (`dev-wings-1.atrioxhost.com`):
- IPv4: `82.153.147.7`
- IPv6: `2a0c:b641:620::7`

Wings 2 (`dev-wings-2.atrioxhost.com`):
- IPv4: `82.153.147.8`
- IPv6: `2a0c:b641:620::8`

De Wings-adressen staan in afzonderlijke Calagopus Wings-sets. Deze adressen worden niet aan de algemene public-service-node-sets toegevoegd. Hierdoor wordt onder andere TCP `3306` niet publiek op de Wings-nodes geopend.

## Publieke game allocations

Voor beide Wings-nodes is via de centrale firewall direct beschikbaar:
- TCP `30200-31199`
- UDP `30200-31199`

## SFTP

Voor beide Wings-nodes is via de directe node-route beschikbaar:
- TCP `2022`

## HTTP(S) en Wings API

Publiek HTTP(S)-verkeer naar de VM-origins op TCP `80`, `443`, `8080` en `8443` wordt door de centrale firewall uitsluitend vanaf de Bunny edge-sets toegelaten. Andere externe bronnen naar deze originpoorten worden gedropt.

Er bestaat geen directe Panel → Wings API-uitzondering op TCP `8080` of TCP `8443`. Panel → Wings API-verkeer loopt via de Bunny-hostname van de betreffende Wings-node.

## Tundra

Tundra gebruikt UDP `7100` uitsluitend rechtstreeks tussen Wings 1 en Wings 2 via `vmbr0`. De centrale regel vereist tegelijk:
- ingress `vmbr0`
- egress `vmbr0`
- bron in de Calagopus Wings-set
- bestemming in de Calagopus Wings-set
- UDP
- destination port `7100`

Codex voert geen nftables-commando's uit die bedoeld zijn voor de centrale router. Wanneer een vereiste verbinding door de centrale firewall wordt geblokkeerd, stopt Codex bij die verificatie en rapporteert exact bron, bestemming, protocol en poort aan Menno.

---

# 7. DNS

Bunny-hostnames:
- Panel: `dev-atrioxgame-panel.atrioxhost.com`
- Wings 1: `dev-atrioxgame-wings-1.atrioxhost.com`
- Wings 2: `dev-atrioxgame-wings-2.atrioxhost.com`

Gebruik:
- Publieke HTTP(S)-route
- Publieke HTTPS-poort TCP `443`
- Wings API en browser/WebSocket/download/upload-verkeer via Bunny

Voor de Wings API geldt een bewuste poortscheiding:
- Client/Panel → Bunny: HTTPS/TCP `443`
- Bunny → Wings-origin: HTTPS/TCP `8443`
- Wings API listener op de node: TCP `8443`

Directe node-hostnames:
- `dev-atrioxgame-n1.atrioxhost.com`
- `dev-atrioxgame-n2.atrioxhost.com`

Gebruik:
- SFTP/TCP `2022`
- direct node- en gameverkeer waar Bunny niet tussen hoort

De directe node-hostnames worden niet voor de Wings API gebruikt.

Tundra:
- Wings 1: `2a0c:b641:620::7`
- Wings 2: `2a0c:b641:620::8`
- UDP `7100`
- geen hostname
- geen HTTP(S)

Deze scheiding is een harde security-eis. HTTP(S)-verkeer naar de Wings API loopt via Bunny zodat de origin niet rechtstreeks als HTTP(S)-aanvalsoppervlak wordt blootgesteld. SFTP en gameverkeer gebruiken de directe node-route omdat deze protocollen niet via Bunny lopen. Tundra gebruikt uitsluitend de directe IPv6-adressen voor versleuteld Wings-naar-Wings-verkeer over UDP `7100` en wordt niet via DNS of HTTP(S) gerouteerd. Deze verkeerspaden worden niet met elkaar verwisseld.

---

# 8. TLS

Atrioxhosting gebruikt het wildcardcertificaat `*.atrioxhost.com`. Het door Atrioxhosting aangeleverde certificaatmateriaal staat uitsluitend in `/root/workspace/SSL.zip`. Voor alle publieke en service-TLS binnen deze rebuild gebruikt Codex uitsluitend certificaatmateriaal uit `/root/workspace/SSL.zip`.

Codex gebruikt voor publieke en service-TLS geen andere certificaten of TLS-oplossingen. Dit betekent:
- geen Let's Encrypt
- geen ACME
- geen automatisch gegenereerde certificaten
- geen self-signed certificaten
- geen nieuw wildcardcertificaat
- geen certificaat van een andere bron

De enige uitzondering is OpenLiteSpeed WebAdmin op `127.0.0.1:7080`. WebAdmin is uitsluitend via een lokale SSH-tunnel bereikbaar en mag het lokale self-signed WebAdmin-certificaat van OpenLiteSpeed gebruiken. Deze uitzondering geldt niet voor het Panel, de Wings API of enige andere service.

Codex genereert, vervangt of vernieuwt het aangeleverde wildcardcertificaat niet. Codex inspecteert `/root/workspace/SSL.zip`, identificeert daarin het bestaande certificaat/fullchain en de bijbehorende private key en controleert dat deze cryptografisch bij elkaar horen zonder private-keymateriaal in algemene output te tonen.

Wanneer publieke of service-TLS vereist is en het materiaal uit `/root/workspace/SSL.zip` technisch niet bruikbaar blijkt, stopt Codex vóór het configureren van een alternatief en rapporteert exact waarom het aangeleverde materiaal niet gebruikt kan worden.

De Panel URL is `https://dev-atrioxgame-panel.atrioxhost.com`.

De Wings API gebruikt uitsluitend de Bunny-hostnames:
- Wings 1: `https://dev-atrioxgame-wings-1.atrioxhost.com`
- Wings 2: `https://dev-atrioxgame-wings-2.atrioxhost.com`

Een letterlijk IPv6-adres en de directe node-hostnames `dev-atrioxgame-n1.atrioxhost.com` en `dev-atrioxgame-n2.atrioxhost.com` worden niet als Wings API HTTPS-endpoint gebruikt.

Private keys worden nooit in documentatie, Git, algemene logs of algemene Codex-output opgenomen.

---

# 9. Bunny

Bunny vormt de verplichte publieke HTTP(S)-laag voor het Calagopus Panel en de Wings API. HTTP(S)-verkeer naar deze diensten loopt via Bunny en wordt niet rechtstreeks door clients of het Panel naar de origin gestuurd. Dit voorkomt dat de HTTP(S)-bescherming wordt omzeild via het origin-adres of een directe node-hostname.

De centrale nftables-firewall op de router dwingt de originbescherming af. Verkeer naar originpoorten TCP `80`, `443`, `8080` en `8443` wordt vanaf externe uplinks uitsluitend doorgelaten wanneer het afkomstig is van de Bunny edge-sets. Andere externe bronnen naar deze originpoorten worden gedropt.

Er bestaat geen directe Panel → Wings uitzondering voor de Wings API. Panel → Wings API-verkeer gebruikt de publieke Bunny-hostname op HTTPS/TCP `443`. Bunny verbindt vervolgens met de betreffende Wings-origin op HTTPS/TCP `8443`.

De publieke Calagopus-hostnames zijn:
- Panel: `dev-atrioxgame-panel.atrioxhost.com`
- Wings 1: `dev-atrioxgame-wings-1.atrioxhost.com`
- Wings 2: `dev-atrioxgame-wings-2.atrioxhost.com`

De directe node-hostnames `dev-atrioxgame-n1.atrioxhost.com` en `dev-atrioxgame-n2.atrioxhost.com` worden niet voor de Wings API gebruikt.

Wings communiceert met het Panel via `https://dev-atrioxgame-panel.atrioxhost.com` op publieke HTTPS/TCP `443`. Bunny Shield mag deze communicatie niet blokkeren met een browserchallenge. Voor iedere Wings-node bestaat daarom een Bunny Shield-bypass die tegelijk matcht op het bron-IP-adres van die Wings-node en de exacte Calagopus Wings User-Agent.

Wings 1 gebruikt hiervoor de bronadressen `82.153.147.7` en `2a0c:b641:620::7`. Wings 2 gebruikt hiervoor de bronadressen `82.153.147.8` en `2a0c:b641:620::8`.

Na iedere Wings-upgrade wordt de actuele Calagopus Wings User-Agent opnieuw vastgesteld. Wanneer deze is gewijzigd, wordt de bijbehorende Bunny Shield-bypass daarmee gelijkgetrokken voordat de node als volledig werkend wordt beschouwd.

De Bunny Pull Zones, custom hostnames, originpoorten, TLS-configuratie en Bunny Shield-regels zijn externe infrastructuur en worden niet door Codex op de Panel- of Wings-VM's beheerd. Codex gebruikt deze bestaande Bunny-laag als vast onderdeel van de architectuur en vervangt de HTTP(S)-routes niet door rechtstreekse originverbindingen.

Join tokens, node tokens en andere geheimen worden nooit in deze documentatie of algemene Codex-output opgenomen.

---

# 10. Calagopus Panel deployment

De Panel-VM gebruikt een standalone Panel deployment. Er wordt geen All-in-One image en geen lokale Wings-instance op de Panel-VM geïnstalleerd.

De actieve productie-layout staat uitsluitend onder `/opt/calagopus-panel`. Er wordt geen actieve Calagopus deployment onder `/root`, `/tmp` of de Git-working-tree gemaakt en er bestaat slechts één actief Compose-project voor het Panel.

De runtime Compose-configuratie wordt gebaseerd op `/root/workspace/calagopus-panel/compose.yml` en geplaatst op `/opt/calagopus-panel/compose.yml`. De runtimeconfiguratie wordt aangepast aan de eisen uit dit document voordat de eerste definitieve `docker compose up -d` wordt uitgevoerd.

De Panel-service gebruikt de officiële stabiele productie-image `ghcr.io/calagopus/panel:latest`. Bij aanvang van deze rebuild is Calagopus Panel `1.2.1` de actuele stabiele release. Codex trekt de officiële image één keer binnen, controleert vóór OOBE dat de draaiende Panel-versie `1.2.1` is en registreert de gebruikte image digest in het eindrapport. Wanneer `:latest` geen Panel `1.2.1` oplevert, stopt Codex vóór OOBE en rapporteert de aangetroffen versie.

De overige images blijven de officiële images en tracks uit de meegeleverde standalone Compose-stack. Codex voert tijdens deze rebuild geen zelfstandige upgrades van Docker, PostgreSQL, Valkey of andere stackcomponenten uit en voert na de eerste succesvolle image-pull geen `docker compose pull` uit.

De hostbinding van de Panel-service is uitsluitend `127.0.0.1:8000:8000`. De backend wordt niet op `0.0.0.0:8000`, `[::]:8000` of het publieke VM-adres gepubliceerd.

De runtime gebruikt `/opt/calagopus-panel/.env` voor hostspecifieke geheimen en instellingen. Rechten:
- `/opt/calagopus-panel`: `0750`
- `/opt/calagopus-panel/compose.yml`: `0600`
- `/opt/calagopus-panel/.env`: `0600`

Codex genereert vóór de eerste start een sterke willekeurige `APP_ENCRYPTION_KEY` en een sterk willekeurig PostgreSQL-wachtwoord. De standaardwaarde `CHANGEME` en het standaard PostgreSQL-wachtwoord `panel` worden niet gebruikt. Geheimen worden niet in algemene output weergegeven.

De Panelconfiguratie bevat expliciet:
- `PORT=8000`
- `APP_DEBUG=false`
- `APP_LOG_DIRECTORY=/var/log/calagopus`
- `APP_PRIMARY=true`
- `APP_ENABLE_WINGS_PROXY=false`
- `APP_TRUSTED_PROXIES=172.30.0.1/32`

`APP_ENABLE_WINGS_PROXY=false` is een harde eis. Browser-, WebSocket-, download- en uploadverkeer naar Wings gebruikt de afzonderlijke Bunny-hostname van de betreffende Wings-node en wordt niet via het Panel geproxied.

`APP_TRUSTED_PROXIES` vertrouwt uitsluitend de Docker bridge-gateway `172.30.0.1/32`, omdat OpenLiteSpeed op de host de enige directe reverse proxy naar de Panel-container is. `0.0.0.0/0` en `::/0` worden niet als trusted proxy ingesteld.

De officiële Calagopus installatieprocedure blijft leidend voor de applicatie zelf. Hostspecifieke afwijkingen in deze specificatie, waaronder absolute persistence, loopback-publicatie, dual-stack Docker, NAT66, OpenLiteSpeed, Bunny en bovenstaande environmentwaarden, hebben voor deze Atrioxhosting deployment voorrang.

---

# 11. Persistente opslag

De actieve Compose-file gebruikt uitsluitend absolute bind mounts voor persistente Calagopus runtime-data:
- PostgreSQL: `/opt/calagopus-panel/postgres` → `/data`
- Panel data: `/opt/calagopus-panel/data` → `/var/lib/calagopus`
- Logs: `/opt/calagopus-panel/logs` → `/var/log/calagopus`
- Valkey: `/opt/calagopus-panel/cache` → `/data`
- PostgreSQL gebruikt `PGDATA=/data`

Relatieve persistence mounts zoals `./postgres`, `./data`, `./cache` en `./logs` worden niet gebruikt in de actieve runtime Compose-file.

## Verificatie vóór OOBE

OOBE wordt pas aan Menno aangeboden nadat alle onderstaande controles geslaagd zijn:

1. PostgreSQL gebruikt `/opt/calagopus-panel/postgres`.
2. `PGDATA=/data`.
3. Panel-data gebruikt `/opt/calagopus-panel/data`.
4. Valkey gebruikt `/opt/calagopus-panel/cache`.
5. Logs gebruiken `/opt/calagopus-panel/logs`.
6. De actieve Compose-labels wijzen naar `/opt/calagopus-panel/compose.yml`.
7. Een geforceerde container recreation behoudt de PostgreSQL system-ID en bestaande testdata.
8. `docker compose down` gevolgd door `docker compose up -d` behoudt de PostgreSQL system-ID en bestaande testdata.
9. Geen noodzakelijke Calagopus state leeft uitsluitend in een writable container layer.

Een hostreboot is geen standaard onderdeel van deze persistence-test. Alleen wanneer een concrete wijziging technisch een reboot vereist, geldt de centrale rebootprocedure uit hoofdstuk 2.

---

# 12. OpenLiteSpeed

OpenLiteSpeed is de enige reverse proxy voor het Panel op de Panel-VM. Codex installeert OpenLiteSpeed via de officiële OpenLiteSpeed package/repositoryprocedure en vervangt OpenLiteSpeed niet door Nginx, Caddy, Apache of een andere reverse proxy.

De Calagopus backend blijft uitsluitend lokaal bereikbaar:
- Luisteradres hostbinding: `127.0.0.1:8000`
- Niet toegestaan: `0.0.0.0:8000`
- Niet toegestaan: `[::]:8000`

Controle: `ss -lntp | grep 8000`

OpenLiteSpeed verzorgt HTTPS tussen Bunny en de Panel-origin en proxyt naar `127.0.0.1:8000`. OpenLiteSpeed stuurt het oorspronkelijke `Host`-header en de relevante forwarded headers door zodat Calagopus achter de reverse proxy correcte scheme- en clientinformatie kan verwerken. Calagopus vertrouwt uitsluitend de directe proxybron zoals vastgelegd met `APP_TRUSTED_PROXIES=172.30.0.1/32`.

## Workers

OpenLiteSpeed gebruikt:
- Workers: `16`
- CPU Affinity: `Not Set`
- Priority: `Not Set`

Codex stelt geen automatische of handmatige CPU affinity en geen aangepaste process priority in.

## WebAdmin

OpenLiteSpeed WebAdmin is uitsluitend lokaal bereikbaar:
- Luisteradres: `127.0.0.1:7080`
- Niet toegestaan: `0.0.0.0:7080`
- Niet toegestaan: `[::]:7080`

Poort `7080` wordt niet publiek beschikbaar gemaakt en wordt niet via Bunny bereikbaar gemaakt.

Vanaf Windows wordt WebAdmin via deze SSH-tunnel bereikt: `ssh -L 7080:127.0.0.1:7080 -p 25170 root@82.153.147.6`. WebAdmin wordt lokaal geopend via `https://127.0.0.1:7080`. De self-signed WebAdmin-certificaatwaarschuwing is voor uitsluitend deze lokale WebAdmin-interface toegestaan.

Codex configureert OpenLiteSpeed `CGIRLimit` zodanig dat AdminPHP zonder `503` functioneert.

Na de configuratie controleert Codex dat:
- De Calagopus backend uitsluitend via `127.0.0.1:8000` op de host is gepubliceerd
- De Calagopus backend niet via `0.0.0.0:8000` of `[::]:8000` is gepubliceerd
- WebAdmin uitsluitend luistert op `127.0.0.1:7080`
- WebAdmin niet luistert op `0.0.0.0:7080` of `[::]:7080`
- AdminPHP zonder `503` via WebAdmin functioneert
- De publieke Panel-route via Bunny en OpenLiteSpeed de backend bereikt zonder de backend rechtstreeks publiek te maken

---

# 13. Panel TLS
Het wildcardcertificaat wordt onder OpenLiteSpeed opgeslagen in: `/usr/local/lsws/conf/cert/dev-atrioxgame-panel.atrioxhost.com/`

Bestanden:
- `fullchain.pem`
- `private-key.pem`

Rechten:
```text
fullchain.pem     0644
private-key.pem   0600
```

OpenLiteSpeed gebruikt:
```text
keyFile conf/cert/dev-atrioxgame-panel.atrioxhost.com/private-key.pem
certFile conf/cert/dev-atrioxgame-panel.atrioxhost.com/fullchain.pem
certChain 1
```

De Calagopus backend blijft achter OpenLiteSpeed op `127.0.0.1:8000`.

---

# 14. Docker IPv6 op Panel
Het Calagopus backend Docker-netwerk is dual-stack.
- IPv4 subnet: `172.30.0.0/24`
- IPv4 gateway: `172.30.0.1`
- IPv6 ULA subnet: `fd6d:3f4b:7e9c::/64`
- IPv6 gateway: `fd6d:3f4b:7e9c::1`

Compose-configuratie:
```yaml
networks:
  backend:
    driver: bridge
    enable_ipv6: true
    ipam:
      config:
        - subnet: 172.30.0.0/24
          gateway: 172.30.0.1
        - subnet: fd6d:3f4b:7e9c::/64
          gateway: fd6d:3f4b:7e9c::1
```

Het publieke subnet: `2a0c:b641:620::/64` wordt niet als Docker bridge-subnet gebruikt.

---

# 15. NAT66 op Panel

Het Calagopus backend Docker-netwerk gebruikt voor IPv6 het ULA-subnet `fd6d:3f4b:7e9c::/64`. Dit subnet is niet publiek routeerbaar. Voor uitgaand IPv6-verkeer vanaf containers configureert Codex persistente NAT66 op de Panel-VM.

NAT66 wordt uitsluitend toegepast op verkeer dat:
- Als bron een adres uit `fd6d:3f4b:7e9c::/64` gebruikt
- Via interface `ens18` de Panel-VM verlaat

Dit verkeer wordt met SNAT vertaald naar het publieke IPv6-adres van het Panel:
- Bron-subnet: `fd6d:3f4b:7e9c::/64`
- Uitgaande interface: `ens18`
- SNAT-adres: `2a0c:b641:620::6`

De NAT66-configuratie gebruikt een afzonderlijke lokale nftables IPv6-table:
- Table: `ip6 calagopus_nat66`
- Functie: uitsluitend NAT66 voor het Calagopus backend Docker-netwerk

Codex maakt deze NAT66-configuratie tijdens de rebuild aan. De NAT66-regel wordt persistent gemaakt met een afzonderlijke systemd-service:
- Service: `calagopus-nat66.service`
- Status na configuratie: `enabled`
- Status na configuratie: `active`

De service laadt de NAT66-configuratie bij het starten van de Panel-VM. Het opnieuw starten van de service veroorzaakt geen dubbele NAT66-regels.

Docker-beheerde nftables- of iptables-regels worden niet handmatig aangepast. De NAT66-configuratie blijft volledig gescheiden van de door Docker beheerde firewallregels en van de centrale nftables-firewall op de router.

## Verificatie

Codex controleert dat de table `ip6 calagopus_nat66` bestaat, de SNAT-regel actief is en `calagopus-nat66.service` zowel `enabled` als `active` is. Codex herstart uitsluitend deze lokale NAT66-service en controleert daarna dat geen dubbele NAT66-regels zijn ontstaan.

Vanuit de Panel-container voert Codex expliciet IPv6-verkeer uit via de publieke Bunny-route naar:
- `dev-atrioxgame-wings-1.atrioxhost.com` op TCP `443`
- `dev-atrioxgame-wings-2.atrioxhost.com` op TCP `443`

Deze verificatie gebruikt geen directe verbinding naar een Wings-origin op TCP `8080` of TCP `8443`.

Tijdens de IPv6-test controleert Codex met packet capture op `ens18` dat verkeer de VM verlaat met bronadres `2a0c:b641:620::6` en niet met een adres uit `fd6d:3f4b:7e9c::/64`. De NAT66-counter loopt tijdens de test op. Voor deze specifieke NAT66-test is de HTTP-statuscode niet bepalend; de test slaagt wanneer vertaald IPv6-verkeer met het correcte bronadres de VM verlaat en retourverkeer de Panel-container bereikt.

Een hostreboot is geen standaard NAT66-test. Wanneer een concrete wijziging technisch een reboot vereist, stopt Codex vóór de reboot en volgt uitsluitend de centrale rebootprocedure uit hoofdstuk 2.

---

# 16. Wings deployment

De Wings-deployment begint pas nadat de volledige Panel-deployment is afgerond en Menno expliciet aangeeft dat Codex door mag gaan met Wings. Codex begint niet zelfstandig met de installatie, configuratie, registratie of activatie van Wings 1 of Wings 2. Het afronden van de Panel-deployment vormt op zichzelf geen toestemming om met Wings verder te gaan.

Voordat de Wings-deployment voor een node begint:
- De Panel-deployment is volledig afgerond
- De vereiste Panel-controles zijn succesvol afgerond
- Het Panel is bereikbaar en functioneert correct
- Menno heeft expliciet aangegeven dat de Wings-deployment mag beginnen
- Menno heeft de door het nieuwe Panel gegenereerde join-data voor die specifieke Wings-node aan Codex verstrekt

Codex probeert de join-data niet zelfstandig te verkrijgen, te genereren of uit een vorige installatie te herstellen. Iedere Wings-node gebruikt uitsluitend de join-data die door het nieuw geïnstalleerde Panel voor die specifieke node is gegenereerd. Join-data van Wings 1 wordt niet voor Wings 2 gebruikt en omgekeerd.

Join tokens, node tokens en andere geheimen worden niet in documentatie, Git, algemene logs of het eindrapport opgenomen. Codex herhaalt ontvangen join-data niet onnodig in output.

## Poorten

Wings gebruikt:
- Control API origin listener: TCP `8443`
- SFTP: TCP `2022`
- Tundra: UDP `7100`
- Game allocations: TCP/UDP `30200-31199`

## TLS en API-route

De Wings API origin gebruikt het wildcardcertificaat `*.atrioxhost.com` uit `/root/workspace/SSL.zip` en luistert op TCP `8443`.

Publieke en Panel → Wings API-verbindingen gebruiken de Bunny-hostnames op de normale publieke HTTPS-poort TCP `443`:
- Wings 1: `https://dev-atrioxgame-wings-1.atrioxhost.com`
- Wings 2: `https://dev-atrioxgame-wings-2.atrioxhost.com`

Bunny verbindt vanaf zijn edge-infrastructuur met de Wings-origin op TCP `8443`. De directe node-hostnames `dev-atrioxgame-n1.atrioxhost.com` en `dev-atrioxgame-n2.atrioxhost.com` worden niet voor de Wings API gebruikt.

De Wings-configuratie wordt toegepast met de door het Panel gegenereerde join-data. Codex toont join-data niet in algemene output en gebruikt geen oude of handmatig geconstrueerde tokens.

---

# 17. Node-configuratie

De volgende waarden worden gebruikt wanneer Menno de Wings-nodes in het Panel aanmaakt. Menno maakt de node aan en verstrekt daarna de Panel-generated join-data aan Codex. Codex verzint deze gegevens niet zelf.

Calagopus onderscheidt in de nodeconfiguratie de `URL` voor Panel → Wings en de optionele `Public URL` voor browser/WebSocket/download/upload-verkeer. Voor Atrioxhosting gebruiken beide velden de Bunny-hostname van de betreffende Wings-node.

De publieke Bunny-route gebruikt HTTPS/TCP `443`. De Wings API luistert op de origin op TCP `8443`. Daardoor is de afwijking tussen de impliciete poort `443` van de node-URL en de ingestelde Wings API Port `8443` bewust en correct voor deze reverse-proxyarchitectuur. Een Calagopus-waarschuwing over deze poortafwijking wordt niet opgelost door `:8443` aan de Bunny-URL toe te voegen.

## Wings 1

Wings 1 gebruikt:
- Name: `dev-wings-1`
- Location: `dev-wings-1`
- Memory: `16 GiB`
- Disk: `50 GiB`
- Backup Configuration: `Local`
- Deployment: `Enabled`
- Maintenance: `Off`
- URL: `https://dev-atrioxgame-wings-1.atrioxhost.com`
- Public URL: `https://dev-atrioxgame-wings-1.atrioxhost.com`
- Panel URL voor Wings: `https://dev-atrioxgame-panel.atrioxhost.com`
- API Port: `8443`
- SFTP Port: `2022`
- SFTP Host: `dev-atrioxgame-n1.atrioxhost.com`

De directe node-hostname `dev-atrioxgame-n1.atrioxhost.com` wordt niet voor de Wings API gebruikt en blijft uitsluitend bestemd voor direct verkeer waarvoor Bunny niet wordt gebruikt, waaronder SFTP en gameverkeer.

## Wings 2

Wings 2 gebruikt:
- Name: `dev-wings-2`
- Location: `dev-wings-2`
- Memory: `16 GiB`
- Disk: `50 GiB`
- Backup Configuration: `Local`
- Deployment: `Enabled`
- Maintenance: `Off`
- URL: `https://dev-atrioxgame-wings-2.atrioxhost.com`
- Public URL: `https://dev-atrioxgame-wings-2.atrioxhost.com`
- Panel URL voor Wings: `https://dev-atrioxgame-panel.atrioxhost.com`
- API Port: `8443`
- SFTP Port: `2022`
- SFTP Host: `dev-atrioxgame-n2.atrioxhost.com`

De directe node-hostname `dev-atrioxgame-n2.atrioxhost.com` wordt niet voor de Wings API gebruikt en blijft uitsluitend bestemd voor direct verkeer waarvoor Bunny niet wordt gebruikt, waaronder SFTP en gameverkeer.

Voor beide Wings-nodes geldt: Panel → Wings API via Bunny op publieke TCP `443`, Bunny → Wings-origin op TCP `8443`, Wings → Panel via `https://dev-atrioxgame-panel.atrioxhost.com`, SFTP direct op TCP `2022`.

---

# 18. Tundra / Private Network

Tundra vormt het private netwerk tussen Wings 1 en Wings 2. Tundra gebruikt rechtstreeks IPv6-verkeer tussen beide Wings-nodes en loopt niet via Bunny, DNS of HTTP(S).

Codex configureert Tundra met:
- Protocol: UDP
- UDP Port: `7100`
- Wings 1 Host: `2a0c:b641:620::7`
- Wings 2 Host: `2a0c:b641:620::8`

Het Tundra Host-veld bevat uitsluitend het directe IPv6-adres van de betreffende Wings-node. Het Host-veld bevat geen `https://`, hostname, IPv6-brackets of `:7100`. De UDP-poort `7100` wordt uitsluitend in het daarvoor bestemde poortveld ingesteld.

Tundra wordt pas ingeschakeld nadat de normale Calagopus control-plane voor beide Wings-nodes volledig functioneert.

Voordat Codex Tundra inschakelt, moeten alle onderstaande controles succesvol zijn:
- Wings 1 communiceert succesvol met het Panel via `https://dev-atrioxgame-panel.atrioxhost.com` op publieke HTTPS/TCP `443`
- Wings 2 communiceert succesvol met het Panel via `https://dev-atrioxgame-panel.atrioxhost.com` op publieke HTTPS/TCP `443`
- Het Panel bereikt Wings 1 via `https://dev-atrioxgame-wings-1.atrioxhost.com` en Bunny op publieke HTTPS/TCP `443`
- Het Panel bereikt Wings 2 via `https://dev-atrioxgame-wings-2.atrioxhost.com` en Bunny op publieke HTTPS/TCP `443`
- De Wings API origin listener gebruikt TCP `8443`
- Beide Wings-services functioneren correct

Tundra-verkeer zelf gebruikt nooit de Bunny-hostnames of de directe node-hostnames. Wings 1 en Wings 2 communiceren voor Tundra uitsluitend met de hierboven vastgelegde directe IPv6-adressen over UDP `7100`.

De centrale nftables-firewall op de router staat Tundra-verkeer uitsluitend rechtstreeks tussen de Calagopus Wings-nodes toe. Codex wijzigt hiervoor geen firewallconfiguratie op het Panel of de Wings-VM's.

Na het inschakelen van Tundra controleert Codex dat beide Wings-nodes via het private netwerk met elkaar kunnen communiceren. Een fout tijdens het inschakelen van Tundra wordt niet opgelost door HTTP(S)-routes, Bunny-routes of Wings API-hostnames te vervangen door directe verbindingen. Codex controleert eerst de Tundra-configuratie, UDP `7100`, de gebruikte IPv6-adressen en de bestaande control-plane.

---

# 19. Vaste rebuildvolgorde

De rebuild wordt in vaste fasen uitgevoerd. Codex rondt eerst de volledige Panel-deployment af. De Wings-deployment begint daarna niet automatisch.

## Panel

De Panel-VM staat vóór aanvang op de schone post-bootstrap baseline. Git, Git-authenticatie, Codex en `bubblewrap` zijn geïnstalleerd en werkend. De Git-working-tree `/root/workspace/calagopus-panel` bestaat al en wordt niet opnieuw gecloned.

Codex voert de Panel-deployment in deze volgorde uit:

1. Controleer hostname, IPv4, IPv6, DNS en SSH zonder netwerk- of SSH-services te herstarten.
2. Controleer `/root/workspace/calagopus-panel`, een schone working tree, branch `main`, `origin` en `upstream` volgens hoofdstuk 5. Clone, merge, rebase en branchwissel worden niet uitgevoerd.
3. Maak `/opt/calagopus-panel` aan met de vastgelegde rechten en plaats daar de runtime `compose.yml` en `.env` volgens hoofdstuk 10.
4. Baseer de runtime Compose-stack op de bestaande standalone `compose.yml` uit de Git-working-tree en pas uitsluitend de in deze specificatie vastgelegde Atrioxhosting runtime-eisen toe.
5. Configureer sterke runtimegeheimen, absolute persistente mounts, de loopbackbinding `127.0.0.1:8000:8000`, `APP_ENABLE_WINGS_PROXY=false` en `APP_TRUSTED_PROXIES=172.30.0.1/32`.
6. Configureer het Calagopus backend Docker-netwerk direct als dual-stack netwerk volgens hoofdstuk 14.
7. Trek de officiële images één keer binnen, start de runtime en controleer dat het Panel `1.2.1` draait voordat OOBE wordt uitgevoerd.
8. Controleer actieve mounts, `PGDATA`, container health, Compose-projectdirectory en Docker-netwerk.
9. Installeer en configureer OpenLiteSpeed als reverse proxy volgens hoofdstuk 12.
10. Configureer het wildcardcertificaat uit `/root/workspace/SSL.zip` voor de publieke Panel-origin.
11. Configureer OpenLiteSpeed WebAdmin uitsluitend op `127.0.0.1:7080`, `16` workers, CPU Affinity `Not Set`, Priority `Not Set` en werkende `CGIRLimit`/AdminPHP.
12. Configureer persistente NAT66 voor het IPv6 ULA-subnet en voer de NAT66-verificaties uit.
13. Voer de niet-destructieve persistence-tests uit hoofdstuk 11 uit.
14. Controleer dat `https://dev-atrioxgame-panel.atrioxhost.com` de OOBE via Bunny en OpenLiteSpeed bereikt.
15. Stop bij de OOBE en laat Menno de initiële Panel-account/OOBE-gegevens handmatig invoeren. Codex verzint, kiest of logt geen beheerderwachtwoord namens Menno.
16. Nadat Menno meldt dat OOBE is voltooid, hervat Codex en rondt alle Panel-controles uit hoofdstuk 20 af.

Na het succesvol afronden van de Panel-fase begint Codex niet zelfstandig aan Wings. Codex stopt en wacht op expliciete toestemming van Menno en op de door Menno verstrekte nieuwe Panel-generated join-data voor de betreffende node.

## Wings 1

Codex begint pas met Wings 1 nadat Menno expliciet toestemming heeft gegeven en de join-data voor Wings 1 heeft verstrekt.

De Wings 1-VM staat vóór aanvang op de schone post-bootstrap baseline. Git, Git-authenticatie, Codex en `bubblewrap` zijn reeds aanwezig en worden niet opnieuw geïnstalleerd of vervangen.

Codex voert voor Wings 1 deze volgorde uit:

1. Controleer hostname, IPv4, IPv6, DNS en SSH zonder hostnetwerk of SSH te herstarten.
2. Installeer Calagopus Wings volgens de officiële standalone Wings-procedure.
3. Pas uitsluitend de door Menno verstrekte nieuwe Panel-generated join-data voor Wings 1 toe.
4. Configureer de Wings API origin op TCP `8443` met het wildcardcertificaat uit `/root/workspace/SSL.zip`.
5. Configureer SFTP op TCP `2022`.
6. Verifieer Wings 1 → Panel via `https://dev-atrioxgame-panel.atrioxhost.com`.
7. Verifieer Panel → Wings 1 via `https://dev-atrioxgame-wings-1.atrioxhost.com` en Bunny.
8. Verifieer browser/Public URL-verkeer via dezelfde Bunny-hostname.
9. Controleer dat `dev-atrioxgame-n1.atrioxhost.com` niet als API-route wordt gebruikt.
10. Controleer dat de bestaande Bunny Shield-configuratie de control-plane niet blokkeert.

Tundra wordt in deze Wings 1-fase nog niet ingeschakeld.

Codex wijzigt Bunny Pull Zones, custom hostnames of Bunny Shield-regels niet. Wanneer de bestaande Bunny-configuratie de vereiste communicatie blokkeert, stopt Codex en rapporteert exact welke verbinding wordt geblokkeerd.

## Wings 2

Codex begint pas met Wings 2 nadat Menno expliciet toestemming heeft gegeven en de join-data voor Wings 2 heeft verstrekt.

Voor Wings 2 gelden dezelfde stappen met:
- Hostname: `dev-wings-2.atrioxhost.com`
- IPv4: `82.153.147.8`
- IPv6: `2a0c:b641:620::8`
- Bunny API/Public-hostname: `dev-atrioxgame-wings-2.atrioxhost.com`
- Directe node-hostname: `dev-atrioxgame-n2.atrioxhost.com`
- API origin port: TCP `8443`
- SFTP Port: TCP `2022`
- Tundra Port: UDP `7100`

Join-data van Wings 1 wordt nooit voor Wings 2 gebruikt en join-data van Wings 2 wordt nooit voor Wings 1 gebruikt.

Pas nadat beide Wings-nodes afzonderlijk volledig functioneren via de normale control-plane, configureert en verifieert Codex Tundra tussen Wings 1 en Wings 2 volgens hoofdstuk 18.

---

# 20. Verificatie vóór functioneel gebruik

De Calagopus-omgeving wordt pas als technisch gereed beschouwd nadat alle controles voor de reeds vrijgegeven fase succesvol zijn afgerond.

## Panel

Voor het Panel moeten alle onderstaande punten waar zijn:
- IPv4-connectiviteit werkt
- IPv6-connectiviteit werkt
- SSH werkt op TCP `25170`
- Het Panel draait als standalone Panel en niet als AIO
- Het Panel rapporteert versie `1.2.1`
- Het Panel werkt via `https://dev-atrioxgame-panel.atrioxhost.com`
- OpenLiteSpeed functioneert als reverse proxy
- De host publiceert de Calagopus backend uitsluitend op `127.0.0.1:8000`
- De backend wordt niet op `0.0.0.0:8000` of `[::]:8000` gepubliceerd
- OpenLiteSpeed WebAdmin luistert uitsluitend op `127.0.0.1:7080`
- AdminPHP functioneert zonder `503`
- `APP_ENABLE_WINGS_PROXY=false`
- `APP_TRUSTED_PROXIES=172.30.0.1/32`
- De runtime Compose-file staat op `/opt/calagopus-panel/compose.yml`
- De runtime `.env` staat op `/opt/calagopus-panel/.env`
- Runtimegeheimen staan niet in Git en de standaardwaarden `CHANGEME` en PostgreSQL-wachtwoord `panel` worden niet gebruikt
- Het backend Docker-netwerk is dual-stack
- De Panel-container heeft een IPv6-adres uit `fd6d:3f4b:7e9c::/64`
- `calagopus-nat66.service` is `enabled` en `active`
- Uitgaand IPv6-containerverkeer wordt via NAT66 vertaald naar `2a0c:b641:620::6`
- De NAT66-counter loopt op tijdens een IPv6-test
- PostgreSQL, Valkey, Panel-data en logs gebruiken de vastgelegde absolute persistente hostmounts
- Geforceerde container recreation behoudt de PostgreSQL system-ID en bestaande testdata
- `docker compose down` gevolgd door `docker compose up -d` behoudt de PostgreSQL system-ID en bestaande testdata
- Geen noodzakelijke Calagopus-state leeft uitsluitend in een writable container layer
- De actieve runtime deployment staat uitsluitend onder `/opt/calagopus-panel`
- De Git-working-tree blijft afzonderlijk onder `/root/workspace/calagopus-panel`

## Wings 1 en Wings 2

Voor iedere vrijgegeven Wings-node moeten de onderstaande punten waar zijn:
- De Wings-service functioneert correct
- De Wings API origin luistert op TCP `8443`
- SFTP luistert op TCP `2022`
- Wings → Panel werkt via `https://dev-atrioxgame-panel.atrioxhost.com`
- Panel → Wings werkt via de eigen Bunny-hostname op publieke HTTPS/TCP `443`
- De node `URL` en `Public URL` gebruiken de eigen Bunny-hostname zonder `:8443`
- De Wings API is niet afhankelijk van een directe HTTP(S)-verbinding via `dev-atrioxgame-n1.atrioxhost.com` of `dev-atrioxgame-n2.atrioxhost.com`
- Het wildcardcertificaat uit `/root/workspace/SSL.zip` wordt voor de Wings API origin gebruikt
- De game-port range TCP/UDP `30200-31199` is via de centrale firewall beschikbaar
- SFTP TCP `2022` is via de directe node-route beschikbaar

Nadat beide Wings-nodes afzonderlijk functioneren, moeten bovendien alle Tundra-controles waar zijn:
- Tundra UDP `7100` werkt rechtstreeks tussen beide Wings-nodes
- Tundra gebruikt voor Wings 1 uitsluitend `2a0c:b641:620::7`
- Tundra gebruikt voor Wings 2 uitsluitend `2a0c:b641:620::8`
- Tundra gebruikt geen Bunny-hostname, directe node-hostname of HTTP(S)

Een fase wordt niet als technisch gereed beschouwd wanneer één van de controles voor die fase faalt.

---

# 21. Bekende fouten uit de vorige run

De volgende configuraties zijn niet toegestaan.

## Docker backend zonder IPv6

Niet toegestaan. Het Calagopus backend Docker-netwerk is vanaf de eerste definitieve deployment dual-stack.

## ULA zonder NAT66

Niet toegestaan. Uitgaand IPv6-verkeer uit `fd6d:3f4b:7e9c::/64` wordt via persistente NAT66 vertaald naar `2a0c:b641:620::6` via `ens18`.

## Relatieve persistence mounts

Niet toegestaan. Alle persistente runtime mounts gebruiken absolute hostpaden onder `/opt/calagopus-panel/...`.

## Tweede deployment of tweede Git-clone

Niet toegestaan. Er bestaat één actieve Panel runtime deployment op `/opt/calagopus-panel` en één broncode-working-tree op `/root/workspace/calagopus-panel`. Codex maakt geen tweede deployment of clone onder `/root`, `/tmp` of een andere directory.

## Broncode-working-tree als runtime

Niet toegestaan. `/root/workspace/calagopus-panel` is broncode. `/opt/calagopus-panel` is runtime. Hostspecifieke Compose-, `.env`- en persistence-data worden niet in de Git-working-tree geplaatst.

## Publieke backend op poort 8000

Niet toegestaan. De hostbinding is uitsluitend `127.0.0.1:8000:8000` en OpenLiteSpeed is de publieke originlaag achter Bunny.

## Wings Proxy via het Panel

Niet toegestaan. `APP_ENABLE_WINGS_PROXY=false`. Wings browser-, WebSocket-, download- en uploadverkeer gebruikt de eigen Bunny-hostname van de node.

## Directe Wings API-route

Niet toegestaan. De publieke en Panel → Wings API-route gebruikt HTTPS via Bunny op TCP `443`; de Wings API origin luistert op TCP `8443`. De directe node-hostnames worden niet voor de Wings API gebruikt en er bestaat geen directe Panel → Wings firewalluitzondering op TCP `8080` of TCP `8443`.

## Bunny-URL met `:8443`

Niet toegestaan. De Calagopus node `URL` en `Public URL` gebruiken de Bunny-hostname zonder `:8443`. De poortafwijking is bewust: publieke Bunny-route TCP `443`, Wings origin listener TCP `8443`.

## Tundra vóór beide werkende Wings-nodes

Niet toegestaan. Tundra wordt pas ingeschakeld nadat Wings 1 en Wings 2 afzonderlijk via de normale control-plane functioneren.

## Codex reboot

Niet toegestaan. Codex voert geen hostreboot uit. Wanneer een wijziging daadwerkelijk een reboot vereist, geldt uitsluitend de centrale rebootprocedure uit hoofdstuk 2 en voert Menno de reboot uit.

## Destructieve Docker cleanup

Niet toegestaan. Codex voert geen `docker compose down -v` uit, verwijdert geen Docker-volumes en verwijdert geen persistente PostgreSQL-, Valkey-, Panel- of logdata zonder expliciete opdracht van Menno.

---

# 22. Codex-startinstructie

Gebruik deze instructie aan het begin van iedere nieuwe Codex-sessie op deze omgeving:

> Lees eerst `/root/workspace/calagopus-specification.md` volledig en behandel iedere regel als harde uitvoerseis. Neem geen alternatieve ontwerpbeslissingen voor keuzes die daar al vastliggen. Verbreek nooit de actieve SSH/Codex-sessie. Voer geen `reboot`, `shutdown`, `poweroff`, hostnetwerk-restart, SSH-restart of andere hostactie uit die de sessie kan verbreken. Wanneer een noodzakelijke wijziging pas na een reboot actief wordt, stop vóór de reboot en volg uitsluitend de rebootprocedure uit het document. Gebruik nooit `docker compose down -v` en verwijder geen Docker-volumes of persistente Calagopus-data zonder expliciete opdracht van Menno. Controleer vóór iedere container- of netwerk-recreation de daadwerkelijke persistente mounts. De bestaande Git-working-tree staat op `/root/workspace/calagopus-panel`; clone deze repository niet opnieuw en voer geen zelfstandige merge, rebase of branchwissel uit. De actieve Calagopus Panel runtime deployment staat uitsluitend onder `/opt/calagopus-panel` en gebruikt absolute persistente mounts. Git, Git-authenticatie, Codex en `bubblewrap` zijn al geïnstalleerd en werkend en worden niet opnieuw geïnstalleerd, verwijderd of vervangen. Wijzig de centrale nftables-firewall op de router niet. Werk uitsluitend de Panel-fase af. Stop voor handmatige Menno-interactie bij OOBE, een technisch noodzakelijke reboot of een externe Bunny/firewallblokkade. Begin na de Panel-fase niet zelfstandig aan Wings en wacht op expliciete toestemming van Menno en de nieuwe Panel-generated join-data voor de betreffende node. Gebruik voor de Wings API de Bunny-hostnames via publieke HTTPS/TCP `443`, terwijl de Wings API origin op TCP `8443` luistert. Maak geen directe Panel → Wings API-route. Gebruik Tundra pas nadat beide Wings-nodes normaal functioneren en uitsluitend via de vastgelegde directe IPv6-adressen over UDP `7100`.

---
