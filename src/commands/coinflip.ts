import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from "discord.js";

import type { Command } from "../types";
import { setTimeout } from "node:timers/promises";

const command: Command = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Flip a coin"),

    execute: async interaction => {

        const result = Math.random()<0.5 ? "Tail" : "Head";
        
        const flipGif = new AttachmentBuilder(`./src/data/flip.gif`);
        const filpEmbed = new EmbedBuilder()
            .setTitle("Coinflip")
            .setDescription("Flipping the coin")
            .setColor("Gold")
            .setThumbnail(`attachment://flip.gif`)

        await interaction.reply({
            embeds:[filpEmbed],
            files:[flipGif]
        });

        await setTimeout(1800)

        const image = new AttachmentBuilder(`./src/data/${result}.png`);
        const embed = new EmbedBuilder()
            .setTitle("Coinflip")
            .setColor("Gold")
            .setDescription(`The result is : **${result}**`)
            .setThumbnail(`attachment://${result}.png`)

        interaction.editReply({
            embeds:[embed],
            files:[image]
        });
    },

    cooldown: 2

};

export default command;