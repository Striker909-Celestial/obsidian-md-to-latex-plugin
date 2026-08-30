import {MDtoTEXSettings} from "./settings";
import {Line, Tag} from "./line";
import {body_texer} from "./body_texer";
import {Notice} from "obsidian";

export class Document {
	
	private preamble_list: string[] = ["% Preamble"];
	private title_list: string[] = ["% Title"]
	private body_lines: Line[] = [new Line("% Body"), new Line("\\begin{document}"), new Line("\\maketitle")];
	public latex_text: string = "";
	
	public constructor(
		public readonly title: string,
		public readonly body: string,
		public readonly properties: Map<string, any>,
		public readonly settings: MDtoTEXSettings
	) {
		this.makePreamble();
		this.makeTitle();
		this.splitBody();
		this.formatBody();
		this.mapHeaders();
		this.assembleDocument();
	}

	/** Creates the preamble as an array of lines from the plugin's settings.
	 *
	 * The preamble includes the `doucmentclass` line and all packages.
	 * @return The preamble as an array of lines
	 * */
	private makePreamble(): string[] {
		this.preamble_list.push(`\\documentclass[${this.settings.paper_size}, ${this.settings.font_size}pt]{${this.settings.document_class}}`);
		this.preamble_list.push("");
		for (const pkg of this.settings.packages) {
			this.preamble_list.push(`\\usepackage{${pkg}}`);
		}
		this.preamble_list.push("");
		this.preamble_list.push(this.settings.preamble)
		return this.preamble_list;
	}

	/**Creates the title section as an array of lines from the title, author, and date.
	 *
	 * @return The title section as an array of lines
	 * */
	private makeTitle(): string[] {
		this.title_list.push(`\\title{${this.title}}`);
		if (this.properties.has("Author")) this.title_list.push(`\\author{${this.properties.get("Author")}}`);
		if (this.properties.has("Date")) this.title_list.push(`\\date{${this.properties.get("Date")}}`);
		return this.title_list;
	}

	private splitBody(): Line[] {
		if (this.settings.table_of_contents) this.body_lines.push(new Line("\\tableofcontents"));
		const lines: string[] = this.body.split("\n");
		for (const line of lines) {
			this.body_lines.push(new Line(line));
		}
		this.body_lines.push(new Line("\\end{document}"));
		return this.body_lines;
	}

	private formatBody(): Line[] {
		this.body_lines = body_texer(this.body_lines);
		return this.body_lines;
	}
	
	private mapHeaders() {
		const levels: number[] = [];
		const indices: number[] = []
		for (var i = 0; i < this.body_lines.length; i++) {
			const line = this.body_lines[i]!;
			if (line.tags.contains(Tag.HEADER)) {
				levels.push(line.tags.get(Tag.HEADER)?.data.get("level") as number);
				indices.push(i);
			}
		}

		levels.sort((a, b) => a - b);
		i = 0;
		const headers_mapping: Map<number, string> = new Map();
		for (const n of levels) {
			if (!headers_mapping.has(n)) {
				if (i < this.settings.used_headings.length) {
					headers_mapping.set(n, "\\" + this.settings.used_headings[i]! + ((this.settings.number_headings) ? "" : "*"));
					i++;
				} else {
					headers_mapping.set(n, "\\" + this.settings.used_headings.last()! + ((this.settings.number_headings) ? "" : "*"));
				}
			}
		}

		for (i = 0; i < levels.length; i++) {
			const index = indices[i]!
			const level = levels[i]!
			this.body_lines[index]!.setText(headers_mapping.get(level)! + "{" + this.body_lines[index]!.getText() + "}")
		}
	}

	private assembleDocument(): string {
		for (const line of this.preamble_list) { this.latex_text += line + "\n"; }
		this.latex_text += "\n";
		for (const line of this.title_list) { this.latex_text += line + "\n"; }
		this.latex_text += "\n";
		for (const line of this.body_lines) { this.latex_text += line.getText() + "\n"; }
		return this.latex_text
	}
}
