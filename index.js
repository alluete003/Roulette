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

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

/* =========================
   CATEGORIES
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

/* =========================
   LOAD DATA
========================= */

let categorias = {};
let premios = [];

fs.readdirSync("./data").forEach(file => {
  const cat = file.replace(".json", "");
  const data = JSON.parse(fs.readFileSync(`./data/${file}`));
  categorias[cat] = data;

  data.forEach(p => premios.push({ ...p, categoria: cat }));
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

const sleep = ms => new Promise(r => setTimeout(r, ms));
const random = arr => arr[Math.floor(Math.random() * arr.length)];

function safeText(text) {
  return text.length > 3900 ? text.slice(0, 3900) + "..." : text;
}

/* =========================
   ANTI-REPETITION
========================= */

function obtenerPremio(cat) {
  const pool = cat ? categorias[cat] : premios;

  if (state.usados_global.length >= premios.length) {
    state.usados_global = [];
  }

  if (cat) {
    if (!state.usados_categoria[cat]) state.usados_categoria[cat] = [];

    if (state.usados_categoria[cat].length >= pool.length) {
      state.usados_categoria[cat] = [];
    }
  }

  const disponibles = pool.filter(p =>
    !state.usados_global.includes(p.id) &&
    !(cat && state.usados_categoria[cat].includes(p.id))
  );

  const elegido = disponibles.length ? random(disponibles) : random(pool);

  state.usados_global.push(elegido.id);
  if (cat) state.usados_categoria[cat].push(elegido.id);

  saveState();

  return elegido;
}

/* =========================
   ANIMACIÓN SEGURA
========================= */

async function spinAnimation(interaction, finalCat) {
  const keys = Object.keys(categorias);

  for (let i = 0; i < 5; i++) {
    const fake = random(keys);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎰 Spinning...")
          .setDescription(`⚡ ${CATEGORY_META[fake].label}`)
          .setColor(0x888888)
      ],
      components: []
    });

    await sleep(80);
  }

  const almost = random(keys.filter(k => k !== finalCat));

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎰 Almost...")
        .setDescription(`❗ ${CATEGORY_META[almost].label}`)
        .setColor(0xffaa00)
    ],
    components: []
  });

  await sleep(300);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🛑 Stopping...")
        .setDescription(`👉 ${CATEGORY_META[finalCat].label}`)
        .setColor(CATEGORY_META[finalCat].color)
    ],
    components: []
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

function categoryButtons() {
  const btns = Object.keys(categorias).map(cat =>
    new ButtonBuilder()
      .setCustomId(`cat_${cat}`)
      .setLabel(CATEGORY_META[cat].label)
      .setStyle(ButtonStyle.Primary)
  );

  btns.push(
    new ButtonBuilder()
      .setCustomId("cat_random")
      .setLabel("🎲 Random")
      .setStyle(ButtonStyle.Success)
  );

  return [
    new ActionRowBuilder().addComponents(btns.slice(0, 4)),
    new ActionRowBuilder().addComponents(btns.slice(4))
  ];
}

function rerollButton(cat) {
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
        components: categoryButtons()
      });
    }
  }

  if (interaction.isButton()) {

    await interaction.deferReply();

    let cat;

    if (interaction.customId === "cat_random") {
      cat = random(Object.keys(categorias));
    } else if (interaction.customId.startsWith("cat_")) {
      cat = interaction.customId.replace("cat_", "");
    } else if (interaction.customId.startsWith("reroll_")) {
      cat = interaction.customId.replace("reroll_", "");
    }

    if (!cat) return;

    const premio = obtenerPremio(cat);

    await spinAnimation(interaction, cat);

    const embed = new EmbedBuilder()
      .setTitle(`🎯✨ ${premio.titulo.en} ✨\n🇪🇸 ${premio.titulo.es}`)
      .setDescription(
        `${safeText(premio.texto.en)}\n\n──────────────\n\n🇪🇸\n${safeText(premio.texto.es)}`
      )
      .setColor(CATEGORY_META[cat].color)
      .setFooter({ text: CATEGORY_META[cat].label });

    if (premio.imagen) embed.setImage(premio.imagen);

    await interaction.editReply({
      embeds: [embed],
      components: [rerollButton(cat)]
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