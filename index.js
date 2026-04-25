require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const http = require("http");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* =========================
   CATEGORY UI
========================= */

const CATEGORY_META = {
  domination_aetel: { label: "💀 Domination (Aetel)", color: 0xff2e63 },
  domination_txetxu: { label: "💀 Domination (Txetxu)", color: 0xff2e63 },

  strangers: { label: "🎭 Strangers", color: 0xe17055 },
  professionals: { label: "💼 Professionals", color: 0x0984e3 },
  public: { label: "🌆 Public", color: 0x00b894 },
  fantasy: { label: "🧙 Fantasy", color: 0x6c5ce7 },
  intimate: { label: "❤️ Intimate", color: 0xe84393 }
};

const RANDOM_META = {
  label: "🎲 Random",
  color: 0xf1c40f
};

/* =========================
   LOAD DATA
========================= */

let categorias = {};
let premios = [];

const files = fs.readdirSync("./data");

files.forEach(file => {
  const categoria = file.replace(".json", "");
  const data = JSON.parse(fs.readFileSync(`./data/${file}`));

  categorias[categoria] = data;

  data.forEach(p => {
    premios.push({ ...p, categoria });
  });
});

/* =========================
   STATE
========================= */

const STATE_FILE = "./state.json";

let state = {
  usados_global: [],
  usados_categoria: {}
};

if (fs.existsSync(STATE_FILE)) {
  state = JSON.parse(fs.readFileSync(STATE_FILE));
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/* =========================
   UTIL
========================= */

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function safeText(text) {
  return text.length > 3900 ? text.slice(0, 3900) + "..." : text;
}


/* =========================
   ANTI-REPETITION
========================= */

function obtenerPremio(categoria) {

  let pool = categoria ? categorias[categoria] : premios;

  if (state.usados_global.length >= premios.length) {
    state.usados_global = [];
  }

  if (categoria) {
    if (!state.usados_categoria[categoria]) {
      state.usados_categoria[categoria] = [];
    }

    if (state.usados_categoria[categoria].length >= pool.length) {
      state.usados_categoria[categoria] = [];
    }
  }

  const disponibles = pool.filter(p =>
    !state.usados_global.includes(p.id) &&
    !(categoria && state.usados_categoria[categoria].includes(p.id))
  );

  const elegido = disponibles.length > 0
    ? random(disponibles)
    : random(pool);

  state.usados_global.push(elegido.id);

  if (categoria) {
    state.usados_categoria[categoria].push(elegido.id);
  }

  saveState();

  return elegido;
}

/* =========================
   ANIMATION PRO
========================= */

async function spinAnimationPro(interaction, categoriaFinal) {

  const keys = Object.keys(categorias);

  for (let i = 0; i < 5; i++) {
    const fake = random(keys);
    const meta = CATEGORY_META[fake];

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎰 Spinning...")
          .setDescription(`⚡ ${meta.label}`)
          .setColor(0x888888)
      ]
    });

    await sleep(70);
  }

  for (let i = 0; i < 4; i++) {
    const fake = random(keys);
    const meta = CATEGORY_META[fake];

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎰 Slowing down...")
          .setDescription(`🌀 ${meta.label}`)
          .setColor(0xbbbbbb)
      ]
    });

    await sleep(120);
  }

  const almost = random(keys.filter(k => k !== categoriaFinal));

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎰 Almost...")
        .setDescription(`❗ ${CATEGORY_META[almost].label}`)
        .setColor(0xffaa00)
    ]
  });

  await sleep(300);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🛑 Stopping...")
        .setDescription(`👉 ${CATEGORY_META[categoriaFinal].label}`)
        .setColor(CATEGORY_META[categoriaFinal].color)
    ]
  });

  await sleep(400);
}

/* =========================
   COMMAND
========================= */

const command = new SlashCommandBuilder()
  .setName("roulette")
  .setDescription("Spin the roulette");

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: [command.toJSON()] }
  );
})();

/* =========================
   BUTTONS
========================= */

function buildCategoryButtons() {

  const botones = Object.keys(categorias).map(cat => {
    return new ButtonBuilder()
      .setCustomId(`cat_${cat}`)
      .setLabel(CATEGORY_META[cat].label)
      .setStyle(ButtonStyle.Primary);
  });

  botones.push(
    new ButtonBuilder()
      .setCustomId("cat_random")
      .setLabel(RANDOM_META.label)
      .setStyle(ButtonStyle.Success)
  );

  return [
    new ActionRowBuilder().addComponents(botones.slice(0, 4)),
    new ActionRowBuilder().addComponents(botones.slice(4, 8))
  ];
}

function buildRerollButton(cat) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reroll_${cat}`)
      .setLabel("🔁 Reroll")
      .setStyle(ButtonStyle.Secondary)
  );
}

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "roulette") {
      await interaction.reply({
        content: "🎯 Select a category",
        components: buildCategoryButtons()
      });
    }
  }

  if (interaction.isButton()) {

    await interaction.deferReply();

    let categoria;

    if (interaction.customId.startsWith("cat_")) {
      categoria = interaction.customId === "cat_random"
        ? random(Object.keys(categorias))
        : interaction.customId.replace("cat_", "");
    }

    if (interaction.customId.startsWith("reroll_")) {
      categoria = interaction.customId.replace("reroll_", "");
    }

    if (!categoria) return;

    const premio = obtenerPremio(categoria);

    await spinAnimationPro(interaction, categoria);

    const embed = new EmbedBuilder()
      .setTitle(`🎯✨ ${premio.titulo.en} ✨\n🇪🇸 ${premio.titulo.es}`)
      .setAuthor({ name: "🎬 Cinematic Roulette" })
      .setDescription(
        `════════════════════\n\n` +
        `${cinematicFormat(safeText(premio.texto.en), "en")}\n\n` +
        `════════════════════\n\n` +
        `🇪🇸 **ESPAÑOL**\n\n` +
        `${cinematicFormat(safeText(premio.texto.es), "es")}`
      )
      .setColor(CATEGORY_META[categoria].color)
      .setFooter({ text: CATEGORY_META[categoria].label });

    if (premio.imagen) embed.setImage(premio.imagen);

    await interaction.editReply({
      embeds: [embed],
      components: [buildRerollButton(categoria)]
    });
  }
});

/* =========================
   READY
========================= */

client.once("clientReady", () => {
  console.log(`🔥 BOT READY: ${client.user.tag}`);
});

client.login(TOKEN);

/* =========================
   KEEP ALIVE
========================= */

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.end("OK");
}).listen(PORT);