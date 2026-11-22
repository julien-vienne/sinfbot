import {
	EmbedBuilder,
	Events,
	MessageFlags,
	TextChannel,
	codeBlock,
	type Interaction
} from "discord.js";

import { getLogger } from "../logger";
import type { Event } from "../types";
import { createBlindtest } from "../commands/blindtest";

const logger = getLogger("interactionCreate");

const event: Event = {
	name: Events.InteractionCreate,
	execute: async (interaction: Interaction) => {
		const blindtestAdminChannel = (await interaction.client.channels.fetch(
			process.env.BLINDTEST_ADMIN_CHANNEL_ID!
		)) as TextChannel;

		if (interaction.isChatInputCommand()) {
			const command = interaction.client.commands.get(
				interaction.commandName
			);
			const cooldown = interaction.client.cooldowns.get(
				`${interaction.commandName}-${interaction.user.username}`
			);

			if (!command) return;
			if (command.cooldown && cooldown) {
				if (Date.now() < cooldown) {
					interaction.reply({
						content: `:hourglass: You can reuse this command in ${Math.floor(
							Math.abs(Date.now() - cooldown) / 1000
						)} second(s)`,
						flags: MessageFlags.Ephemeral
					});
					setTimeout(() => interaction.deleteReply(), 5000);

					return;
				}

				interaction.client.cooldowns.set(
					`${interaction.commandName}-${interaction.user.username}`,
					Date.now() + command.cooldown * 1000
				);
				setTimeout(() => {
					interaction.client.cooldowns.delete(
						`${interaction.commandName}-${interaction.user.username}`
					);
				}, command.cooldown * 1000);
			} else if (command.cooldown && !cooldown) {
				interaction.client.cooldowns.set(
					`${interaction.commandName}-${interaction.user.username}`,
					Date.now() + command.cooldown * 1000
				);
			}

			command.execute(interaction);
		} else if (interaction.isAutocomplete()) {
			const command = interaction.client.commands.get(
				interaction.commandName
			);

			if (!command || !command.autocomplete) return;
			try {
				command.autocomplete(interaction);
			} catch (error) {
				logger.error(
					{ command: interaction.commandName, error },
					"Could not autocomplete"
				);
			}
		} else if (interaction.isModalSubmit()) {
			const command = interaction.client.commands.get(
				interaction.customId.split("_")[0]
			);

			if (!command || !command.modal) return;
			try {
				command.modal(interaction);
			} catch (error) {
				logger.error(
					{ modal: interaction.customId, error },
					"Could not process modal"
				);
			}

			// Accept or Refuse blindtests
		} else if (
			interaction.isButton() &&
			interaction.channelId === blindtestAdminChannel.id
		) {
			const embed = interaction.message.embeds[0];
			const requester = await interaction.client.users.fetch(
				embed.fields[0].value.slice(2, -1)
			);
			const answer = embed.fields[2].value;

			// blindtest accepted
			if (interaction.customId === "approve") {
				const type = embed.fields[1].value;
				const songUrl = embed.fields[3].value;
				const start = embed.fields[4].value;

				await interaction.message.edit({
					embeds: [
						EmbedBuilder.from(embed)
							.setTitle("Blindtest approved")
							.setColor(0x00ff00)
					],
					components: []
				});

				const sentBlindtest = await createBlindtest(
					songUrl,
					requester,
					interaction.client,
					Number(start),
					type
				);

				await requester
					.send({
						embeds: [
							new EmbedBuilder()
								.setTitle("Blindtest approved")
								.setDescription(
									`Your Blindtest ${codeBlock(answer)} has been approved. It is now available publicly.\n\n> [Click here](${sentBlindtest.url}) to view it`
								)
								.setColor(0x00ff00)
						]
					})
					.catch(() => undefined);

				// blindtest rejected
			} else if (interaction.customId === "reject") {
				await interaction.message.edit({
					embeds: [
						EmbedBuilder.from(embed)
							.setTitle("Blindtest rejected")
							.setColor(0xff0000)
					],
					components: []
				});
				await requester
					.send({
						embeds: [
							new EmbedBuilder()
								.setTitle("Blindtest rejected")
								.setDescription(
									`Your Blindtest ${codeBlock(answer)} has been rejected. It will not be shared publicly.`
								)
								.setColor(0xff0000)
						]
					})
					.catch(() => undefined);
			}
		}
	}
};

export default event;
