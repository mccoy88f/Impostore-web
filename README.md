# 🕵️ L'Impostore — Docker Edition

Gioco multiplayer in tempo reale. L'host crea una sessione, i giocatori scansionano il QR code e ognuno vede il proprio ruolo sul telefono.

## Avvio rapido

```bash
docker compose up -d
```

Poi apri **http://localhost:3000** sul dispositivo host.

## Come si gioca

1. **L'host** apre `http://localhost:3000`, inserisce il suo nome e crea una sessione
2. Viene generato un **QR code** — i giocatori lo scansionano con il telefono
3. Ogni giocatore inserisce il proprio nome ed entra nella lobby
4. L'host vede la lista e preme **"Inizia la partita"** (minimo 3 giocatori)
5. Ogni giocatore tocca la propria schermata per vedere il ruolo:
   - **Giocatori normali** → vedono la parola segreta
   - **L'impostore** → vede solo "IMPOSTORE", non conosce la parola
6. Inizia la discussione — tutti descrivono la parola senza dirla
7. L'impostore cerca di non farsi scoprire
8. Alla fine del timer (o quando l'host decide), si **rivela la parola** e chi era l'impostore

## Configurazione rete

> ⚠️ Per giocare da telefoni sulla stessa rete WiFi, l'host deve aprire la pagina con l'**IP locale** del server, non `localhost`.

Esempio: se il server gira su un PC con IP `192.168.1.10`, aprire:
```
http://192.168.1.10:3000
```

Il QR code generato userà automaticamente quell'indirizzo.

## Porta personalizzata

```bash
PORT=8080 docker compose up -d
```

## Build manuale

```bash
npm install
npm start
```
