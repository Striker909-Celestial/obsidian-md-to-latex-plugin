import {MDtoTEXSettings} from "./settings";
import MDtoTEXPlugin from "./main";
import {Notice} from "obsidian";
/** Uses a plugin to read the .md file from a specified path as an array of lines.
 * @param plugin The plugin to use
 * @param md_path The path to the .md file
 * @returns An array of lines from the .md file
 * */
async function readMD(plugin: MDtoTEXPlugin, md_path: string): Promise<string[]> {
	const file = plugin.app.vault.getFileByPath(md_path);
	if (file?.extension != "md") {
		return [];
	}
	const text: string = await plugin.app.vault.read(file!);
	return text.split("\n");
}
/** Uses a plugin to read the active .md file as an array of lines.
 * @param plugin The plugin to use
 * @returns An array of lines from the .md file
 * */
async function readCurrentMD(plugin: MDtoTEXPlugin): Promise<string[]> {
	const file = plugin.app.workspace.getActiveFile();
	if (file?.extension != "md") {
		return [];
	}
	const text: string = await plugin.app.vault.read(file!);
	return text.split("\n");
}

/** Creates the preamble as an array of lines from the plugin's settings.
 *
 * The preamble includes the `doucmentclass` line and all packages.
 * @param settings The settings to make the preamble from
 * @return The preamble as an array of lines
 * */
function makePreamble(settings: MDtoTEXSettings): string[] {
	let preamble: string[] = ["% Preamble"];
	preamble.push(`\\documentclass[${settings.paper_size},${settings.font_size}pt]{${settings.document_class}}`);
	preamble.push("");
	for (const pkg of settings.packages) {
		preamble.push(`\\usepackage{${pkg}}`);
	}
	preamble.push("");
	return preamble;
}

const author = new RegExp(/#Author:?\s(.*)/);
const date = new RegExp(/#Date:?\s(.*)/);
/**Creates the title section as an array of lines from the title, author, and date.
 *
 * The author comes from a line started with `#Author`.
 * The date comes from a line started with `#Date`.
 * If the date is `Today`, it is replaced with `\today`.
 * @param title The title of the document
 * @param lines The lines from the .md document
 * @return The title section as an array of lines
 * */
function makeTitle(title: string, lines: string[]): string[] {
	let title_section: string[] = ["% Title"];
	title_section.push(`\\title{${title}}`);
	let lines_to_remove: string[] = [];
	for (const line of lines) {
		if (author.test(line)) {
			title_section.push(`\\author{${author.exec(line)![1]}}`);
			lines_to_remove.push(line);
			continue;
		}
		if (date.test(line)) {
			lines_to_remove.push(line);
			let _date = date.exec(line)![1];
			if (_date == "today" || _date == "Today") {
				_date = "\\today";
			}
			title_section.push(`\\date{${_date}}`);
		}
	}
	title_section.push("");
	for (const line of lines_to_remove) {
		lines.remove(line);
	}
	return title_section;
}

let headings: Map<number, string> = new Map();
const heading_regex = new RegExp(/#+ (.*)/);
/**Initializes the headings by assigning the largest heading enabled in settings to the largest heading in the document,
 * and so on for all headings in the document.
 *
 * If there are more heading sizes in the document than there are in settings, all headings under a certain size
 * will become plaintext.
 * @param settings The settings of the plugin
 * @param lines The lines from the .md document*/
function initHeadings(settings: MDtoTEXSettings, lines: string[]): void {
	let hash_nums: number[] = [];
	for (const line of lines) {
		if (heading_regex.test(line)) {
			// @ts-ignore
			const num = line.split(" ")[0].length;
			if (!hash_nums.includes(num)) {
				hash_nums.push(num);
			}
		}
	}
	hash_nums.sort((a, b) => a - b);
	let i: number;
	for (i = 0; i < settings.used_headings.length; i++) {
		headings.set(Number(hash_nums[i]), settings.used_headings[i]!);
		if (i >= hash_nums.length) { break; }
	}
	while (i < hash_nums.length) {
		headings.set(Number(hash_nums[i]), "text");
		i++;
	}
}
/**Checks if a given line is a heading, and if so, applies the appropriate heading command to it.
 * @param settings The settings of the plugin
 * @param line The line to check
 * @return The original line if it was not a heading, the modified line otherwise*/
function applyHeading(settings: MDtoTEXSettings, line: string): string {
	if (!heading_regex.test(line)) { return line; }
	// @ts-ignore
	const num = line.split(" ")[0].length;
	if (headings.get(num) == "text") { return line; }
	let split: string[] = line.split(" ");
	split = split.slice(1, split.length);
	return `\n\\${headings.get(num)}${settings.number_headings ? "" : "*"}{${split.join(" ")}}`;
}
const emphasis_regex: Map<string, RegExp> = new Map([
	["textbf", new RegExp(/\*\*(.*?)\*\*/)],
	["textit", new RegExp(/\*(.*?)\*/)],
	["sout", new RegExp(/~~(.*?)~~/)],
])
/**Checks for all instances of emphasis within a line (bold, italics, strikethrough) and applies the appropriate
 * commands to those sections.
 * @param line The line to check
 * @return The original line if it did not contain emphasis, the modified line otherwise*/
function applyEmphasis(line: string): string {
	for (const emph of emphasis_regex.keys()) {
		while (emphasis_regex.get(emph)!.test(line)) {
			line = line.replace(emphasis_regex.get(emph)!, `\\${emph}{${emphasis_regex.get(emph)!.exec(line)![1]}}`);
		}
	}
	return line;
}
/**Creates the body section of the document from an array of lines.
 *
 * - Adds commands to begin the document section.
 * - Initializes headings.
 * - Applies heading and emphasis commands to each line where necessary.
 * @param settings The settings of the plugin
 * @param lines The lines from the .md document
 * @return The body section as an array of lines*/
function makeBody(settings: MDtoTEXSettings, lines: string[]): string[] {
	let body: string[] = [
		"% Body",
		"\\begin{document}",
		"\\maketitle"
	];
	if (settings.table_of_contents) {
		body.push("\\tableofcontents");
	}
	initHeadings(settings, lines);
	for (const line of lines) {
		if (line == "") { continue; }
		const h_line = applyHeading(settings, line);
		const e_line = applyEmphasis(h_line);
		body.push(e_line);
	}
	body.push("\\end{document}");
	return body;
}

const md_regex = new RegExp(/([^\\]+)\.md/);
const tex_regex = new RegExp(/([^\\]+)\.tex/);
/**Writes a full .tex file with preamble, title, and body sections given an arraylist of lines from a .md file.
 * @param plugin The plugin to use to write the file
 * @param settings The settings of the plugin
 * @param path The path to the .tex file
 * @param lines The lines from the .md file
 * @return If the write operation was successful*/
export async function writeTEX(plugin: MDtoTEXPlugin, settings: MDtoTEXSettings, path: string, lines: string[]): Promise<boolean> {
	if (!tex_regex.test(path)) {return false;}
	const title: string = String(tex_regex.exec(path)![1]);
	let tex: string[] = [];
	tex.push(...makePreamble(settings));
	tex.push(...makeTitle(title, lines));
	tex.push(...makeBody(settings, lines));
	await plugin.app.vault.adapter.write(path, tex.join("\n"));
	return true;
}
/**Writes a full .tex file with preamble, title, and body sections from a .md file.
 * @param plugin The plugin to use to write the file
 * @param settings The settings of the plugin
 * @param md_path The path to the .md file
 * @return If the write operation was successful*/
export async function MDtoTEX(plugin: MDtoTEXPlugin, settings: MDtoTEXSettings, md_path: string): Promise<boolean> {
	if (!md_regex.test(md_path)) {return false;}
	const lines: string[] = await readMD(plugin, md_path);
	const path: string = md_path.substring(0, md_path.length - 3) + ".tex";
	return writeTEX(plugin, settings, path, lines);
}
/**Writes a full .tex file with preamble, title, and body sections from the active .md file.
 * @param plugin The plugin to use to write the file
 * @param settings The settings of the plugin
 * @return If the write operation was successful*/
export async function currentMDtoTEX(plugin: MDtoTEXPlugin, settings: MDtoTEXSettings): Promise<boolean> {
	const lines: string[] = await readCurrentMD(plugin);
	if (lines.length == 0) { return false; }
	const md_path = plugin.app.workspace.getActiveFile()!.path;
	const path: string = md_path.substring(0, md_path.length - 3) + ".tex";
	return writeTEX(plugin, settings, path, lines);
}
