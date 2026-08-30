import {App, PluginSettingTab, Setting} from "obsidian";
import MDtoTEXPlugin from "./main";

export interface MDtoTEXSettings {
	output_folder: string;

	document_class: string;
	font_size: number;
	paper_size: string;
	packages: string[];
	preamble: string;

	table_of_contents: boolean;
	number_headings: boolean;
	used_headings: string[];

	convert_to_pdf: boolean;
	pdf_conversion_command: string;
}

export const DEFAULT_SETTINGS: MDtoTEXSettings = {
	output_folder: "LaTeX/{FILENAME}",

	document_class: "article",
	font_size: 12,
	paper_size: "letterpaper",
	packages: [
		"amsmath",
		"amsfonts",
		"graphicx",
		"cancel",
		"ulem",
		"color, soul",
		"hyperref",
		"csquotes",
		"listings",
		"xcolor"
	],
	preamble:
		"\\lstset{\n" +
		"    basicstyle=\\ttfamily\\small, % Monospaced font\n" +
		"    keywordstyle=\\color{cyan},   % Keyword colors\n" +
		"    commentstyle=\\color{gray},   % Comment colors\n" +
		"    numbers=left,                 % Line numbers on the left\n" +
		"    numberstyle=\\tiny\\color{gray},\n" +
		"    frame=single,                 % Box border around the code\n" +
		"    breaklines=true               % Wrap long lines\n" +
		"}"
	,

	table_of_contents: false,
	number_headings: true,
	used_headings: [
		"section",
		"subsection",
		"subsubsection"
	],

	convert_to_pdf: false,
	pdf_conversion_command: "pdflatex -output-directory={OUTPUT_FOLDER_PATH} {FILE_PATH}"
}

export class MDtoTEXSettingTab extends PluginSettingTab {
	plugin: MDtoTEXPlugin;

	constructor(app: App, plugin: MDtoTEXPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Output Path')
			.setDesc('The path to the folder where the output will be stored, from the vault root')
			.addText(text => text
				.setPlaceholder('Enter the output path')
				.setValue(this.plugin.settings.output_folder)
				.onChange(async (value) => {
					this.plugin.settings.output_folder = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Preamble").setHeading();

		new Setting(containerEl)
			.setName('Document class')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Class of document to generate')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('article', 'Article')
					.addOption('proc', 'Proc')
					.addOption('minimal', 'Minimal')
					.addOption('report', 'Report')
					.addOption('book', 'Book')
					.addOption('slides', 'Slides')
					.addOption('memoir', 'Memoir')
					.addOption('letter', 'Letter')
					.addOption('beamer', 'Beamer')
					.addOption('standalone', 'Standalone')
					.addOption('exam', 'Exam')
					.setValue(this.plugin.settings.document_class)
					.onChange(async (value) => {
						this.plugin.settings.document_class = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Font size')
			.setDesc('Font size for body text')
			.addText(text => text
				.setPlaceholder('Enter font size')
				.setValue(String(this.plugin.settings.font_size))
				.onChange(async (value) => {
					this.plugin.settings.font_size = Number(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Paper size')
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Size of the paper')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('letterpaper', 'Letter')
					.addOption('a4paper', 'A4')
					.addOption('legalpaper', 'Legal')
					.setValue(this.plugin.settings.paper_size)
					.onChange(async (value) => {
						this.plugin.settings.paper_size = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Packages')
			.setDesc('Packages for LaTeX to import')
			.addTextArea(text => text
				.setPlaceholder('Enter package names, separated by commas')
				.setValue(this.plugin.settings.packages.join(",\n"))
				.onChange(async (value) => {
					this.plugin.settings.packages = value.split(",").map(s => s.trim());
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Preamble')
			.setDesc('Any additional lines to add to the preamble')
			.addTextArea(text => text
				.setPlaceholder('Enter lines of preamble')
				.setValue(this.plugin.settings.preamble)
				.onChange(async (value) => {
					this.plugin.settings.preamble = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Body").setHeading();

		new Setting(containerEl)
			.setName('Table of contents')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.table_of_contents)
				.onChange(async (value) => {
					this.plugin.settings.table_of_contents = value;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Number headings')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.number_headings)
				.onChange(async (value) => {
					this.plugin.settings.number_headings = value;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Enabled headings')
			.setDesc('A list of all heading types to use in order of highest to lowest')
			.addTextArea(text => text
				.setPlaceholder('Enter heading types, separated by commas')
				.setValue(this.plugin.settings.used_headings.join(",\n"))
				.onChange(async (value) => {
					this.plugin.settings.used_headings = value.split(",").map(s => s.trim());
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Conversion to PDF").setHeading();

		new Setting(containerEl)
			.setName('Convert LaTeX files to PDFs')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convert_to_pdf)
				.onChange(async (value) => {
					this.plugin.settings.convert_to_pdf = value;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(containerEl)
			.setName('Conversion Command')
			.setDesc('The command to call to convert LaTeX files to PDF')
			.addText(text => text
				.setPlaceholder('Enter the conversion command')
				.setValue(this.plugin.settings.pdf_conversion_command)
				.onChange(async (value) => {
					this.plugin.settings.pdf_conversion_command = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
