import {
	ModalBuilder,
	LabelBuilder,
	TextInputBuilder,
	TextInputStyle,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	MessageFlags,
	SlashCommandBuilder,
	TextChannel,
	Client,
	User,
	bold,
	type MessageActionRowComponentBuilder
} from "discord.js";

import type { Command } from "../types";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { Quality, Ytdl } from "@distube/ytdl-core";
import { ffmpeg } from "ffmpeg";

export async function createBlindtest(
	songUrl: string,
	requester: User,
	client: Client,
	start: number,
	type: string
) {
	const ytb = new Ytdl();
	let sentBlindtest;

	const blindtestChannel = (await client.channels.fetch(
		process.env.BLINDTEST_CHANNEL_ID!
	)) as TextChannel;

	const info = await ytb.getInfo(songUrl);

	await pipeline(
		ytb.download(info, {
			quality: Quality.HighestAudio,
			filter: { hasAudio: true, hasVideo: false }
		}),
		createWriteStream("./src/data/audio.mp3")
	);

	// trim it at 1 min
	const audio = await ffmpeg("./src/data/audio.mp3");
	await audio
		.setVideoStartTime(start)
		.setVideoDuration(60)
		.save("./src/data/newAudio.mp3");

	// send it to the channel
	sentBlindtest = await blindtestChannel.send({
		content: `<@&1572322388316786729>, a new blindtest is here!\n ${requester} challenges you to guess ${bold(type)}`,
		files: [
			{
				attachment: "./src/data/newAudio.mp3",
				name: "audio.mp3"
			}
		]
	});
	await sentBlindtest.startThread({ name: "Answer" });

	// remove the files
	unlink("./src/data/audio.mp3");
	unlink("./src/data/newAudio.mp3");

	return sentBlindtest;
}

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("blindtest")
		.setDescription("Create a new blindtest"),

	execute: async interaction => {
		const modal = new ModalBuilder()
			.setCustomId("blindtest")
			.setTitle("Create a Blindtest");

		const typeSelect = new StringSelectMenuBuilder()
			.setCustomId("type")
			.setPlaceholder("Select what players need to guess")
			.setRequired(true)
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel("Movie")
					.setDescription("Guess the movie title")
					.setValue("the movie"),
				new StringSelectMenuOptionBuilder()
					.setLabel("TV Series")
					.setDescription("Guess the series title")
					.setValue("the TV Series"),
				new StringSelectMenuOptionBuilder()
					.setLabel("Music")
					.setDescription("Guess the song and artist")
					.setValue("the song and artist"),
				new StringSelectMenuOptionBuilder()
					.setLabel("Video Game")
					.setDescription("Guess the game title")
					.setValue("the video game"),
				new StringSelectMenuOptionBuilder()
					.setLabel("Full Answer")
					.setDescription("Guess the show, song, and artist")
					.setValue("the show, song and artist")
			);
		const typeMenu = new LabelBuilder()
			.setLabel("Answer type")
			.setStringSelectMenuComponent(typeSelect);

		const answerText = new TextInputBuilder()
			.setCustomId("answer")
			.setPlaceholder(
				"e.g. Imagines Dragons - Zero - Ralph Breaks the Internet"
			)
			.setStyle(TextInputStyle.Short)
			.setRequired(true);
		const answerLabel = new LabelBuilder()
			.setLabel("The answer")
			.setDescription(
				"Enter the title, artist, or full answer based on the selected type"
			)
			.setTextInputComponent(answerText);

		const urlText = new TextInputBuilder()
			.setCustomId("url")
			.setPlaceholder("e.g. https://youtu.be/j60ClcNYWu4")
			.setStyle(TextInputStyle.Short)
			.setRequired(true);
		const urlLabel = new LabelBuilder()
			.setLabel("YouTube URL")
			.setTextInputComponent(urlText)
			.setDescription("The video used for this blindtest");

		const startText = new TextInputBuilder()
			.setCustomId("start")
			.setPlaceholder("e.g. for 1:30, enter 90")
			.setStyle(TextInputStyle.Short)
			.setMaxLength(3)
			.setRequired(false);
		const startLabel = new LabelBuilder()
			.setLabel("Start time (seconds)")
			.setDescription("Leave empty for 0:00")
			.setTextInputComponent(startText);

		modal.addLabelComponents(typeMenu, answerLabel, urlLabel);
		modal.addLabelComponents(startLabel);
		await interaction.showModal(modal);
	},
	modal: async interaction => {
		const songUrl = interaction.fields.getTextInputValue("url");
		const answer = interaction.fields.getTextInputValue("answer");
		const start =
			interaction.fields.getTextInputValue("start") == ""
				? "0"
				: interaction.fields.getTextInputValue("start");
		const blindtestType =
			interaction.fields.getStringSelectValues("type")[0];
		const requester = interaction.user;
		const ytb = new Ytdl();
		let startMS = "0";

		// Check whether it is a YouTube link or whether the video is not private
		try {
			const info = await ytb.getInfo(songUrl);
			startMS =
				Number(start) > info.videoDetails.lengthSeconds ? "0" : start;
		} catch (error) {
			interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setTitle("Error")
						.setDescription(
							"Something bad happened. Are you sure your link comes from YouTube?\nIf so, the website is probably down."
						)
						.setColor(0x5865f2)
				],
				flags: MessageFlags.Ephemeral
			});
			return;
		}

		const songUrlWithStart =
			Number(startMS) == 0 ? songUrl : songUrl + "?t=" + start;

		const adminChannel = (await interaction.client.channels.fetch(
			process.env.BLINDTEST_ADMIN_CHANNEL_ID!
		)) as TextChannel;

		const embedAdmin = new EmbedBuilder()
			.setTitle("Blindtest")
			.addFields(
				{ name: "User", value: `${requester}`, inline: true },
				{ name: "What to guess", value: blindtestType, inline: true },
				{ name: "Answer", value: answer, inline: true },
				{ name: "Link", value: songUrlWithStart },
				{ name: "Start Time", value: startMS }
			);

		const approveButton = new ButtonBuilder()
			.setCustomId("approve")
			.setLabel("Approve")
			.setStyle(ButtonStyle.Success)
			.setEmoji({ name: "✅" });

		const rejectButton = new ButtonBuilder()
			.setCustomId("reject")
			.setLabel("Reject")
			.setStyle(ButtonStyle.Secondary)
			.setEmoji({ name: "❌" });

		const actionRow =
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				approveButton,
				rejectButton
			);

		await interaction.reply({
			embeds: [
				new EmbedBuilder()
					.setTitle("Blindtest sent")
					.setDescription(
						"Your idea for the blindtest has been sent and is awaiting verification. If your DM's are open to everyone, you'll be notified when it has been approved or rejected."
					)
					.setColor(0x5865f2)
			],
			flags: MessageFlags.Ephemeral
		});

		await adminChannel.send({
			embeds: [embedAdmin],
			components: [actionRow]
		});

		return;
	}
};

export default command;
