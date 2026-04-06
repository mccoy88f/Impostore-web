const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// ─── WORD DATABASE ───
const WORDS = [
  "Cane","Gatto","Cavallo","Mucca","Maiale","Pecora","Coniglio","Gallina","Asino","Capra",
  "Topo","Uccello","Pesce","Serpente","Farfalla","Ape","Mosca","Rana","Gufo","Piccione",
  "Leone","Orso","Lupo","Volpe","Cervo","Aquila","Pinguino","Delfino","Balena","Squalo",
  "Elefante","Giraffa","Zebra","Scimmia","Coccodrillo","Tartaruga","Corvo","Toro","Cigno","Fenicottero",
  "Pizza","Pasta","Pane","Riso","Patata","Pomodoro","Cipolla","Carota","Insalata","Aglio",
  "Mela","Banana","Arancia","Fragola","Uva","Anguria","Pesca","Limone","Ciliegia","Pera",
  "Gelato","Torta","Biscotto","Cioccolato","Caramella","Patatine","Sandwich","Uovo","Formaggio","Burro",
  "Latte","Caffè","Birra","Vino","Succo","Tè","Yogurt","Miele","Marmellata","Nutella",
  "Pollo","Manzo","Salsiccia","Tonno","Salmone","Prosciutto","Salame","Gambero","Pizza","Lasagne",
  "Sedia","Tavolo","Letto","Divano","Armadio","Porta","Finestra","Scala","Tetto","Muro",
  "Cucchiaio","Forchetta","Coltello","Piatto","Bicchiere","Pentola","Padella","Forno","Frigorifero","Lavandino",
  "Telefono","Computer","Televisore","Orologio","Lampada","Candela","Specchio","Quadro","Tappeto","Radio",
  "Chiave","Ombrello","Borsa","Zaino","Valigia","Portafoglio","Occhiali","Cappello","Guanti","Scarpe",
  "Maglietta","Pantaloni","Gonna","Vestito","Giacca","Cappotto","Stivali","Sandali","Calze","Maglione",
  "Casa","Scuola","Ospedale","Chiesa","Supermercato","Ristorante","Bar","Cinema","Teatro","Parco",
  "Spiaggia","Montagna","Lago","Foresta","Deserto","Città","Strada","Ponte","Aeroporto","Stazione",
  "Auto","Moto","Bici","Autobus","Treno","Aereo","Barca","Camion","Taxi","Ambulanza",
  "Elicottero","Nave","Tram","Metro","Trattore","Razzo","Sottomarino","Furgone","Monopattino","Canoa",
  "Sole","Luna","Stella","Nuvola","Pioggia","Neve","Vento","Tuono","Arcobaleno","Nebbia",
  "Fuoco","Albero","Fiore","Erba","Foglia","Ramo","Seme","Fiume","Mare","Vulcano",
  "Calcio","Basket","Tennis","Nuoto","Ciclismo","Boxe","Sci","Surf","Golf","Pallone",
  "Scacchi","Carte","Dado","Puzzle","Videogioco","Altalena","Scivolo","Corda","Pallone","Frisbee",
  "Mamma","Papà","Fratello","Sorella","Nonno","Nonna","Zio","Zia","Amico","Bambino",
  "Dottore","Maestro","Poliziotto","Cuoco","Pompiere","Soldato","Meccanico","Idraulico","Cassiere","Prete",
  "Testa","Capelli","Occhio","Naso","Bocca","Orecchio","Dente","Mano","Piede","Cuore",
  "Penna","Matita","Gomma","Quaderno","Libro","Lavagna","Cartella","Tastiera","Mouse","Stampa",
  "Cellulare","Cuffie","Wifi","Email","Foto","Video","Musica","Film","Giornale","Rivista",
  "Natale","Pasqua","Compleanno","Carnevale","Halloween","Capodanno","Estate","Inverno","Primavera","Autunno",
  "Rosso","Blu","Verde","Giallo","Nero","Bianco","Rosa","Viola","Arancione","Marrone",
  "Cerchio","Quadrato","Triangolo","Cuore","Stella","Freccia","Croce","Nuvola","Fulmine","Corona"
];

// ─── SESSION STORE ───
const sessions = new Map();

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function createSession(hostName) {
  const id = uuidv4().slice(0, 8).toUpperCase();
  const session = {
    id,
    hostName,
    hostSocketId: null,
    players: [],      // { id, name, socketId, ready }
    state: 'lobby',   // lobby | playing | finished
    word: null,
    impostorId: null,
    timerSeconds: 120,
    timerStarted: null,
  };
  sessions.set(id, session);
  return session;
}

function sessionPublicState(session) {
  return {
    id: session.id,
    hostName: session.hostName,
    state: session.state,
    players: session.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    timerSeconds: session.timerSeconds,
  };
}

// ─── REST ENDPOINTS ───

// Create session
app.post('/api/session', async (req, res) => {
  const { hostName, timerSeconds } = req.body;
  if (!hostName) return res.status(400).json({ error: 'Nome host richiesto' });
  const session = createSession(hostName.trim().slice(0, 20));
  if (timerSeconds && timerSeconds >= 30) session.timerSeconds = Math.min(600, timerSeconds);

  const baseUrl = req.headers['x-forwarded-host']
    ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host']}`
    : `http://${req.headers.host}`;
  const joinUrl = `${baseUrl}/join/${session.id}`;
  const qr = await QRCode.toDataURL(joinUrl, {
    width: 300, margin: 2,
    color: { dark: '#e8e6df', light: '#111118' }
  });

  res.json({ sessionId: session.id, joinUrl, qr });
});

// Join page
app.get('/join/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/player.html'));
});

// ─── SOCKET.IO ───
io.on('connection', (socket) => {

  // Host reconnects / watches session
  socket.on('host:watch', ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return socket.emit('error', 'Sessione non trovata');
    session.hostSocketId = socket.id;
    socket.join(`session:${sessionId}`);
    socket.emit('session:state', sessionPublicState(session));
  });

  // Player joins
  socket.on('player:join', ({ sessionId, playerName }) => {
    const session = sessions.get(sessionId);
    if (!session) return socket.emit('error', 'Sessione non trovata');
    if (session.state !== 'lobby') return socket.emit('error', 'Partita già iniziata');
    if (session.players.length >= 12) return socket.emit('error', 'Partita piena (max 12)');

    const name = (playerName || 'Giocatore').trim().slice(0, 16);
    const player = { id: socket.id, name, socketId: socket.id, ready: true };
    session.players.push(player);
    socket.join(`session:${sessionId}`);
    socket.data.sessionId = sessionId;
    socket.data.playerId = socket.id;

    socket.emit('player:joined', { playerId: socket.id, name, sessionId });
    io.to(`session:${sessionId}`).emit('session:state', sessionPublicState(session));
  });

  // Host starts game
  socket.on('host:start', ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return socket.emit('error', 'Sessione non trovata');
    if (session.players.length < 3) return socket.emit('error', 'Minimo 3 giocatori');

    session.state = 'playing';
    session.word = randomWord();
    const impostorIdx = Math.floor(Math.random() * session.players.length);
    session.impostorId = session.players[impostorIdx].id;

    // Tell each player their role privately
    session.players.forEach((player, idx) => {
      const isImpostor = player.id === session.impostorId;
      io.to(player.socketId).emit('player:role', {
        isImpostor,
        word: isImpostor ? null : session.word,
        playerName: player.name,
        totalPlayers: session.players.length,
        position: idx + 1,
      });
    });

    // Tell host game started (no word revealed yet)
    io.to(`session:${sessionId}`).emit('game:started', {
      totalPlayers: session.players.length,
      timerSeconds: session.timerSeconds,
    });
  });

  // Host reveals word + impostor
  socket.on('host:reveal', ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session || session.state !== 'playing') return;
    session.state = 'finished';
    const impostorPlayer = session.players.find(p => p.id === session.impostorId);
    io.to(`session:${sessionId}`).emit('game:reveal', {
      word: session.word,
      impostorName: impostorPlayer ? impostorPlayer.name : '?',
    });
  });

  // Host restarts
  socket.on('host:restart', ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.state = 'lobby';
    session.word = null;
    session.impostorId = null;
    session.players = [];
    io.to(`session:${sessionId}`).emit('session:state', sessionPublicState(session));
    io.to(`session:${sessionId}`).emit('game:restarted');
  });

  // Disconnect
  socket.on('disconnect', () => {
    const { sessionId, playerId } = socket.data;
    if (!sessionId) return;
    const session = sessions.get(sessionId);
    if (!session) return;
    if (session.state === 'lobby') {
      session.players = session.players.filter(p => p.id !== playerId);
      io.to(`session:${sessionId}`).emit('session:state', sessionPublicState(session));
    }
  });
});

// ─── CLEANUP old sessions every hour ───
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [id, session] of sessions.entries()) {
    if (!session.createdAt || session.createdAt < cutoff) sessions.delete(id);
  }
}, 3600000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🕵️  L'Impostore server running on port ${PORT}`);
});
