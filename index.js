require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST
} = require('discord.js');

const mammoth = require("mammoth");
const http = require("http");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let premios = [];

// ===== CARGAR DOCX =====
async function cargarDoc() {
  try {
    const result = await mammoth.extractRawText({ path: "./Juegos.docx" });
    const text = result.value;

    const parts = text.split(/\n\s*\d+\.\s+/g).filter(Boolean);

    premios = parts.map(p => {
      const lines = p.trim().split(/\n+/);
      return {
        titulo: lines[0],
        texto: lines.slice(1).join("\n")
      };
    });

    console.log("✅ Premios cargados:", premios.length);

  } catch (error) {
    console.error("❌ Error cargando DOCX:", error);
  }
}

// ===== DIVIDIR TEXTO =====
function dividirTexto(texto, max = 1800) {
  let partes = [];
  let inicio = 0;

  while (inicio < texto.length) {
    let fin = inicio + max;

    if (fin < texto.length) {
      let espacio = texto.lastIndexOf(" ", fin);
      if (espacio > inicio) fin = espacio;
    }

    partes.push(texto.substring(inicio, fin));
    inicio = fin;
  }

  return partes;
}

// ===== COMANDO =====
const command = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Spin the roulette');

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Registrar comando
(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: [command.toJSON()] }
    );
    console.log("✅ Comando /roulette registrado");
  } catch (err) {
    console.error("❌ Error registrando comando:", err);
  }
})();

// ===== INTERACCIONES =====
client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'roulette') {

    if (!premios.length) {
      return interaction.reply("⚠️ Los premios aún no están cargados.");
    }

    await interaction.reply("🎡 Spinning...");

    // pequeña animación
    const estados = [
      "🎡 Spinning...",
      "🎡 Faster...",
      "🎡 Slowing down...",
      "🎯 Selecting..."
    ];

    for (let estado of estados) {
      await new Promise(r => setTimeout(r, 400));
      await interaction.editReply(estado);
    }

    const premio = premios[Math.floor(Math.random() * premios.length)];

    const texto = `## 🎯 ${premio.titulo}\n\n${premio.texto}`;

    const partes = dividirTexto(texto);

    await interaction.editReply(partes[0]);

    for (let i = 1; i < partes.length; i++) {
      await interaction.followUp(partes[i]);
    }
  }
});

// ===== READY =====
client.once('ready', async () => {
  console.log(`🤖 Bot listo como ${client.user.tag}`);
  await cargarDoc();
});

client.login(TOKEN);

// ===== KEEP ALIVE (Railway) =====
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.write("OK");
  res.end();
}).listen(PORT, () => {
  console.log("🌐 Keep alive activo en puerto", PORT);
});