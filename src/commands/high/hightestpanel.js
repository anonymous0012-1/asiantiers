const { SlashCommandBuilder } = require('discord.js');
const sendHighPanel = require('./sendhighpanel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hightestpanel')
        .setDescription('Send the High Tests panel'),

    async execute(interaction) {
        return sendHighPanel.execute(interaction);
    }
};