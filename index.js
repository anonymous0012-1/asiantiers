const {
    Client,
    GatewayIntentBits,
    Collection,
    Partials
} = require('discord.js');

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const express = require('express');

dotenv.config();

// ==========================================
// Discord Client
// ==========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel
    ]
});

client.commands = new Collection();

// ==========================================
// Express Web Server
// ==========================================

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.status(200).send('AsianTiers Bot is online!');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        bot: client.isReady() ? 'connected' : 'connecting',
        uptime: process.uptime()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// ==========================================
// Load Commands
// ==========================================

const commandsPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    const commandFiles = fs
        .readdirSync(folderPath)
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`<:tick:1567480091267825714> Loaded Command: ${command.data.name}`);
        }
    }
}

// ==========================================
// Load Events
// ==========================================

const eventsPath = path.join(__dirname, 'src/events');

const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }

    console.log(`<:tick:1567480091267825714> Loaded Event: ${event.name}`);
}

// ==========================================
// Login
// ==========================================

client.login(process.env.TOKEN)
    .then(() => {
        console.log('🤖 AsianTiers Bot Logged In');
    })
    .catch(error => {
        console.error('<:crosss:1567480131713241108> Discord Login Failed:', error);
    });