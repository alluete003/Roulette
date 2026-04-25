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
   UI CONFIG
========================= */

const CATEGORY_META = {
  domination_aetel: { label: "💀 Domination (Aetel)", color: 0xff2e63 },
  domination_txetxu: { label: "💀 Domination (Txetxu)", color: 0xff2e63 },

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

  return [
    new ActionRowBuilder().addComponents(botones.slice(0, 4)),
    new ActionRowBuilder().addComponents(botones.slice(4, 8))
  ];
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
   🎰 ANIMACIÓN PRO
========================= */

async function spinAnimationPro(interaction, categoriaFinal) {

  const keys = Object.keys(categorias);

  // FAST
  for (let i = 0; i < 5; i++) {
    const fake = random(keys);
    const meta = CATEGORY_META[fake] || { label: fake };

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

  // MEDIUM
  for (let i = 0; i < 4; i++) {
    const fake = random(keys);
    const meta = CATEGORY_META[fake] || { label: fake };

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

  // NEAR MISS
  const almost = random(keys.filter(k => k !== categoriaFinal));
  const almostMeta = CATEGORY_META[almost] || { label: almost };

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎰 Almost...")
        .setDescription(`❗ ${almostMeta.label}`)
        .setColor(0xffaa00)
    ]
  });

  await sleep(300);

  // FINAL STOP
  const finalMeta = CATEGORY_META[categoriaFinal] || { label: categoriaFinal };

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🛑 Stopping...")
        .setDescription(`👉 ${finalMeta.label}`)
        .setColor(finalMeta.color)
    ]
  });

  await sleep(400);
}

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "roulette") {

      await interaction.reply({
        content: "🎯 **Select a category**",
        components: buildCategoryButtons()
      });
    }
  }

  if (interaction.isButton()) {

    await interaction.deferReply();

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

    // RESULT FIRST
    const premio = obtenerPremio(categoria);

    // ANIMATION
    await spinAnimationPro(interaction, categoria);

    const meta = CATEGORY_META[categoria] || RANDOM_META;

    const embed = new EmbedBuilder()
      .setTitle(`🎯✨ ${premio.titulo.en} ✨`)
      .setDescription(
        `🇬🇧 **English**\n${safeText(premio.texto.en)}\n\n🇪🇸 **Español**\n${safeText(premio.texto.es)}`
      )
      .setColor(meta.color)
      .setFooter({ text: `Category: ${meta.label}` });

    if (premio.imagen) {
      embed.setImage(premio.imagen);
    }

    await interaction.editReply({
      embeds: [embed],
      components: [buildRerollButton(categoria)]
    });
  }
});

/* =========================
   READY
========================= */

client.once("ready", () => {
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