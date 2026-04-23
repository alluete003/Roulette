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
   UI CONFIG (ENGLISH)
========================= */

const CATEGORY_META = {
  domination: { label: "💀 Domination", color: 0xff2e63 },
  fantasy: { label: "🧙 Fantasy", color: 0x6c5ce7 },
  public: { label: "🌆 Public", color: 0x00b894 },
  professionals: { label: "💼 Professionals", color: 0x0984e3 },
  strangers: { label: "🎭 Strangers", color: 0xe17055 },
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
   STATE (PERSISTENT)
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
   UTILITIES
========================= */

function safeText(text) {
  return text.length > 3900
    ? text.slice(0, 3900) + "..."
    : text;
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
   UI BUILDERS
========================= */

function buildCategoryButtons() {

  const botones = Object.keys(categorias).map(cat => {
    const meta = CATEGORY_META[cat] || { label: cat };

    return new ButtonBuilder()
      .setCustomId(`cat_${cat}`)
      .setLabel(meta.label)
      .setStyle(ButtonStyle.Primary);
  });

  botones.push(
    new ButtonBuilder()
      .setCustomId("cat_random")
      .setLabel(RANDOM_META.label)
      .setStyle(ButtonStyle.Success)
  );

  const row1 = new ActionRowBuilder().addComponents(botones.slice(0, 4));
  const row2 = new ActionRowBuilder().addComponents(botones.slice(4, 8));

  return [row1, row2];
}

function buildRerollButton(categoria) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reroll_${categoria}`)
      .setLabel("🔁 Reroll")
      .setStyle(ButtonStyle.Secondary)
  );
}

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  /* ===== COMMAND ===== */
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "roulette") {

      await interaction.reply({
        content: "🎯 **Select a category**",
        components: buildCategoryButtons()
      });
    }
  }

  /* ===== BUTTONS ===== */
  if (interaction.isButton()) {

    await interaction.deferUpdate();

    let categoria;

    if (interaction.customId.startsWith("cat_")) {

      if (interaction.customId === "cat_random") {
        categoria = random(Object.keys(categorias));
      } else {
        categoria = interaction.customId.replace("cat_", "");
      }

    } else if (interaction.customId.startsWith("reroll_")) {

      categoria = interaction.customId.replace("reroll_", "");

    } else return;

    const premio = obtenerPremio(categoria);

    const meta = CATEGORY_META[categoria] || RANDOM_META;

    const embed = new EmbedBuilder()
      .setTitle(`🎯 ${premio.titulo.en} / ${premio.titulo.es}`)
      .setDescription(
        `🇬🇧 **English**\n${safeText(premio.texto.en)}\n\n🇪🇸 **Español**\n${safeText(premio.texto.es)}`
      )
      .setColor(meta.color)
      .setFooter({ text: `Category: ${meta.label}` });

    if (premio.imagen) {
      embed.setImage(premio.imagen);
    }

    await interaction.editReply({
      content: "",
      embeds: [embed],
      components: [buildRerollButton(categoria)]
    });
  }
});

/* =========================
   READY
========================= */

client.once("ready", () => {
  console.log(`🔥 PREMIUM BOT READY: ${client.user.tag}`);
});

client.login(TOKEN);

/* =========================
   KEEP ALIVE
========================= */

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.end("OK");
}).listen(PORT);